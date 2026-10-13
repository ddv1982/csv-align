# Release v2.2.3

Publish the reviewed professional UI refinement using the existing CI and tag-triggered release workflows. Scope: current frontend changes and design plan, eight version-bearing files, changelog, and this release checklist. Retain the known nonblocking 320px fieldset-alignment advisory. No workflow changes or unrelated fixes.

- [x] Prepare synchronized 2.2.3 metadata and dated release notes; verify `python3 scripts/check_release_metadata.py --expected-tag v2.2.3`.
- [x] Run frontend test/lint/build, root Rust format/test/clippy, Tauri format/test/clippy, both locked Rust 1.88 test suites, and pinned Actionlint release-workflow validation.
- [ ] Inspect and commit only intended release changes, push `main`, and verify successful CI plus reusable Linux/frontend artifacts for that exact commit.
- [ ] Create and push the new `v2.2.3` tag at the CI-verified commit; verify the tag-triggered Release workflow succeeds.
- [ ] Verify the published GitHub Release, tag/commit identity, expected assets and manifest, and hosted APT metadata; record the resulting URLs and evidence.

## Publication path

`main` push → CI validation and signed Linux/frontend artifacts → `v2.2.3` tag → release metadata/CI artifact validation → Linux/APT and signed macOS staging → asset verification → Pages deployment and public verification → published GitHub Release.

## Evidence

Initial inspection: local `main` matches `origin/main` at `22a0b185af52445edb4a52a50457a7136026777a`; latest published release is v2.2.2; v2.2.3 does not exist. GitHub authentication and push permission are available. Local Actionlint is 1.7.12, Rust 1.88 is installed, and WebKitGTK 4.1 is available. UI independent review passed and its Flow session is archived; native Tauri visual rendering was not verified.

Metadata preparation: all eight version-bearing files updated without dependency changes; AppStream and changelog release date is 2026-10-13. The expected-tag checker reports `Release metadata is consistent at version 2.2.3.`; `git diff --check` passes.

Local checks passed on 2026-10-13:

- `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build && actionlint .github/workflows/release.yml`: 236 frontend tests passed, one existing opt-in measurement skipped; lint, build and Actionlint passed.
- `cargo fmt --check && cargo test --locked && cargo clippy --locked -- -D warnings && cargo +1.88.0 test --locked`: all shared Rust suites passed on stable and 1.88; formatting/clippy passed.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml && cargo test --locked --manifest-path src-tauri/Cargo.toml && cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo +1.88.0 test --locked --manifest-path src-tauri/Cargo.toml`: 39 Tauri tests passed on both compilers; formatting/clippy passed.
