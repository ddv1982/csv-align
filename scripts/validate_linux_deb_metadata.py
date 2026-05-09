#!/usr/bin/env python3
"""Validate CSV Align Debian package metadata for Linux software centers.

The validator intentionally has a Python extraction path so it can inspect .deb
artifacts even on systems where dpkg-deb is unavailable.
"""

from __future__ import annotations

import argparse
import glob
import io
import json
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any


DEFAULT_COMPONENT_ID = "com.csvalign.desktop"
DEFAULT_LICENSE = "MIT"
DEFAULT_BINARY = "csv-align"
DEFAULT_DESKTOP_ID = "CSV Align.desktop"

REQUIRED_COPYRIGHT_PATH = pathlib.PurePosixPath("usr/share/doc/csv-align/copyright")


@dataclass
class ToolResult:
    name: str
    available: bool
    command: list[str] = field(default_factory=list)
    returncode: int | None = None
    stdout: str = ""
    stderr: str = ""

    @property
    def ok(self) -> bool:
        return self.available and self.returncode == 0

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "available": self.available,
            "command": self.command,
            "returncode": self.returncode,
            "stdout": self.stdout,
            "stderr": self.stderr,
        }


@dataclass
class PackageReport:
    package: str
    ok: bool = False
    extraction: str | None = None
    metainfo_path: str | None = None
    desktop_path: str | None = None
    copyright_path: str | None = None
    component_id: str | None = None
    metadata_license: str | None = None
    project_license: str | None = None
    launchable: str | None = None
    binary: str | None = None
    release_version: str | None = None
    release_date: str | None = None
    desktop_fields: dict[str, str] = field(default_factory=dict)
    detected_desktop_ids: list[str] = field(default_factory=list)
    appstream_validation: ToolResult | None = None
    desktop_validation: ToolResult | None = None
    errors: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "package": self.package,
            "ok": self.ok,
            "extraction": self.extraction,
            "metainfo_path": self.metainfo_path,
            "desktop_path": self.desktop_path,
            "copyright_path": self.copyright_path,
            "component_id": self.component_id,
            "metadata_license": self.metadata_license,
            "project_license": self.project_license,
            "launchable": self.launchable,
            "binary": self.binary,
            "release_version": self.release_version,
            "release_date": self.release_date,
            "desktop_fields": self.desktop_fields,
            "detected_desktop_ids": self.detected_desktop_ids,
            "appstream_validation": self.appstream_validation.to_json()
            if self.appstream_validation
            else None,
            "desktop_validation": self.desktop_validation.to_json()
            if self.desktop_validation
            else None,
            "errors": self.errors,
        }


def strip_ns(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def child_text(element: ET.Element, tag_name: str) -> str | None:
    for child in element:
        if strip_ns(child.tag) == tag_name and child.text:
            return child.text.strip()
    return None


def descendant_text(element: ET.Element, tag_name: str) -> str | None:
    for child in element.iter():
        if strip_ns(child.tag) == tag_name and child.text:
            return child.text.strip()
    return None


def launchable_desktop_id(element: ET.Element) -> str | None:
    for child in element.iter():
        if strip_ns(child.tag) == "launchable" and child.attrib.get("type") == "desktop-id":
            return (child.text or "").strip() or None
    return None


def first_release(element: ET.Element) -> tuple[str | None, str | None]:
    for child in element.iter():
        if strip_ns(child.tag) == "release":
            return child.attrib.get("version"), child.attrib.get("date")
    return None, None


def read_ar_entries(deb_path: pathlib.Path) -> dict[str, bytes]:
    entries: dict[str, bytes] = {}
    with deb_path.open("rb") as handle:
        if handle.read(8) != b"!<arch>\n":
            raise ValueError("not a Debian ar archive: missing global header")

        while True:
            header = handle.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:60] != b"`\n":
                raise ValueError("invalid ar member header")

            raw_name = header[:16].decode("utf-8", errors="replace").strip()
            try:
                size = int(header[48:58].decode("ascii").strip())
            except ValueError as error:
                raise ValueError("invalid ar member size") from error

            data = handle.read(size)
            if len(data) != size:
                raise ValueError("truncated ar member data")
            if size % 2 == 1:
                handle.read(1)

            name = raw_name.rstrip("/")
            entries[name] = data

    return entries


