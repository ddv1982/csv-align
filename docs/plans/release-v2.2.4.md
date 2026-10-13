# Release v2.2.4

Publish the reviewed Run Comparison footer refinement using the existing main CI and tag-triggered Release workflow. Scope: the two frontend changes, their completed checklist, eight version-bearing files, changelog, and this release checklist.

- [x] Prepare synchronized 2.2.4 metadata and dated release notes; verify `python3 scripts/check_release_metadata.py --expected-tag v2.2.4`.
- [ ] Run frontend tests/lint/build, root and Tauri format/test/clippy, both locked Rust 1.88 test suites, and pinned Actionlint validation; commit only intended release changes.
- [ ] Push main and verify successful CI with reusable Linux/frontend artifacts for the exact release commit.
- [ ] Create and push new tag v2.2.4 at that verified commit; verify the Release workflow succeeds.
- [ ] Verify published release, tag identity, assets/manifest and hosted APT version; record publication evidence.

Publication path: main push → CI → v2.2.4 tag → release validation → Linux/APT and signed macOS staging → asset verification → Pages/public verification → GitHub Release publication.

Initial inspection: main matches origin/main at b218f784c499552078c1dc541dacae2cf522eef9. Latest published release is v2.2.3; remote v2.2.4 tag is absent. The footer change passed independent Flow review and frontend validation. Browser screenshot verification was unavailable.

Metadata check first rejected the old 2.2.3 version, then passed after updating all eight version-bearing files and adding the dated changelog section. `git diff --check` passed. Local Actionlint is the required 1.7.12; Rust 1.88 is installed.

Local validation passed on 2026-10-13:

- `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build && actionlint .github/workflows/release.yml`: 237 tests passed, one opt-in measurement skipped; lint, build and Actionlint passed.
- `cargo fmt --check && cargo test --locked && cargo clippy --locked -- -D warnings && cargo +1.88.0 test --locked`: shared Rust suites passed on stable and 1.88; formatting and Clippy passed.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml && cargo test --locked --manifest-path src-tauri/Cargo.toml && cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo +1.88.0 test --locked --manifest-path src-tauri/Cargo.toml`: 39 tests passed on each compiler; formatting and Clippy passed.
