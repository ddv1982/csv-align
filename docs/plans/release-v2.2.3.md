# Release v2.2.3

Publish the reviewed professional UI refinement using the existing CI and tag-triggered release workflows. Scope: current frontend changes and design plan, eight version-bearing files, changelog, and this release checklist. Retain the known nonblocking 320px fieldset-alignment advisory. No workflow changes or unrelated fixes.

- [x] Prepare synchronized 2.2.3 metadata and dated release notes; verify `python3 scripts/check_release_metadata.py --expected-tag v2.2.3`.
- [x] Run frontend test/lint/build, root Rust format/test/clippy, Tauri format/test/clippy, both locked Rust 1.88 test suites, and pinned Actionlint release-workflow validation.
- [x] Inspect and commit only intended release changes, push `main`, and verify successful CI plus reusable Linux/frontend artifacts for that exact commit.
- [x] Create and push the new `v2.2.3` tag at the CI-verified commit; verify the tag-triggered Release workflow succeeds.
- [x] Verify the published GitHub Release, tag/commit identity, expected assets and manifest, and hosted APT metadata; record the resulting URLs and evidence.

## Publication path

`main` push → CI validation and signed Linux/frontend artifacts → `v2.2.3` tag → release metadata/CI artifact validation → Linux/APT and signed macOS staging → asset verification → Pages deployment and public verification → published GitHub Release.

## Evidence

Initial inspection: local `main` matches `origin/main` at `22a0b185af52445edb4a52a50457a7136026777a`; latest published release is v2.2.2; v2.2.3 does not exist. GitHub authentication and push permission are available. Local Actionlint is 1.7.12, Rust 1.88 is installed, and WebKitGTK 4.1 is available. UI independent review passed and its Flow session is archived; native Tauri visual rendering was not verified.

Metadata preparation: all eight version-bearing files updated without dependency changes; AppStream and changelog release date is 2026-10-13. The expected-tag checker reports `Release metadata is consistent at version 2.2.3.`; `git diff --check` passes.

Local checks passed on 2026-10-13:

- `npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build && actionlint .github/workflows/release.yml`: 236 frontend tests passed, one existing opt-in measurement skipped; lint, build and Actionlint passed.
- `cargo fmt --check && cargo test --locked && cargo clippy --locked -- -D warnings && cargo +1.88.0 test --locked`: all shared Rust suites passed on stable and 1.88; formatting/clippy passed.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml && cargo test --locked --manifest-path src-tauri/Cargo.toml && cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo +1.88.0 test --locked --manifest-path src-tauri/Cargo.toml`: 39 Tauri tests passed on both compilers; formatting/clippy passed.

Release commit: `081ad6567c2f6621b1baba9a6da4002b4c4024c0` (`chore(release): v2.2.3`), pushed to `origin/main`. [CI run 38356390340](https://github.com/ddv1982/csv-align/actions/runs/38356390340) succeeded for that exact SHA, including all Linux/macOS stable/MSRV tests, frontend, metadata, packaging and Debian signing. Required non-expired artifacts exist: `csv-align-linux-x86_64-release-bundle` (90,353,910 bytes) and `csv-align-frontend-dist` (113,171 bytes).

Tag `v2.2.3` was pushed at the CI-verified SHA. [Release run 38357273127](https://github.com/ddv1982/csv-align/actions/runs/38357273127), attempt 1, passed metadata validation and all Linux/APT and signed macOS stages, but stopped at draft asset replacement: `Expected exactly one draft release for v2.2.3 before asset replacement.` The draft is subsequently visible in the list API (id 411369811, no assets); publication and Pages deployment did not occur. Retry the full workflow because stage names include the attempt number. This recovery preserves the same tag and source, with no workflow changes.

Release attempt 2 succeeded through verified assets, Pages deployment/public byte comparison and final publication. GitHub reports a published stable [CSV Align v2.2.3](https://github.com/ddv1982/csv-align/releases/tag/v2.2.3), published at 2026-10-13T06:54:42Z, with all ten managed assets. The remote tag still resolves to the CI-verified release commit.

Public verification:

- Downloaded all ten GitHub Release assets to `/tmp/opencode/release-v2.2.3-verification`; `python3 scripts/verify_release_assets.py /tmp/opencode/release-v2.2.3-verification --tag v2.2.3 --verify-manifest` verified the exact nine payload files, their sizes/SHA-256 hashes, setup checksum and published manifest.
- `sh -n` passed on the published installer. Debian package fields report `csv-align 2.2.3 amd64`; the independently versioned repository setup package remains `csv-align-repository-setup 1.0 all`.
- Public APT `Packages`, compressed Packages, DEP-11 indexes, `InRelease`, `Release`, `Release.gpg`, archive keyring and pool package returned HTTP 200. Compressed indexes expand to the uncompressed versions. Packages advertises `csv-align 2.2.3 amd64`, and the hosted pool package byte-matches the GitHub Release `.deb` and its Packages SHA-256.
- The GitHub latest-release API reports `v2.2.3`, `draft: false`, `prerelease: false`, and the expected ten assets. Source tag identity is `081ad6567c2f6621b1baba9a6da4002b4c4024c0`.

No unchecked checklist items remain. Release notes: <https://github.com/ddv1982/csv-align/releases/tag/v2.2.3>. Hosted APT metadata: <https://ddv1982.github.io/csv-align/apt/dists/stable/InRelease>.