def safe_extract_tar(tar: tarfile.TarFile, destination: pathlib.Path) -> None:
    destination = destination.resolve()
    for member in tar.getmembers():
        member_path = destination / member.name
        try:
            target_path = member_path.resolve().relative_to(destination)
        except ValueError as error:
            raise ValueError(f"refusing unsafe tar member path: {member.name}") from error

        output_path = destination / target_path
        if member.isdir():
            output_path.mkdir(parents=True, exist_ok=True)
            continue
        if member.isreg():
            output_path.parent.mkdir(parents=True, exist_ok=True)
            source = tar.extractfile(member)
            if source is None:
                raise ValueError(f"could not read tar member: {member.name}")
            with source, output_path.open("wb") as handle:
                shutil.copyfileobj(source, handle)
            output_path.chmod(member.mode & 0o777)
            continue
        raise ValueError(f"refusing non-regular tar member: {member.name}")


def extract_data_archive(data_name: str, data: bytes, destination: pathlib.Path) -> str:
    if data_name.endswith(".tar.zst"):
        zstd_path = shutil.which("zstd")
        if not zstd_path:
            raise ValueError("data.tar.zst requires the zstd command for extraction")
        with tempfile.NamedTemporaryFile(suffix=".tar.zst") as archive, tempfile.NamedTemporaryFile(
            suffix=".tar"
        ) as decompressed:
            archive.write(data)
            archive.flush()
            completed = subprocess.run(
                [zstd_path, "-dc", archive.name],
                check=False,
                text=False,
                stdout=decompressed,
                stderr=subprocess.PIPE,
            )
            if completed.returncode != 0:
                raise ValueError(
                    "zstd failed to decompress data archive: "
                    + completed.stderr.decode("utf-8", errors="replace")
                )
            decompressed.flush()
            decompressed.seek(0)
            with tarfile.open(fileobj=decompressed, mode="r:") as tar:
                safe_extract_tar(tar, destination)
        return "python-ar+zstd+tarfile"

    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as tar:
        safe_extract_tar(tar, destination)
    return "python-ar+tarfile"


def extract_deb(deb_path: pathlib.Path, destination: pathlib.Path) -> str:
    entries = read_ar_entries(deb_path)
    data_member = next((name for name in entries if name.startswith("data.tar")), None)
    if not data_member:
        raise ValueError("Debian archive does not contain data.tar.*")
    return extract_data_archive(data_member, entries[data_member], destination)


