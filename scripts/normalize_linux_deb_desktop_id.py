#!/usr/bin/env python3
"""Normalize CSV Align Debian packages to a reverse-DNS desktop-id contract.

Tauri v2 currently emits Debian desktop files using the configured productName
(`CSV Align.desktop`). AppStream/GNOME Software are more robust when the
launchable desktop id is a stable reverse-DNS basename
(`com.csvalign.desktop.desktop`). This script rewrites unsigned .deb artifacts
after Tauri builds them and before metadata validation/signing.
"""

from __future__ import annotations

import argparse
import bz2
import glob
import gzip
import hashlib
import io
import lzma
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass


DEFAULT_COMPONENT_ID = "com.csvalign.desktop"
DEFAULT_SOURCE_DESKTOP_ID = "CSV Align.desktop"
DEFAULT_TARGET_DESKTOP_ID = "com.csvalign.desktop.desktop"


@dataclass
class ArMember:
    name: str
    data: bytes
    header_name: str
    mtime: str
    owner: str
    group: str
    mode: str


def strip_ns(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def read_ar(path: pathlib.Path) -> list[ArMember]:
    members: list[ArMember] = []
    with path.open("rb") as handle:
        if handle.read(8) != b"!<arch>\n":
            raise ValueError(f"{path} is not a Debian ar archive")

        while True:
            header = handle.read(60)
            if not header:
                break
            if len(header) != 60 or header[58:60] != b"`\n":
                raise ValueError(f"{path} has an invalid ar member header")

            header_name = header[:16].decode("utf-8", errors="replace")
            raw_name = header_name.strip()
            try:
                size = int(header[48:58].decode("ascii").strip())
            except ValueError as error:
                raise ValueError(f"{path} has an invalid ar member size") from error

            data = handle.read(size)
            if len(data) != size:
                raise ValueError(f"{path} has a truncated ar member")
            if size % 2 == 1:
                handle.read(1)

            members.append(
                ArMember(
                    name=raw_name.rstrip("/"),
                    data=data,
                    header_name=raw_name,
                    mtime=header[16:28].decode("ascii", errors="replace").strip() or "0",
                    owner=header[28:34].decode("ascii", errors="replace").strip() or "0",
                    group=header[34:40].decode("ascii", errors="replace").strip() or "0",
                    mode=header[40:48].decode("ascii", errors="replace").strip() or "100644",
                )
            )
    return members


def write_ar(path: pathlib.Path, members: list[ArMember]) -> None:
    with path.open("wb") as handle:
        handle.write(b"!<arch>\n")
        for member in members:
            encoded_name = member.header_name.encode("utf-8")
            if len(encoded_name) > 16:
                raise ValueError(f"ar member name is too long for legacy ar header: {member.name}")
            header = (
                encoded_name.ljust(16, b" ")
                + member.mtime.encode("ascii").ljust(12, b" ")
                + member.owner.encode("ascii").ljust(6, b" ")
                + member.group.encode("ascii").ljust(6, b" ")
                + member.mode.encode("ascii").ljust(8, b" ")
                + str(len(member.data)).encode("ascii").ljust(10, b" ")
                + b"`\n"
            )
            handle.write(header)
            handle.write(member.data)
            if len(member.data) % 2 == 1:
                handle.write(b"\n")


def compression_kind(member_name: str) -> str:
    suffixes = {
        ".tar.gz": "gz",
        ".tar.xz": "xz",
        ".tar.bz2": "bz2",
        ".tar.zst": "zst",
        ".tar": "none",
    }
    for suffix, kind in suffixes.items():
        if member_name.endswith(suffix):
            return kind
    raise ValueError(f"unsupported Debian tar member compression: {member_name}")


def decompress(member_name: str, data: bytes) -> bytes:
    kind = compression_kind(member_name)
    if kind == "gz":
        return gzip.decompress(data)
    if kind == "xz":
        return lzma.decompress(data)
    if kind == "bz2":
        return bz2.decompress(data)
    if kind == "zst":
        zstd = shutil.which("zstd")
        if not zstd:
            raise ValueError("data.tar.zst/control.tar.zst requires the zstd command")
        completed = subprocess.run(
            [zstd, "-dc"],
            input=data,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if completed.returncode != 0:
            raise ValueError(
                "zstd decompression failed: "
                + completed.stderr.decode("utf-8", errors="replace").strip()
            )
        return completed.stdout
    return data


def compress(member_name: str, data: bytes) -> bytes:
    kind = compression_kind(member_name)
    if kind == "gz":
        return gzip.compress(data, mtime=0)
    if kind == "xz":
        return lzma.compress(data)
    if kind == "bz2":
        return bz2.compress(data)
    if kind == "zst":
        zstd = shutil.which("zstd")
        if not zstd:
            raise ValueError("writing .tar.zst requires the zstd command")
        completed = subprocess.run(
            [zstd, "-q", "-19", "-c"],
            input=data,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if completed.returncode != 0:
            raise ValueError(
                "zstd compression failed: "
                + completed.stderr.decode("utf-8", errors="replace").strip()
            )
        return completed.stdout
    return data


def read_tar(member_name: str, data: bytes) -> list[tuple[tarfile.TarInfo, bytes | None]]:
    tar_bytes = decompress(member_name, data)
    entries: list[tuple[tarfile.TarInfo, bytes | None]] = []
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as tar:
        for entry in tar.getmembers():
            payload = tar.extractfile(entry).read() if entry.isreg() else None
            entries.append((entry, payload))
    return entries


def write_tar(member_name: str, entries: list[tuple[tarfile.TarInfo, bytes | None]]) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:") as tar:
        for entry, payload in entries:
            cloned = tarfile.TarInfo(entry.name)
            cloned.mode = entry.mode
            cloned.uid = entry.uid
            cloned.gid = entry.gid
            cloned.uname = entry.uname
            cloned.gname = entry.gname
            cloned.mtime = entry.mtime
            cloned.type = entry.type
            cloned.linkname = entry.linkname
            cloned.devmajor = entry.devmajor
            cloned.devminor = entry.devminor
            if entry.isreg():
                data = payload or b""
                cloned.size = len(data)
                tar.addfile(cloned, io.BytesIO(data))
            else:
                tar.addfile(cloned)
    return compress(member_name, output.getvalue())


def normalize_tar_name(name: str) -> str:
    return name[2:] if name.startswith("./") else name


def display_tar_name(name: str) -> str:
    return name if name.startswith("./") else f"./{name}"


def rewrite_appstream_launchable(xml_bytes: bytes, target_desktop_id: str) -> bytes:
    root = ET.fromstring(xml_bytes)
    changed = False
    for child in root.iter():
        if strip_ns(child.tag) == "launchable" and child.attrib.get("type") == "desktop-id":
            if (child.text or "").strip() != target_desktop_id:
                child.text = target_desktop_id
                changed = True
            break
    else:
        raise ValueError("AppStream metainfo has no launchable type=\"desktop-id\" element")

    if not changed and target_desktop_id.encode("utf-8") in xml_bytes:
        return xml_bytes

    ET.indent(root, space="  ")
    return (
        b'<?xml version="1.0" encoding="UTF-8"?>\n'
        + ET.tostring(root, encoding="utf-8")
        + b"\n"
    )


def rewrite_data_entries(
    entries: list[tuple[tarfile.TarInfo, bytes | None]],
    component_id: str,
    source_desktop_id: str,
    target_desktop_id: str,
) -> tuple[list[tuple[tarfile.TarInfo, bytes | None]], list[str]]:
    source_path = f"usr/share/applications/{source_desktop_id}"
    target_path = f"usr/share/applications/{target_desktop_id}"
    metainfo_path = f"usr/share/metainfo/{component_id}.metainfo.xml"
    seen_target = False
    renamed = False
    launchable_rewritten = False
    rewritten: list[tuple[tarfile.TarInfo, bytes | None]] = []

    for entry, payload in entries:
        normalized = normalize_tar_name(entry.name)
        if normalized == target_path:
            seen_target = True
        if normalized == source_path:
            entry = clone_tarinfo(entry, display_tar_name(target_path))
            renamed = True
            seen_target = True
        if normalized == metainfo_path:
            if payload is None:
                raise ValueError(f"{metainfo_path} is not a regular file")
            new_payload = rewrite_appstream_launchable(payload, target_desktop_id)
            launchable_rewritten = new_payload != payload
            payload = new_payload
            entry.size = len(payload)
        rewritten.append((entry, payload))

    if not seen_target:
        raise ValueError(
            f"desktop file {source_path!r} was not found and {target_path!r} is absent"
        )

    actions = []
    if renamed:
        actions.append(f"renamed {source_desktop_id} -> {target_desktop_id}")
    if launchable_rewritten:
        actions.append(f"rewrote AppStream launchable -> {target_desktop_id}")
    if not actions:
        actions.append("already normalized")
    return rewritten, actions


def clone_tarinfo(entry: tarfile.TarInfo, name: str) -> tarfile.TarInfo:
    cloned = tarfile.TarInfo(name)
    cloned.mode = entry.mode
    cloned.uid = entry.uid
    cloned.gid = entry.gid
    cloned.uname = entry.uname
    cloned.gname = entry.gname
    cloned.mtime = entry.mtime
    cloned.type = entry.type
    cloned.linkname = entry.linkname
    cloned.devmajor = entry.devmajor
    cloned.devminor = entry.devminor
    cloned.size = entry.size
    return cloned


def recompute_md5sums(data_entries: list[tuple[tarfile.TarInfo, bytes | None]]) -> bytes:
    lines: list[str] = []
    for entry, payload in data_entries:
        if not entry.isreg():
            continue
        normalized = normalize_tar_name(entry.name)
        digest = hashlib.md5(payload or b"", usedforsecurity=False).hexdigest()
        lines.append(f"{digest}  {normalized}")
    return ("\n".join(sorted(lines)) + "\n").encode("utf-8")


def rewrite_control_entries(
    entries: list[tuple[tarfile.TarInfo, bytes | None]],
    md5sums: bytes,
) -> list[tuple[tarfile.TarInfo, bytes | None]]:
    rewritten: list[tuple[tarfile.TarInfo, bytes | None]] = []
    replaced = False
    for entry, payload in entries:
        if normalize_tar_name(entry.name) == "md5sums":
            payload = md5sums
            entry.size = len(md5sums)
            replaced = True
        rewritten.append((entry, payload))

    if not replaced:
        entry = tarfile.TarInfo("./md5sums")
        entry.mode = 0o644
        entry.mtime = 0
        entry.size = len(md5sums)
        rewritten.append((entry, md5sums))
    return rewritten


def normalize_deb(
    deb_path: pathlib.Path,
    component_id: str,
    source_desktop_id: str,
    target_desktop_id: str,
) -> list[str]:
    original_mode = deb_path.stat().st_mode & 0o777
    members = read_ar(deb_path)
    if any(member.name.startswith("_gpg") for member in members):
        raise ValueError(f"{deb_path} appears to be signed; normalize before dpkg-sig signing")

    data_member = next((member for member in members if member.name.startswith("data.tar")), None)
    control_member = next(
        (member for member in members if member.name.startswith("control.tar")), None
    )
    if data_member is None or control_member is None:
        raise ValueError(f"{deb_path} must contain data.tar.* and control.tar.*")

    data_entries = read_tar(data_member.name, data_member.data)
    data_entries, actions = rewrite_data_entries(
        data_entries,
        component_id=component_id,
        source_desktop_id=source_desktop_id,
        target_desktop_id=target_desktop_id,
    )
    data_member.data = write_tar(data_member.name, data_entries)

    control_entries = read_tar(control_member.name, control_member.data)
    control_entries = rewrite_control_entries(control_entries, recompute_md5sums(data_entries))
    control_member.data = write_tar(control_member.name, control_entries)

    with tempfile.NamedTemporaryFile(
        prefix=f"{deb_path.name}.", suffix=".tmp", dir=deb_path.parent, delete=False
    ) as temp:
        temp_path = pathlib.Path(temp.name)
    try:
        write_ar(temp_path, members)
        temp_path.replace(deb_path)
        deb_path.chmod(original_mode)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise
    return actions


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Rewrite unsigned CSV Align .deb packages to the rDNS desktop-id contract."
    )
    parser.add_argument("deb", nargs="+", help=".deb artifact path or glob")
    parser.add_argument("--component-id", default=DEFAULT_COMPONENT_ID)
    parser.add_argument("--source-desktop-id", default=DEFAULT_SOURCE_DESKTOP_ID)
    parser.add_argument("--target-desktop-id", default=DEFAULT_TARGET_DESKTOP_ID)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    deb_paths = expand_deb_patterns(args.deb)
    if not deb_paths:
        print("error: no .deb artifacts matched the supplied path/glob", file=sys.stderr)
        return 2

    for deb_path in deb_paths:
        try:
            actions = normalize_deb(
                deb_path,
                component_id=args.component_id,
                source_desktop_id=args.source_desktop_id,
                target_desktop_id=args.target_desktop_id,
            )
        except Exception as error:  # noqa: BLE001 - CLI should report concise artifact error
            print(f"[FAIL] {deb_path}: {error}", file=sys.stderr)
            return 1
        print(f"[OK] {deb_path}: {', '.join(actions)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
