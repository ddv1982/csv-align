#!/usr/bin/env python3
"""Build a minimal signed CSV Align APT repository from .deb artifacts.

The generated tree is intentionally static-hosting friendly:

  pool/main/c/csv-align/*.deb
  dists/<suite>/Release
  dists/<suite>/InRelease
  dists/<suite>/Release.gpg
  dists/<suite>/main/binary-<arch>/Packages[.gz]
  dists/<suite>/main/dep11/Components-<arch>.yml[.gz]

Repository signing is the default. Use --unsigned only for local fixtures/tests.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import html
import io
import pathlib
import shutil
import subprocess
import sys
import tarfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.parser import Parser
from email.utils import format_datetime


DEFAULT_SUITE = "stable"
DEFAULT_COMPONENT = "main"
DEFAULT_PACKAGE = "csv-align"
DEFAULT_COMPONENT_ID = "com.csvalign.desktop"
DEFAULT_ORIGIN = "csv-align-stable-main"
DEFAULT_LABEL = "CSV Align"
DEFAULT_DESCRIPTION = "CSV Align APT repository"


@dataclass(frozen=True)
class DebPackage:
    pool_path: pathlib.PurePosixPath
    package: str
    architecture: str
    fields: dict[str, str]
    size: int
    md5: str
    sha1: str
    sha256: str
    metainfo_xml: bytes
    desktop_fields: dict[str, str]


def read_ar_entries(deb_path: pathlib.Path) -> dict[str, bytes]:
    entries: dict[str, bytes] = {}
    with deb_path.open("rb") as handle:
        if handle.read(8) != b"!<arch>\n":
            raise ValueError(f"{deb_path} is not a Debian ar archive")
        while True:
            header = handle.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:60] != b"`\n":
                raise ValueError(f"{deb_path} has an invalid ar member header")
            raw_name = header[:16].decode("utf-8", errors="replace").strip()
            try:
                size = int(header[48:58].decode("ascii").strip())
            except ValueError as error:
                raise ValueError(f"{deb_path} has an invalid ar member size") from error
            data = handle.read(size)
            if len(data) != size:
                raise ValueError(f"{deb_path} has a truncated ar member")
            if size % 2 == 1:
                handle.read(1)
            entries[raw_name.rstrip("/")] = data
    return entries


def extract_tar_member(archive_name: str, data: bytes, predicate) -> dict[str, bytes]:
    if archive_name.endswith(".tar.zst"):
        zstd = shutil.which("zstd")
        if not zstd:
            raise ValueError(".deb uses zstd-compressed tar members; zstd command is required")
        completed = subprocess.run(
            [zstd, "-dc"],
            input=data,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if completed.returncode != 0:
            raise ValueError(completed.stderr.decode("utf-8", errors="replace"))
        data = completed.stdout
        mode = "r:"
    else:
        mode = "r:*"

    found: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode=mode) as tar:
        for member in tar.getmembers():
            normalized = member.name.removeprefix("./")
            if not member.isfile() or not predicate(normalized):
                continue
            extracted = tar.extractfile(member)
            if extracted is None:
                continue
            found[normalized] = extracted.read()
    return found


def parse_control(control_bytes: bytes) -> dict[str, str]:
    message = Parser().parsestr(control_bytes.decode("utf-8", errors="replace"))
    return {key: value for key, value in message.items()}


def parse_desktop_file(data: bytes) -> dict[str, str]:
    fields: dict[str, str] = {}
    in_desktop_entry = False
    for raw_line in data.decode("utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            in_desktop_entry = line == "[Desktop Entry]"
            continue
        if in_desktop_entry and "=" in line:
            key, value = line.split("=", 1)
            fields[key] = value
    return fields


def deb_control_metainfo_and_desktop(deb_path: pathlib.Path) -> tuple[dict[str, str], bytes, dict[str, str]]:
    entries = read_ar_entries(deb_path)
    control_name = next((name for name in entries if name.startswith("control.tar")), None)
    data_name = next((name for name in entries if name.startswith("data.tar")), None)
    if not control_name or not data_name:
        raise ValueError(f"{deb_path} must contain control.tar.* and data.tar.*")

    control_files = extract_tar_member(control_name, entries[control_name], lambda name: name == "control")
    if "control" not in control_files:
        raise ValueError(f"{deb_path} control archive does not contain control")

    data_files = extract_tar_member(
        data_name,
        entries[data_name],
        lambda name: (
            (name.startswith("usr/share/metainfo/") and name.endswith(".metainfo.xml"))
            or (name.startswith("usr/share/applications/") and name.endswith(".desktop"))
        ),
    )
    metainfo_name = f"usr/share/metainfo/{DEFAULT_COMPONENT_ID}.metainfo.xml"
    metainfo = data_files.get(metainfo_name) or next(
        (data for name, data in data_files.items() if name.endswith(".metainfo.xml")), None
    )
    if metainfo is None:
        raise ValueError(f"{deb_path} does not contain AppStream metainfo")

    desktop = next((data for name, data in data_files.items() if name.endswith(".desktop")), None)
    if desktop is None:
        raise ValueError(f"{deb_path} does not contain a desktop file")

    return parse_control(control_files["control"]), metainfo, parse_desktop_file(desktop)


def package_stanza(package: DebPackage) -> str:
    fields = dict(package.fields)
    fields["Filename"] = str(package.pool_path)
    fields["Size"] = str(package.size)
    fields["MD5sum"] = package.md5
    fields["SHA1"] = package.sha1
    fields["SHA256"] = package.sha256
    preferred = [
        "Package",
        "Version",
        "Architecture",
        "Maintainer",
        "Installed-Size",
        "Depends",
        "Section",
        "Priority",
        "Homepage",
        "Description",
        "Filename",
        "Size",
        "MD5sum",
        "SHA1",
        "SHA256",
    ]
    lines: list[str] = []
    emitted: set[str] = set()
    for key in preferred:
        if key in fields:
            lines.append(format_deb822_field(key, fields[key]))
            emitted.add(key)
    for key in sorted(fields):
        if key not in emitted:
            lines.append(format_deb822_field(key, fields[key]))
    return "\n".join(lines) + "\n"


def format_deb822_field(key: str, value: str) -> str:
    value = value.rstrip("\n")
    if "\n" not in value:
        return f"{key}: {value}"
    first, *rest = value.splitlines()
    return "\n".join([f"{key}: {first}", *(f" {line}" for line in rest)])


def strip_ns(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def child_text(element: ET.Element, tag: str) -> str:
    for child in element:
        if strip_ns(child.tag) == tag and child.text:
            return child.text.strip()
    return ""


def descendant_text(element: ET.Element, tag: str) -> str:
    for child in element.iter():
        if strip_ns(child.tag) == tag and child.text:
            return child.text.strip()
    return ""


def launchable_desktop_id(element: ET.Element) -> str:
    for child in element.iter():
        if strip_ns(child.tag) == "launchable" and child.attrib.get("type") == "desktop-id":
            return (child.text or "").strip()
    return ""


def homepage_url(element: ET.Element) -> str:
    for child in element.iter():
        if strip_ns(child.tag) == "url" and child.attrib.get("type") == "homepage":
            return (child.text or "").strip()
    return ""


def first_release(element: ET.Element) -> tuple[str, str]:
    for child in element.iter():
        if strip_ns(child.tag) == "release":
            return child.attrib.get("version", ""), child.attrib.get("date", "")
    return "", ""


def description_markup(element: ET.Element) -> str:
    for child in element:
        if strip_ns(child.tag) != "description":
            continue
        paragraphs = [" ".join(part.strip() for part in p.itertext() if part.strip()) for p in child]
        paragraphs = [p for p in paragraphs if p]
        if paragraphs:
            return "".join(f"<p>{html.escape(paragraph)}</p>" for paragraph in paragraphs)
        text = " ".join(part.strip() for part in child.itertext() if part.strip())
        return f"<p>{html.escape(text)}</p>" if text else ""
    return ""


def yaml_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def yaml_literal_block(lines: list[str], indent: str = "    ") -> list[str]:
    if not lines:
        return [f"{indent}"]
    return [f"{indent}{line}" for line in lines]


def categories_from_desktop(fields: dict[str, str]) -> list[str]:
    categories = fields.get("Categories", "")
    return [category for category in categories.split(";") if category]


def dep11_yaml_header(origin: str, architecture: str) -> str:
    return "\n".join(
        [
            "---",
            "File: DEP-11",
            "Version: '1.0'",
            f"Origin: {yaml_quote(origin)}",
            f"Architecture: {yaml_quote(architecture)}",
        ]
    ) + "\n"


def dep11_yaml_component(package: DebPackage) -> str:
    root = ET.fromstring(package.metainfo_xml)
    component_id = child_text(root, "id")
    project_license = child_text(root, "project_license")
    metadata_license = child_text(root, "metadata_license")
    name = child_text(root, "name")
    summary = child_text(root, "summary")
    launchable = launchable_desktop_id(root)
    binary = descendant_text(root, "binary") or package.fields.get("Package", "")
    homepage = homepage_url(root)
    release_version, release_date = first_release(root)
    description = description_markup(root)
    categories = categories_from_desktop(package.desktop_fields)
    icon = package.desktop_fields.get("Icon", "")

    if not component_id or not name or not summary or not launchable:
        raise ValueError("AppStream metainfo must contain id, name, summary, and launchable")
    if not project_license:
        raise ValueError("AppStream metainfo must contain project_license")

    lines = [
        "---",
        "Type: desktop-application",
        f"ID: {yaml_quote(component_id)}",
        f"Package: {yaml_quote(package.package)}",
        f"ProjectLicense: {yaml_quote(project_license)}",
    ]
    if metadata_license:
        lines.append(f"MetadataLicense: {yaml_quote(metadata_license)}")
    lines.extend(["Name:", f"  C: {yaml_quote(name)}"])
    lines.extend(["Summary:", f"  C: {yaml_quote(summary)}"])
    if description:
        lines.extend(["Description:", "  C: |", *yaml_literal_block(description.splitlines())])
    if homepage:
        lines.extend(["Url:", f"  homepage: {yaml_quote(homepage)}"])
    if icon:
        lines.extend(["Icon:", f"  stock: {yaml_quote(icon)}"])
    if categories:
        lines.append("Categories:")
        lines.extend(f"  - {yaml_quote(category)}" for category in categories)
    lines.extend(["Launchable:", "  desktop-id:", f"    - {yaml_quote(launchable)}"])
    if binary:
        lines.extend(["Provides:", "  binaries:", f"    - {yaml_quote(binary)}"])
    if release_version:
        lines.extend(["Releases:", f"  - version: {yaml_quote(release_version)}"])
        if release_date:
            lines.append(f"    date: {yaml_quote(release_date)}")
    return "\n".join(lines) + "\n"


def gzip_write(path: pathlib.Path, data: bytes) -> None:
    with path.open("wb") as handle:
        with gzip.GzipFile(filename="", mode="wb", fileobj=handle, mtime=0) as gz:
            gz.write(data)


def file_hashes(path: pathlib.Path) -> tuple[str, str, str, int]:
    data = path.read_bytes()
    return (
        hashlib.md5(data, usedforsecurity=False).hexdigest(),
        hashlib.sha1(data, usedforsecurity=False).hexdigest(),
        hashlib.sha256(data).hexdigest(),
        len(data),
    )


def release_file(repo_root: pathlib.Path, args: argparse.Namespace, architectures: list[str]) -> str:
    dists_root = repo_root / "dists" / args.suite
    targets = sorted(
        path
        for path in dists_root.rglob("*")
        if path.is_file() and path.name not in {"Release", "InRelease", "Release.gpg"}
    )
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    lines = [
        f"Origin: {args.origin}",
        f"Label: {args.label}",
        f"Suite: {args.suite}",
        f"Codename: {args.suite}",
        f"Date: {format_datetime(now, usegmt=True)}",
        f"Architectures: {' '.join(architectures)}",
        f"Components: {args.component}",
        f"Description: {args.description}",
    ]
    hash_rows = [(path.relative_to(dists_root).as_posix(), *file_hashes(path)) for path in targets]
    for section, index in [("MD5Sum", 1), ("SHA1", 2), ("SHA256", 3)]:
        lines.append(f"{section}:")
        for row in hash_rows:
            relative = row[0]
            digest = row[index]
            size = row[4]
            lines.append(f" {digest} {size:16d} {relative}")
    return "\n".join(lines) + "\n"


def gpg_base(args: argparse.Namespace) -> list[str]:
    gpg = shutil.which("gpg")
    if not gpg:
        raise RuntimeError("gpg is required for signed repository generation")
    base = [gpg, "--batch", "--yes", "--pinentry-mode", "loopback"]
    if args.gpg_homedir:
        base.extend(["--homedir", args.gpg_homedir])
    if args.gpg_passphrase_file:
        base.extend(["--passphrase-file", args.gpg_passphrase_file])
    if args.gpg_key:
        base.extend(["--local-user", args.gpg_key])
    return base


def sign_release(args: argparse.Namespace, release_path: pathlib.Path) -> None:
    base = gpg_base(args)
    subprocess.run(
        [*base, "--clearsign", "--output", str(release_path.with_name("InRelease")), str(release_path)],
        check=True,
    )
    subprocess.run(
        [*base, "--detach-sign", "--armor", "--output", str(release_path.with_name("Release.gpg")), str(release_path)],
        check=True,
    )


def export_public_key(args: argparse.Namespace) -> None:
    if not args.public_key_out:
        return
    base = gpg_base(args)
    output = pathlib.Path(args.public_key_out)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as handle:
        subprocess.run([*base, "--export", args.gpg_key], check=True, stdout=handle)


def collect_package(deb_path: pathlib.Path, pool_path: pathlib.PurePosixPath) -> DebPackage:
    fields, metainfo, desktop_fields = deb_control_metainfo_and_desktop(deb_path)
    package = fields.get("Package")
    version = fields.get("Version")
    arch = fields.get("Architecture")
    if not package or not version or not arch:
        raise ValueError(f"{deb_path} control file must declare Package, Version, and Architecture")
    data = deb_path.read_bytes()
    return DebPackage(
        pool_path=pool_path,
        package=package,
        architecture=arch,
        fields=fields,
        size=len(data),
        md5=hashlib.md5(data, usedforsecurity=False).hexdigest(),
        sha1=hashlib.sha1(data, usedforsecurity=False).hexdigest(),
        sha256=hashlib.sha256(data).hexdigest(),
        metainfo_xml=metainfo,
        desktop_fields=desktop_fields,
    )


def build_repository(args: argparse.Namespace) -> None:
    repo_root = pathlib.Path(args.output).resolve()
    if args.clean and repo_root.exists():
        shutil.rmtree(repo_root)
    repo_root.mkdir(parents=True, exist_ok=True)

    packages: list[DebPackage] = []
    for deb in args.deb:
        source = pathlib.Path(deb).resolve()
        if not source.is_file():
            raise ValueError(f"missing .deb artifact: {source}")
        pool_rel = pathlib.PurePosixPath("pool/main/c/csv-align") / source.name
        destination = repo_root / pool_rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        packages.append(collect_package(destination, pool_rel))

    by_arch: dict[str, list[DebPackage]] = {}
    for package in packages:
        if package.package != DEFAULT_PACKAGE:
            raise ValueError(f"unexpected package {package.package!r}; expected {DEFAULT_PACKAGE!r}")
        by_arch.setdefault(package.architecture, []).append(package)

    for arch, arch_packages in sorted(by_arch.items()):
        binary_dir = repo_root / "dists" / args.suite / args.component / f"binary-{arch}"
        binary_dir.mkdir(parents=True, exist_ok=True)
        packages_text = "\n".join(package_stanza(package) for package in arch_packages)
        packages_bytes = packages_text.encode("utf-8")
        (binary_dir / "Packages").write_bytes(packages_bytes)
        gzip_write(binary_dir / "Packages.gz", packages_bytes)

        dep11_dir = repo_root / "dists" / args.suite / args.component / "dep11"
        dep11_dir.mkdir(parents=True, exist_ok=True)
        dep11_text = dep11_yaml_header(args.origin, arch) + "".join(
            dep11_yaml_component(package) for package in arch_packages
        )
        dep11_bytes = dep11_text.encode("utf-8")
        dep11_path = dep11_dir / f"Components-{arch}.yml"
        dep11_path.write_bytes(dep11_bytes)
        gzip_write(dep11_path.with_suffix(dep11_path.suffix + ".gz"), dep11_bytes)

    release_path = repo_root / "dists" / args.suite / "Release"
    release_path.write_text(release_file(repo_root, args, sorted(by_arch)), encoding="utf-8")

    if args.unsigned:
        return
    sign_release(args, release_path)
    export_public_key(args)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build a minimal signed CSV Align APT repository.")
    parser.add_argument("deb", nargs="+", help="built .deb artifact(s) to publish")
    parser.add_argument("--output", required=True, help="repository output directory")
    parser.add_argument("--suite", default=DEFAULT_SUITE, help="APT suite/codename (default: stable)")
    parser.add_argument("--component", default=DEFAULT_COMPONENT, help="APT component (default: main)")
    parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Release/DEP-11 origin")
    parser.add_argument("--label", default=DEFAULT_LABEL, help="Release label")
    parser.add_argument("--description", default=DEFAULT_DESCRIPTION, help="Release description")
    parser.add_argument("--gpg-key", help="GPG key id/fingerprint used for signing")
    parser.add_argument("--gpg-homedir", help="GPG home directory containing the signing key")
    parser.add_argument("--gpg-passphrase-file", help="optional passphrase file for loopback signing")
    parser.add_argument("--public-key-out", help="optional path for binary gpg --export output")
    parser.add_argument("--clean", action="store_true", help="remove output directory before generating")
    parser.add_argument(
        "--unsigned",
        action="store_true",
        help="generate repository metadata without InRelease/Release.gpg (local tests only)",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()
    if not args.unsigned and not args.gpg_key:
        parser.error(
            "signed generation is the default; pass --gpg-key (and optionally --gpg-homedir), "
            "or --unsigned for local/test repositories"
        )
    if args.unsigned and args.public_key_out:
        parser.error("--public-key-out requires signed generation")
    try:
        build_repository(args)
    except Exception as error:  # noqa: BLE001 - CLI should surface concise failures
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
