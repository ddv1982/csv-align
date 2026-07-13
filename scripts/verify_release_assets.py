#!/usr/bin/env python3
"""Verify CSV Align release assets and emit a deterministic SHA-256 manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass

MANIFEST_BASENAME = "release-assets-manifest.json"
TAG_PATTERN = re.compile(r"^v(?P<version>[0-9]+\.[0-9]+\.[0-9]+)$")


class VerificationError(RuntimeError):
    """A release asset contract violation."""


@dataclass(frozen=True)
class Asset:
    name: str
    path: pathlib.Path
    size: int
    sha256: str


def expected_names(version: str, platform: str) -> set[str]:
    linux = {
        f"CSV.Align_{version}_amd64.deb",
        f"csv-align-{version}-1.x86_64.rpm",
        f"CSV.Align_{version}_amd64.AppImage",
        "csv-align-repository-setup_1.0_all.deb",
        "csv-align-repository-setup_1.0_all.deb.sha256",
        "csv-align-repository-setup_1.0_all.deb.sha256.asc",
        "install-apt-repo.sh",
    }
    macos_aarch64 = {f"CSV.Align_{version}_aarch64.dmg"}
    macos_x86_64 = {f"CSV.Align_{version}_x64.dmg"}

    contracts = {
        "linux": linux,
        "macos-aarch64": macos_aarch64,
        "macos-x86_64": macos_x86_64,
        "all": linux | macos_aarch64 | macos_x86_64,
    }
    return contracts[platform]


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_assets(root: pathlib.Path) -> dict[str, Asset]:
    if not root.is_dir():
        raise VerificationError(f"asset directory does not exist: {root}")

    assets: dict[str, Asset] = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise VerificationError(f"symbolic links are not release assets: {path}")
        if not path.is_file():
            continue
        if path.name in assets:
            raise VerificationError(
                f"duplicate release asset basename: {path.name} "
                f"({assets[path.name].path} and {path})"
            )
        size = path.stat().st_size
        if size == 0:
            raise VerificationError(f"release asset is empty: {path.name}")
        assets[path.name] = Asset(path.name, path, size, sha256(path))
    return assets


def run_field(command: list[str], description: str) -> str:
    executable = command[0]
    if shutil.which(executable) is None:
        raise VerificationError(
            f"{description} requires {executable}, but it was not found on PATH"
        )
    completed = subprocess.run(
        command, check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if completed.returncode != 0:
        raise VerificationError(
            f"{description} failed: {completed.stderr.strip() or completed.stdout.strip()}"
        )
    return completed.stdout.strip()


def verify_package_metadata(assets: dict[str, Asset], version: str) -> None:
    app_deb = assets[f"CSV.Align_{version}_amd64.deb"].path
    setup_deb = assets["csv-align-repository-setup_1.0_all.deb"].path
    rpm_path = assets[f"csv-align-{version}-1.x86_64.rpm"].path

    for path, expected in [
        (app_deb, ("csv-align", version, "amd64")),
        (setup_deb, ("csv-align-repository-setup", "1.0", "all")),
    ]:
        actual = tuple(
            run_field(["dpkg-deb", "--field", str(path), field], f"{path.name} {field}")
            for field in ("Package", "Version", "Architecture")
        )
        if actual != expected:
            raise VerificationError(
                f"{path.name} package metadata {actual!r} does not match {expected!r}"
            )

    rpm_fields = run_field(
        [
            "rpm",
            "-qp",
            "--queryformat",
            "%{NAME}\n%{VERSION}\n%{RELEASE}\n%{ARCH}\n",
            str(rpm_path),
        ],
        f"{rpm_path.name} package metadata",
    ).splitlines()
    expected_rpm = ["csv-align", version, "1", "x86_64"]
    if rpm_fields != expected_rpm:
        raise VerificationError(
            f"{rpm_path.name} package metadata {rpm_fields!r} "
            f"does not match {expected_rpm!r}"
        )


def verify_setup_checksum(assets: dict[str, Asset]) -> None:
    setup = assets["csv-align-repository-setup_1.0_all.deb"]
    checksum_asset = assets["csv-align-repository-setup_1.0_all.deb.sha256"]
    fields = checksum_asset.path.read_text(encoding="utf-8").strip().split()
    if len(fields) != 2:
        raise VerificationError("setup package SHA-256 sidecar must contain digest and basename")
    digest, filename = fields
    filename = filename.lstrip("*")
    if filename != setup.name:
        raise VerificationError(
            f"setup package SHA-256 sidecar names {filename!r}, expected {setup.name!r}"
        )
    if not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
        raise VerificationError("setup package SHA-256 sidecar contains an invalid digest")
    if digest.lower() != setup.sha256:
        raise VerificationError("setup package SHA-256 sidecar does not match the package")


def validate_exact_set(
    assets: dict[str, Asset],
    expected: set[str],
    *,
    include_manifest: bool,
) -> None:
    if include_manifest:
        expected = expected | {MANIFEST_BASENAME}
    actual = set(assets)
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing: {', '.join(missing)}")
        if extra:
            details.append(f"extra: {', '.join(extra)}")
        raise VerificationError("release asset set is not exact (" + "; ".join(details) + ")")


def manifest_document(tag: str, version: str, assets: dict[str, Asset]) -> dict[str, object]:
    return {
        "schema_version": 1,
        "tag": tag,
        "version": version,
        "assets": [
            {"name": asset.name, "size": asset.size, "sha256": asset.sha256}
            for asset in sorted(assets.values(), key=lambda item: item.name)
            if asset.name != MANIFEST_BASENAME
        ],
    }


def write_manifest(path: pathlib.Path, document: dict[str, object]) -> None:
    if path.name != MANIFEST_BASENAME:
        raise VerificationError(f"manifest must be named {MANIFEST_BASENAME}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def verify_manifest(path: pathlib.Path, expected: dict[str, object]) -> None:
    try:
        actual = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise VerificationError(f"cannot read release manifest: {error}") from error
    if actual != expected:
        raise VerificationError("release asset manifest does not match the exact files, sizes, and SHA-256 hashes")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assets_dir", type=pathlib.Path)
    parser.add_argument("--tag", required=True)
    parser.add_argument(
        "--platform",
        choices=("linux", "macos-aarch64", "macos-x86_64", "all"),
        default="all",
    )
    manifest = parser.add_mutually_exclusive_group()
    manifest.add_argument("--write-manifest", action="store_true")
    manifest.add_argument("--verify-manifest", action="store_true")
    parser.add_argument("--verify-package-metadata", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    match = TAG_PATTERN.fullmatch(args.tag)
    if match is None:
        raise VerificationError(
            f"release tag must use vMAJOR.MINOR.PATCH with numeric components: {args.tag!r}"
        )
    version = match.group("version")
    expected = expected_names(version, args.platform)

    assets = collect_assets(args.assets_dir)
    validate_exact_set(assets, expected, include_manifest=args.verify_manifest)

    payload_assets = {
        name: asset for name, asset in assets.items() if name != MANIFEST_BASENAME
    }
    if args.platform in ("linux", "all"):
        verify_setup_checksum(payload_assets)
        if args.verify_package_metadata:
            verify_package_metadata(payload_assets, version)

    document = manifest_document(args.tag, version, payload_assets)
    manifest_path = args.assets_dir / MANIFEST_BASENAME
    if args.write_manifest:
        write_manifest(manifest_path, document)
        print(f"Wrote {manifest_path}")
    elif args.verify_manifest:
        verify_manifest(manifest_path, document)

    for asset in sorted(payload_assets.values(), key=lambda item: item.name):
        print(f"{asset.sha256}  {asset.size:>12}  {asset.name}")
    print(f"Verified {len(payload_assets)} release assets for {args.tag} ({args.platform}).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except VerificationError as error:
        print(f"release asset verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
