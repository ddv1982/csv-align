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

Add release notes in `CHANGELOG.md` using this exact heading format:

```md
## v1.0.8 - YYYY-MM-DD
- First release note bullet
```

Then commit, tag, and push:

```bash
git add -A
git commit -m "Release v1.0.8"
git tag v1.0.8
git push origin main
git push origin v1.0.8
```

## GitHub Actions behavior

Pushing a tag matching `v*` triggers the release workflow.

The workflow expects a matching non-empty `CHANGELOG.md` section. If the changelog heading or notes are missing, the release job fails before creating the GitHub Release.
