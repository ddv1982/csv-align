#!/usr/bin/env python3

import argparse
import json
import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def read_json(relative_path: str):
    with (ROOT / relative_path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_package_version(relative_path: str) -> str:
    content = read_text(relative_path)
    match = re.search(
        r"(?ms)^\[package\]\s+.*?^version\s*=\s*\"([^\"]+)\"\s*$",
        content,
    )
    if not match:
        raise ValueError(f"Could not find [package] version in {relative_path}")
    return match.group(1)


def parse_lockfile_package_version(relative_path: str, package_name: str) -> str:
    content = read_text(relative_path)
    pattern = re.compile(
        rf'(?ms)^\[\[package\]\]\s+name\s*=\s*"{re.escape(package_name)}"\s+version\s*=\s*"([^\"]+)"\s*$'
    )
    match = pattern.search(content)
    if not match:
        raise ValueError(
            f'Could not find package "{package_name}" in {relative_path}'
        )
    return match.group(1)


def normalize_expected_version(expected_tag: str | None, expected_version: str | None) -> str | None:
    if expected_tag and expected_version:
        raise ValueError("Pass either --expected-tag or --expected-version, not both")
    if expected_tag:
        if not expected_tag.startswith("v"):
            raise ValueError("Expected tag must start with 'v'")
        return expected_tag[1:]
    return expected_version


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate release metadata stays in sync across version-bearing files."
    )
    parser.add_argument("--expected-tag", help="Expected git tag like v2.1.4")
    parser.add_argument("--expected-version", help="Expected version like 2.1.4")
    args = parser.parse_args()

    try:
        expected_version = normalize_expected_version(args.expected_tag, args.expected_version)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    package_json = read_json("frontend/package.json")
    package_lock_json = read_json("frontend/package-lock.json")
    tauri_conf = read_json("src-tauri/tauri.conf.json")

    versions = {
        "Cargo.toml": parse_package_version("Cargo.toml"),
        "Cargo.lock (csv-align)": parse_lockfile_package_version("Cargo.lock", "csv-align"),
        "src-tauri/Cargo.toml": parse_package_version("src-tauri/Cargo.toml"),
        "src-tauri/Cargo.lock (csv-align)": parse_lockfile_package_version(
            "src-tauri/Cargo.lock", "csv-align"
        ),
        "src-tauri/Cargo.lock (csv-align-app)": parse_lockfile_package_version(
            "src-tauri/Cargo.lock", "csv-align-app"
        ),
        "src-tauri/tauri.conf.json": tauri_conf["version"],
        "frontend/package.json": package_json["version"],
        "frontend/package-lock.json": package_lock_json["version"],
        "frontend/package-lock.json packages[\"\"]": package_lock_json["packages"][""]["version"],
    }

    unique_versions = sorted(set(versions.values()))
    if len(unique_versions) != 1:
        print("error: release metadata versions are inconsistent:", file=sys.stderr)
        for label, version in versions.items():
            print(f"  - {label}: {version}", file=sys.stderr)
        return 1

    actual_version = unique_versions[0]
    if expected_version and actual_version != expected_version:
        print(
            f"error: release metadata version {actual_version} does not match expected version {expected_version}",
            file=sys.stderr,
        )
        return 1

    print(f"Release metadata is consistent at version {actual_version}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
