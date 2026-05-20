#!/usr/bin/env python3
"""Build CSV Align's canonical RPM package from the Tauri release binary.

Tauri emits Linux desktop files using productName as the basename. For RPM
software-center metadata we want exactly one desktop file, the reverse-DNS
desktop id referenced by AppStream. This script replaces Tauri's generated RPM
with a small project-owned RPM payload while leaving the Debian/AppImage bundle
outputs untouched.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import tempfile
import textwrap


APPSTREAM_ID = "com.csvalign.desktop"
DESKTOP_ID = "com.csvalign.desktop.desktop"
PACKAGE_NAME = "csv-align"
RPM_RELEASE = "1"
TARGET_ARCHES = {
    "x86_64-unknown-linux-gnu": "x86_64",
}


def copy_source(path: pathlib.Path, destination: pathlib.Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"required RPM source file does not exist: {path}")
    shutil.copy2(path, destination)


def build_spec(version: str, arch: str) -> str:
    return textwrap.dedent(
        f"""\
        %global debug_package %{{nil}}

        Name:           {PACKAGE_NAME}
        Version:        {version}
        Release:        {RPM_RELEASE}%{{?dist}}
        Summary:        CSV File Comparison Tool
        License:        MIT
        URL:            https://github.com/ddv1982/csv-align
        Source0:        csv-align
        Source1:        {DESKTOP_ID}
        Source2:        {APPSTREAM_ID}.metainfo.xml
        Source3:        LICENSE
        Source4:        csv-align-32.png
        Source5:        csv-align-128.png
        Source6:        csv-align-256.png
        Source7:        csv-align-512.png

        %description
        CSV Align compares CSV files with visual difference highlighting,
        configurable column mapping, and export capabilities.

        %prep

        %build

        %install
        rm -rf %{{buildroot}}
        install -Dm755 %{{SOURCE0}} %{{buildroot}}/usr/bin/csv-align
        install -Dm644 %{{SOURCE1}} %{{buildroot}}/usr/share/applications/{DESKTOP_ID}
        install -Dm644 %{{SOURCE2}} %{{buildroot}}/usr/share/metainfo/{APPSTREAM_ID}.metainfo.xml
        install -Dm644 %{{SOURCE3}} %{{buildroot}}/usr/share/licenses/{PACKAGE_NAME}/LICENSE
        install -Dm644 %{{SOURCE4}} %{{buildroot}}/usr/share/icons/hicolor/32x32/apps/csv-align.png
        install -Dm644 %{{SOURCE5}} %{{buildroot}}/usr/share/icons/hicolor/128x128/apps/csv-align.png
        install -Dm644 %{{SOURCE6}} %{{buildroot}}/usr/share/icons/hicolor/256x256/apps/csv-align.png
        install -Dm644 %{{SOURCE7}} %{{buildroot}}/usr/share/icons/hicolor/512x512/apps/csv-align.png

        %files
        /usr/bin/csv-align
        /usr/share/applications/{DESKTOP_ID}
        /usr/share/metainfo/{APPSTREAM_ID}.metainfo.xml
        /usr/share/icons/hicolor/32x32/apps/csv-align.png
        /usr/share/icons/hicolor/128x128/apps/csv-align.png
        /usr/share/icons/hicolor/256x256/apps/csv-align.png
        /usr/share/icons/hicolor/512x512/apps/csv-align.png
        %license /usr/share/licenses/{PACKAGE_NAME}/LICENSE
        """
    )


def build_rpm(root: pathlib.Path, target: str) -> pathlib.Path:
    rpmbuild = shutil.which("rpmbuild")
    if not rpmbuild:
        raise RuntimeError("rpmbuild was not found; install the rpm package before building RPMs")

    if target not in TARGET_ARCHES:
        raise RuntimeError(f"unsupported RPM target: {target}")
    arch = TARGET_ARCHES[target]

    tauri_conf_path = root / "src-tauri/tauri.conf.json"
    tauri_conf = json.loads(tauri_conf_path.read_text(encoding="utf-8"))
    version = tauri_conf["version"]
    main_binary = tauri_conf["mainBinaryName"]

    release_dir = root / "src-tauri/target" / target / "release"
    binary_path = release_dir / main_binary
    output_dir = release_dir / "bundle/rpm"
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="csv-align-rpm-build-") as temp:
        topdir = pathlib.Path(temp) / "rpmbuild"
        sources_dir = topdir / "SOURCES"
        specs_dir = topdir / "SPECS"
        sources_dir.mkdir(parents=True)
        specs_dir.mkdir(parents=True)

        copy_source(binary_path, sources_dir / "csv-align")
        copy_source(root / "src-tauri/linux" / DESKTOP_ID, sources_dir / DESKTOP_ID)
        copy_source(
            root / "src-tauri/appstream" / f"{APPSTREAM_ID}.metainfo.xml",
            sources_dir / f"{APPSTREAM_ID}.metainfo.xml",
        )
        copy_source(root / "LICENSE", sources_dir / "LICENSE")
        copy_source(root / "src-tauri/icons/32x32.png", sources_dir / "csv-align-32.png")
        copy_source(root / "src-tauri/icons/128x128.png", sources_dir / "csv-align-128.png")
        copy_source(root / "src-tauri/icons/128x128@2x.png", sources_dir / "csv-align-256.png")
        copy_source(root / "src-tauri/icons/icon.png", sources_dir / "csv-align-512.png")

        spec_path = specs_dir / f"{PACKAGE_NAME}.spec"
        spec_path.write_text(build_spec(version, arch), encoding="utf-8")

        completed = subprocess.run(
            [
                rpmbuild,
                "-bb",
                str(spec_path),
                "--target",
                arch,
                "--define",
                f"_topdir {topdir}",
                "--define",
                "_build_id_links none",
            ],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                "rpmbuild failed\nSTDOUT:\n"
                + completed.stdout
                + "\nSTDERR:\n"
                + completed.stderr
            )

        built_rpms = sorted((topdir / "RPMS" / arch).glob("*.rpm"))
        if len(built_rpms) != 1:
            raise RuntimeError(f"expected exactly one built RPM, found {built_rpms!r}")

        for old_rpm in output_dir.glob("*.rpm"):
            old_rpm.unlink()
        destination = output_dir / built_rpms[0].name
        shutil.copy2(built_rpms[0], destination)
        return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="Build CSV Align's canonical RPM package.")
    parser.add_argument("--target", default="x86_64-unknown-linux-gnu")
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parent.parent
    rpm_path = build_rpm(root, args.target)
    print(f"Built RPM package: {rpm_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
