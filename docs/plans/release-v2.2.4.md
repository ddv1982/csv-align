# Release v2.2.4

Publish the reviewed Run Comparison footer refinement using the existing main CI and tag-triggered Release workflow. Scope: the two frontend changes, their completed checklist, eight version-bearing files, changelog, and this release checklist.

- [x] Prepare synchronized 2.2.4 metadata and dated release notes; verify `python3 scripts/check_release_metadata.py --expected-tag v2.2.4`.
- [x] Run frontend tests/lint/build, root and Tauri format/test/clippy, both locked Rust 1.88 test suites, and pinned Actionlint validation; commit only intended release changes.
- [x] Push main and verify successful CI with reusable Linux/frontend artifacts for the exact release commit.
- [x] Create and push new tag v2.2.4 at that verified commit; verify the Release workflow succeeds.
- [x] Verify published release, tag identity, assets/manifest and hosted APT version; record publication evidence.

Publication path: main push → CI → v2.2.4 tag → release validation → Linux/APT and signed macOS staging → asset verification → Pages/public verification → GitHub Release publication.

Initial inspection: main matches origin/main at b218f784c499552078c1dc541dacae2cf522eef9. Latest published release is v2.2.3; remote v2.2.4 tag is absent. The footer change passed independent Flow review and frontend validation. Browser screenshot verification was unavailable.

Metadata check first rejected the old 2.2.3 version, then passed after updating all eight version-bearing files and adding the dated changelog section. `git diff --check` passed. Local Actionlint is the required 1.7.12; Rust 1.88 is installed.

Local validation passed on 2026-10-13:

- `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build && actionlint .github/workflows/release.yml`: 237 tests passed, one opt-in measurement skipped; lint, build and Actionlint passed.
- `cargo fmt --check && cargo test --locked && cargo clippy --locked -- -D warnings && cargo +1.88.0 test --locked`: shared Rust suites passed on stable and 1.88; formatting and Clippy passed.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml && cargo test --locked --manifest-path src-tauri/Cargo.toml && cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo +1.88.0 test --locked --manifest-path src-tauri/Cargo.toml`: 39 tests passed on each compiler; formatting and Clippy passed.

Release commit: `7578a9451949a80a5f97d5fee33e9507a0515bbb` (`chore(release): v2.2.4`). Staged diff was inspected and passed whitespace checks; no unrelated changes were included.

[CI run 38390301793](https://github.com/ddv1982/csv-align/actions/runs/38390301793), attempt 1, failed in the existing macOS stable `busy_idle_candidate_is_skipped_and_cleanup_converges_when_it_releases` test with a channel receive error before worker entry. The test uses a 1 ms idle timeout. Retried the full workflow at the same commit without source changes; attempt 2 succeeded across every job. Non-expired artifacts were verified: `csv-align-frontend-dist` (113,165 bytes), `csv-align-linux-x86_64-release-bundle` (90,347,892 bytes). Before tagging, remote main equaled the release commit and v2.2.4 was absent.

Pushed new tag `v2.2.4` at the CI-verified commit. [Release run 38392198257](https://github.com/ddv1982/csv-align/actions/runs/38392198257), attempt 1, passed release validation, Linux/APT and both signed macOS stages, then failed with `Expected exactly one draft release for v2.2.4 before asset replacement.` The draft subsequently appears in the list API (id 411624811, no assets), matching the v2.2.3 publication recovery. No Pages/public release mutation occurred. Retry the full workflow at the unchanged tag because staged artifact names include attempt numbers.

Release attempt 2 succeeded through every job, including exact asset verification, Pages deployment/public byte comparison and publication. GitHub reports [CSV Align v2.2.4](https://github.com/ddv1982/csv-align/releases/tag/v2.2.4), published at 2026-10-13T12:06:39Z, as the latest stable release (`draft: false`, `prerelease: false`) with ten assets. Remote tag resolves to `7578a9451949a80a5f97d5fee33e9507a0515bbb`.

Public verification:

- Downloaded all ten release assets to `/tmp/opencode/release-v2.2.4-verification`. `python3 scripts/verify_release_assets.py /tmp/opencode/release-v2.2.4-verification --tag v2.2.4 --verify-manifest` verified the exact nine payloads, sizes/SHA-256 hashes, setup checksum and manifest.
- A local `--verify-package-metadata` attempt could not finish because `rpm` is unavailable. The Release workflow successfully ran this check with RPM support; local `dpkg-deb --field` checks confirm `csv-align 2.2.4 amd64` and independently versioned `csv-align-repository-setup 1.0 all`. `sh -n` passed for the published installer.
- Hosted APT Packages advertises version 2.2.4, size 4,347,216 and SHA-256 `612824362d669a150857bd5166d9216dc81e98bce661587b503894b5aa15fb93`. The hosted pool package byte-matches the downloaded GitHub Release `.deb` (`cmp` exit 0). Hosted InRelease returns HTTP 200.
- Latest-release API confirms `v2.2.4`, stable/non-draft status and ten assets; tag identity matches the successful CI and Release source SHA.

No unchecked checklist items remain. Release: <https://github.com/ddv1982/csv-align/releases/tag/v2.2.4>. APT metadata: <https://ddv1982.github.io/csv-align/apt/dists/stable/InRelease>.
