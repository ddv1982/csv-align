# Release v2.2.2

Publish the reviewed October improvements through the existing CI and release workflows. At preparation, the latest published release was v2.2.1 and remote main matched the reviewed baseline; v2.2.2 was unused. Do not bypass signing, asset verification, Pages verification or immutable-release handling.

- [x] Inspect documented release requirements, current workflow, remote main, authentication and unused tag; verified with Git and GitHub CLI.
- [x] Synchronize all eight version-bearing files to 2.2.2 and add the dated nonempty changelog section; verify the expected-tag metadata checker.
- [x] Review/stage intended changes, run repository release preflight and commit with Conventional Commit message (f86a062).
- [x] Repair CI run 38222583350's stable-Rust atomic fetch_update deprecation in src/backend/store.rs with a Rust-1.88-compatible saturating compare/exchange loop; verify saturation, concurrency, both compiler checks and commit the bounded compatibility fix (07d3a32).
- [x] Push main, verify successful CI and required artifacts for the exact commit, then create and push v2.2.2 (07d3a32; CI 38223300626 passed on rerun with both unexpired release artifacts; remote tag verified).
- [x] Wait for release workflow success and verify published tag, complete release assets and hosted APT version (Release 38225698985 attempt 2 passed; published non-draft/non-prerelease, exact 10 assets with matching manifest sizes/digests, hosted APT 2.2.2 and matching Debian checksum).

Release preflight: root and Tauri fmt/tests/clippy, frontend tests/lint/build, both Rust 1.88 locked suites, `python3 scripts/check_release_metadata.py --expected-tag v2.2.2`, and `actionlint .github/workflows/ci.yml .github/workflows/release.yml`.

Publication is authorized by the user's request to create a new release with a new tag. Changes from the completed codebase review are included. Repository setup package remains independently versioned at 1.0.

## Publication evidence

- Release: https://github.com/ddv1982/csv-align/releases/tag/v2.2.2
- Tag commit: `07d3a323c6bc4f0c4140d2fa6cdb1df53378cbc1` (remote tag read back).
- CI: https://github.com/ddv1982/csv-align/actions/runs/38223300626
- Release workflow: https://github.com/ddv1982/csv-align/actions/runs/38225698985
- Hosted index: https://ddv1982.github.io/csv-align/apt/dists/stable/main/binary-amd64/Packages
- Downloaded manifest and installer match GitHub asset SHA-256 digests; installer passes `sh -n`.

The first CI attempt exposed the stable compiler deprecation and was repaired. The next CI run required one failed-job rerun for the existing 1 ms idle-session test's timing-sensitive survival assertion; no test was skipped or weakened. The release's first attempt created a draft but failed the immediate follow-up draft lookup; the draft was then visible and a full rerun completed the documented recovery path. These timing-sensitive checks remain follow-up opportunities, not claims that their underlying flakiness was repaired.
