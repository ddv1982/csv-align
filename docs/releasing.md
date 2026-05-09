# Release workflow

Use this workflow when you want to publish a real application release.

## When a release is needed

Create a release when application code, packaging, or published version metadata changes and you want new downloadable artifacts on GitHub Releases.

## When a release is **not** needed

Docs-only changes do **not** need a new release.

Examples:

- `README.md` updates
- new or updated files in `docs/`
- wording fixes in markdown documentation

Those can be committed and pushed directly to `main` without a version bump or tag.

## Release steps

Update version metadata in:

- `Cargo.toml`
- `Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `frontend/package.json`
- `frontend/package-lock.json`

Validate the metadata before you commit. During release prep, always pin the expected tag so the checker verifies both synced versions and the matching non-empty changelog section:

```bash
python3 scripts/check_release_metadata.py --expected-tag v1.0.8
```

Add release notes in `CHANGELOG.md` using this exact heading format:

```md
## v1.0.8 - YYYY-MM-DD
- First release note bullet
```

Then commit, tag, and push:

```bash
git add -A
git commit -m "chore(release): v1.0.8"
git tag v1.0.8
git push origin main
git push origin v1.0.8
```

Recommended pre-push validation:

```bash
cargo fmt --check
cargo test
cargo clippy -- -D warnings
cd src-tauri && cargo test
cd frontend && npm test
cd frontend && npm run lint
cd frontend && npm run build
```

## GitHub Actions behavior

Pushing a tag matching `v*` triggers the release workflow.

The CI workflow runs Rust tests/formatting/clippy, Tauri wrapper tests, frontend tests/lint/build, and validates that release metadata stays aligned across the documented version-bearing files. For Tauri-impacting changes, CI also publishes two 7-day artifacts used by the release workflow: the Linux package bundle and `csv-align-frontend-dist`.

The tagged release workflow validates release metadata against the tag, checks the Rust, Tauri, and frontend validation suite, expects a matching non-empty `CHANGELOG.md` section, verifies both CI artifacts exist before creating or refreshing the draft GitHub Release, uploads the packaged assets, and only publishes the final GitHub Release after packaging succeeds.

If the CI artifacts expire before publishing, rerun CI on the `main` push commit that the tag points to; the tag push itself does not create those artifacts. Then rerun the release workflow for the tag.

Tauri packaging currently targets Linux and macOS only. The Tauri `beforeBuildCommand` uses a Bash script, so Windows local packaging is not a supported release path right now.
