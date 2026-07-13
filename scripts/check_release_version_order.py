#!/usr/bin/env python3

import argparse
import pathlib
import re
import sys


VERSION_PATTERN = re.compile(r"^v?(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)$")


def parse_version(value: str, label: str) -> tuple[int, int, int]:
    match = VERSION_PATTERN.fullmatch(value.strip())
    if not match:
        raise ValueError(f"{label} must be a stable semantic version like 2.1.99, got {value!r}")
    return tuple(int(match.group(part)) for part in ("major", "minor", "patch"))


def published_versions(path: pathlib.Path) -> list[tuple[str, tuple[int, int, int]]]:
    versions = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        tag = raw_line.strip()
        if tag:
            versions.append(
                (tag, parse_version(tag, f"published tag at {path}:{line_number}"))
            )
    return versions


def hosted_versions(path: pathlib.Path) -> list[tuple[str, tuple[int, int, int]]]:
    versions = []
    for paragraph in re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip()):
        fields = {}
        for line in paragraph.splitlines():
            if ": " in line:
                key, value = line.split(": ", 1)
                fields[key] = value
        if fields.get("Package") == "csv-align":
            version = fields.get("Version")
            if not version:
                raise ValueError(f"{path} contains csv-align without a Version field")
            versions.append(
                (version, parse_version(version, f"hosted csv-align version in {path}"))
            )
    if not versions:
        raise ValueError(f"{path} does not contain a csv-align package stanza")
    return versions


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reject a release that would roll the public APT repository back."
    )
    parser.add_argument("--candidate", required=True, help="Candidate version, without or with v")
    parser.add_argument(
        "--published-tags-file",
        type=pathlib.Path,
        required=True,
        help="One published stable release tag per line",
    )
    parser.add_argument(
        "--hosted-packages-file",
        type=pathlib.Path,
        help="Currently hosted Debian Packages index, when one exists",
    )
    args = parser.parse_args()

    try:
        candidate = parse_version(args.candidate, "candidate")
        baselines = published_versions(args.published_tags_file)
        if args.hosted_packages_file:
            baselines.extend(hosted_versions(args.hosted_packages_file))
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    newer = [(label, version) for label, version in baselines if version > candidate]
    if newer:
        label, version = max(newer, key=lambda item: item[1])
        rendered = ".".join(str(part) for part in version)
        print(
            f"error: candidate {args.candidate} is older than public version {rendered} ({label}); "
            "refusing to roll back the APT repository",
            file=sys.stderr,
        )
        return 1

    print(f"Release {args.candidate} does not roll back any published or hosted version.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