def run_optional_tool(name: str, args: list[str]) -> ToolResult:
    executable = shutil.which(name)
    command = [name, *args]
    if not executable:
        return ToolResult(name=name, available=False, command=command)

    completed = subprocess.run(
        [executable, *args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return ToolResult(
        name=name,
        available=True,
        command=command,
        returncode=completed.returncode,
        stdout=completed.stdout.strip(),
        stderr=completed.stderr.strip(),
    )


def parse_desktop_file(path: pathlib.Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    in_desktop_entry = False
    for raw_line in path.read_text(encoding="utf-8").splitlines():
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


def exec_binary(exec_field: str | None) -> str | None:
    if not exec_field:
        return None
    return exec_field.strip().split(maxsplit=1)[0] or None


def require_equal(errors: list[str], label: str, actual: str | None, expected: str) -> None:
    if actual != expected:
        errors.append(f"{label} mismatch: expected {expected!r}, got {actual!r}")


def require_present_equal(
    errors: list[str], label: str, actual: str | None, expected: str
) -> None:
    if actual is None:
        errors.append(f"{label} is missing; expected {expected!r}")
    else:
        require_equal(errors, label, actual, expected)


def require_file(errors: list[str], root: pathlib.Path, relative_path: pathlib.PurePosixPath) -> pathlib.Path:
    path = root / pathlib.Path(*relative_path.parts)
    if not path.is_file():
        errors.append(f"missing required file: /{relative_path}")
    return path


def validate_package(
    deb_path: pathlib.Path,
    expected_component_id: str,
    expected_license: str,
    expected_binary: str,
    expected_desktop_id: str,
    investigate: bool,
    run_external_tools: bool,
    require_external_tools: bool,
) -> PackageReport:
    report = PackageReport(package=str(deb_path))
    metainfo_rel = pathlib.PurePosixPath(
        f"usr/share/metainfo/{expected_component_id}.metainfo.xml"
    )
    desktop_rel = pathlib.PurePosixPath(f"usr/share/applications/{expected_desktop_id}")

    with tempfile.TemporaryDirectory(prefix="csv-align-deb-metadata-") as temp:
        extract_root = pathlib.Path(temp)
        try:
            report.extraction = extract_deb(deb_path, extract_root)
        except Exception as error:  # noqa: BLE001 - surface concise validator failure
            report.errors.append(f"failed to extract {deb_path}: {error}")
            return report

        applications_dir = extract_root / "usr/share/applications"
        if applications_dir.is_dir():
            report.detected_desktop_ids = sorted(
                path.name for path in applications_dir.glob("*.desktop")
            )

        metainfo_path = require_file(report.errors, extract_root, metainfo_rel)
        if investigate:
            expected_desktop_path = extract_root / pathlib.Path(*desktop_rel.parts)
            if expected_desktop_path.is_file():
                desktop_path = expected_desktop_path
            elif report.detected_desktop_ids:
                desktop_path = applications_dir / report.detected_desktop_ids[0]
            else:
                desktop_path = expected_desktop_path
                report.errors.append("missing required desktop file under /usr/share/applications")
        else:
            desktop_path = require_file(report.errors, extract_root, desktop_rel)
        copyright_path = require_file(report.errors, extract_root, REQUIRED_COPYRIGHT_PATH)

        if metainfo_path.is_file():
            report.metainfo_path = f"/{metainfo_rel}"
            try:
                root = ET.parse(metainfo_path).getroot()
                report.component_id = child_text(root, "id")
                report.metadata_license = child_text(root, "metadata_license")
                report.project_license = child_text(root, "project_license")
                report.launchable = launchable_desktop_id(root)
                report.binary = descendant_text(root, "binary")
                report.release_version, report.release_date = first_release(root)
            except ET.ParseError as error:
                report.errors.append(f"invalid AppStream XML in /{metainfo_rel}: {error}")

            require_present_equal(
                report.errors, "AppStream component id", report.component_id, expected_component_id
            )
            require_present_equal(
                report.errors,
                "AppStream metadata_license",
                report.metadata_license,
                expected_license,
            )
            require_present_equal(
                report.errors,
                "AppStream project_license",
                report.project_license,
                expected_license,
            )
            require_present_equal(
                report.errors, "AppStream provides binary", report.binary, expected_binary
            )
            if report.launchable is None:
                report.errors.append(
                    f"AppStream desktop launchable is missing; expected {expected_desktop_id!r}"
                )
            elif not investigate:
                require_equal(
                    report.errors,
                    "AppStream desktop launchable",
                    report.launchable,
                    expected_desktop_id,
                )

            if run_external_tools:
                report.appstream_validation = run_optional_tool(
                    "appstreamcli", ["validate", "--no-net", str(metainfo_path)]
                )
                if not report.appstream_validation.available:
                    if require_external_tools:
                        report.errors.append(
                            "appstreamcli is required for gate validation but was not found"
                        )
                elif not report.appstream_validation.ok:
                    report.errors.append(
                        "appstreamcli validate --no-net failed for "
                        f"/{metainfo_rel} (exit {report.appstream_validation.returncode})"
                    )

        if desktop_path.is_file():
            desktop_rel_actual = pathlib.PurePosixPath(
                *desktop_path.relative_to(extract_root).parts
            )
            report.desktop_path = f"/{desktop_rel_actual}"
            report.desktop_fields = parse_desktop_file(desktop_path)
            require_equal(
                report.errors,
                "desktop Exec binary",
                exec_binary(report.desktop_fields.get("Exec")),
                expected_binary,
            )
            if report.desktop_fields.get("Name") is None:
                report.errors.append(f"desktop file {report.desktop_path} is missing Name")
            if report.desktop_fields.get("Icon") is None:
                report.errors.append(f"desktop file {report.desktop_path} is missing Icon")

            if run_external_tools:
                report.desktop_validation = run_optional_tool(
                    "desktop-file-validate", [str(desktop_path)]
                )
                if not report.desktop_validation.available:
                    if require_external_tools:
                        report.errors.append(
                            "desktop-file-validate is required for gate validation but was not found"
                        )
                elif not report.desktop_validation.ok:
                    report.errors.append(
                        "desktop-file-validate failed for "
                        f"{report.desktop_path} (exit {report.desktop_validation.returncode})"
                    )

        if copyright_path.is_file():
            report.copyright_path = f"/{REQUIRED_COPYRIGHT_PATH}"
            copyright = copyright_path.read_text(encoding="utf-8", errors="replace")
            if f"License: {expected_license}" not in copyright:
                report.errors.append(
                    f"Debian copyright is missing `License: {expected_license}`"
                )

        if not investigate and expected_desktop_id not in report.detected_desktop_ids:
            report.errors.append(
                "required desktop-id contract not found in package desktop files: "
                f"{expected_desktop_id!r}; detected {report.detected_desktop_ids!r}"
            )

        report.ok = not report.errors
        return report


def expand_deb_patterns(patterns: list[str]) -> list[pathlib.Path]:
    paths: list[pathlib.Path] = []
    for pattern in patterns:
        matches = sorted(glob.glob(pattern))
        if matches:
            paths.extend(pathlib.Path(match) for match in matches)
        else:
            candidate = pathlib.Path(pattern)
            if candidate.exists():
                paths.append(candidate)
    return sorted({path.resolve() for path in paths})


def print_summary(report: PackageReport, investigate: bool) -> None:
    status = "PASS" if report.ok else "FAIL"
    print(f"[{status}] {report.package}")
    if report.detected_desktop_ids:
        print(f"  detected desktop ids: {', '.join(report.detected_desktop_ids)}")
    if report.metainfo_path:
        print(
            "  AppStream: "
            f"id={report.component_id!r} license={report.project_license!r} "
            f"launchable={report.launchable!r} binary={report.binary!r} "
            f"release={report.release_version!r}"
        )
    if report.desktop_path:
        print(
            "  Desktop: "
            f"Name={report.desktop_fields.get('Name')!r} "
            f"Exec={report.desktop_fields.get('Exec')!r} "
            f"Icon={report.desktop_fields.get('Icon')!r} "
            f"StartupWMClass={report.desktop_fields.get('StartupWMClass')!r}"
        )
    for tool in [report.appstream_validation, report.desktop_validation]:
        if tool is None:
            continue
        if tool.available:
            tool_status = "ok" if tool.ok else f"exit {tool.returncode}"
            print(f"  {tool.name}: {tool_status}")
        else:
            print(f"  {tool.name}: skipped (not installed)")
    if investigate and report.detected_desktop_ids:
        print("  investigation mode: desktop-id mismatches are reported but not enforced")
    for error in report.errors:
        print(f"  error: {error}", file=sys.stderr)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate Linux .deb AppStream, desktop-file, and license metadata."
    )
    parser.add_argument("deb", nargs="+", help=".deb artifact path or glob")
    parser.add_argument(
        "--expected-component-id", default=DEFAULT_COMPONENT_ID, help="expected AppStream id"
    )
    parser.add_argument(
        "--expected-license", default=DEFAULT_LICENSE, help="expected AppStream project license"
    )
    parser.add_argument(
        "--expected-binary", default=DEFAULT_BINARY, help="expected main binary name"
    )
    parser.add_argument(
        "--expected-desktop-id",
        default=DEFAULT_DESKTOP_ID,
        help="expected desktop file basename / AppStream launchable desktop-id",
    )
    parser.add_argument(
        "--investigate",
        action="store_true",
        help="print detected desktop ids without enforcing the expected desktop-id",
    )
    parser.add_argument("--json-report", help="optional path to write a JSON validation report")
    parser.add_argument(
        "--skip-external-tools",
        action="store_true",
        help="skip appstreamcli and desktop-file-validate (intended for synthetic test fixtures)",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    deb_paths = expand_deb_patterns(args.deb)
    if not deb_paths:
        print("error: no .deb artifacts matched the supplied path/glob", file=sys.stderr)
        return 2

    reports = [
        validate_package(
            deb_path=deb_path,
            expected_component_id=args.expected_component_id,
            expected_license=args.expected_license,
            expected_binary=args.expected_binary,
            expected_desktop_id=args.expected_desktop_id,
            investigate=args.investigate,
            run_external_tools=not args.skip_external_tools,
            require_external_tools=not args.skip_external_tools and not args.investigate,
        )
        for deb_path in deb_paths
    ]

    for report in reports:
        print_summary(report, args.investigate)

    payload = {
        "ok": all(report.ok for report in reports),
        "gate": not args.investigate,
        "external_validation": {
            "enabled": not args.skip_external_tools,
            "required": not args.skip_external_tools and not args.investigate,
            "missing_tools_allowed": args.skip_external_tools or args.investigate,
        },
        "expected": {
            "component_id": args.expected_component_id,
            "license": args.expected_license,
            "binary": args.expected_binary,
            "desktop_id": args.expected_desktop_id,
        },
        "packages": [report.to_json() for report in reports],
    }

    if args.json_report:
        report_path = pathlib.Path(args.json_report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Wrote JSON report: {report_path}")

    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
