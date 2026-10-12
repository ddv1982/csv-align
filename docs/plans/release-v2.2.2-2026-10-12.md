# Release v2.2.2

Publish the reviewed October improvements through the existing CI and release workflows. The latest published release is v2.2.1 and remote main matches the reviewed baseline; v2.2.2 is unused. Do not bypass signing, asset verification, Pages verification or immutable-release handling.

- [x] Inspect documented release requirements, current workflow, remote main, authentication and unused tag; verified with Git and GitHub CLI.
- [x] Synchronize all eight version-bearing files to 2.2.2 and add the dated nonempty changelog section; verify the expected-tag metadata checker.
- [x] Review/stage intended changes, run repository release preflight and commit with Conventional Commit message (f86a062).
- [ ] Repair CI run 38222583350's stable-Rust atomic fetch_update deprecation in src/backend/store.rs with a Rust-1.88-compatible saturating compare/exchange loop; verify saturation, concurrency, both compiler checks and commit the bounded compatibility fix.
- [ ] Push main, verify successful CI and required artifacts for the exact commit, then create and push v2.2.2.
- [ ] Wait for release workflow success and verify published tag, complete release assets and hosted APT version.

Release preflight: root and Tauri fmt/tests/clippy, frontend tests/lint/build, both Rust 1.88 locked suites, `python3 scripts/check_release_metadata.py --expected-tag v2.2.2`, and `actionlint .github/workflows/ci.yml .github/workflows/release.yml`.

Publication is authorized by the user's request to create a new release with a new tag. Changes from the completed codebase review are included. Repository setup package remains independently versioned at 1.0.
