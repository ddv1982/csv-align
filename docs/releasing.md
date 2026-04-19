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

Validate the metadata before you commit:

```bash
python3 scripts/check_release_metadata.py
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

The CI workflow runs frontend tests, lint, and build, and also validates that release metadata stays aligned across the documented version-bearing files.

The tagged release workflow now validates release metadata against the tag, checks the Rust, Tauri, and frontend validation suite, and expects a matching non-empty `CHANGELOG.md` section before creating the GitHub Release or uploading artifacts.
