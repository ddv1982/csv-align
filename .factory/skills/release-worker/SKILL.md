---
name: release-worker
description: Orchestrates the v2.0.0 release — bumps version across 7 metadata files, authors CHANGELOG entry matching the release.yml heading regex, updates README/AGENTS.md/library docs to reflect the v2 surface, and (for the final feature) creates + pushes the `v2.0.0` tag to trigger CI's release pipeline. Does NOT write application code.
---

# Release Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for M7 "Release" milestone features only:
- Version-metadata sync across the 7 required files.
- CHANGELOG.md v2.0.0 section.
- README.md, AGENTS.md, `.factory/library/architecture.md` v2 updates.
- Local pre-tag CI-parity sweep.
- Tag creation + push.

Do NOT use this worker to fix bugs or refactor code. If a release-blocker is discovered (clippy warning, failing test), return to orchestrator — they will create a rust-worker / frontend-worker fix feature.

## Required Skills

None for the code-free portion. The tag-push feature must have `gh` CLI authenticated (`gh auth status`); if not, return to orchestrator.

## Work Procedure

### Version bump features

1. Read `.github/workflows/release.yml` to confirm the CHANGELOG `heading_pattern` regex (`^## (?P<tag>v[^\s]+) - \d{4}-\d{2}-\d{2}$`).
2. Edit the seven version-metadata files to `2.0.0`:
   - `Cargo.toml` (`[package] version`).
   - `Cargo.lock` (`[[package]] name = "csv-align" version`).
   - `src-tauri/Cargo.toml` (`[package] version`).
   - `src-tauri/Cargo.lock` (`[[package]] name = "csv-align-app" version` AND the csv-align dep entry).
   - `src-tauri/tauri.conf.json` (top-level `version`).
   - `frontend/package.json` (`version`).
   - `frontend/package-lock.json` (top-level `version` AND `packages[""].version`).
3. Run `cargo check` and `cd src-tauri && cargo check` to ensure lockfiles stay consistent. If either cargo auto-updates an unrelated line, amend the file and re-check. The end state: only the `csv-align`/`csv-align-app` version entries change.
4. Verify with:
   ```
   rg '^version = "2\.0\.0"$' Cargo.toml src-tauri/Cargo.toml
   jq -r '.version' src-tauri/tauri.conf.json
   jq -r '.version' frontend/package.json
   jq -r '.version, .packages[""].version' frontend/package-lock.json
   rg '^name = "csv-align"' -A1 Cargo.lock src-tauri/Cargo.lock
   rg '^name = "csv-align-app"' -A1 src-tauri/Cargo.lock
   ```
   All should report `2.0.0`.

### CHANGELOG feature

1. Read the existing CHANGELOG.md to observe format. Heading must match `^## v2\.0\.0 - YYYY-MM-DD$` (today's date).
2. Insert the v2.0.0 section at the top (above older releases). Include at minimum these bullets (reword into a compelling release narrative):
   - **Breaking:** Comparison snapshot format upgraded to v2 (`persistence::v1` schema). v1.x snapshots no longer load — re-run the comparison.
   - **Breaking:** Result type `duplicate_filea`/`duplicate_fileb` renamed to `duplicate_file_a`/`duplicate_file_b`.
   - **Breaking:** Local web app now listens on `127.0.0.1:3001` (was `:3000`).
   - **Breaking:** `MappingRequest`/`MappingResponse` collapsed into a single `MappingDto`.
   - **Dependencies:** React 18 → 19 (+ types, testing-library). Axum 0.7 → 0.8. Rust edition 2024 (MSRV ≥ 1.85). TypeScript 5.3 → 5.8. Tokio/uuid/strsim/tempfile/tower-http/chrono brought current.
   - **Internal:** Single shared `SessionStore`; typed `CsvAlignError`; tracing spans on all handlers; unified CSV parsing path; collapsed validation logic; flattened `RowComparisonResult` domain type.
   - **Frontend:** SectionCard + NavButton + icon set extractions; useReducer state machine; React Compiler trial; a11y fixes (aria-hidden SVGs, dropzone keyboard, footer stickiness).
   - **Tooling:** `oxlint` + `npm run lint` in CI; `env_logger` replaced by `tracing`.
3. Verify the heading regex: `rg -n '^## v2\.0\.0 - \d{4}-\d{2}-\d{2}$' CHANGELOG.md` must return exactly one line.

### Docs alignment features

- **README.md:** Update prereqs (Rust MSRV 1.85+, Node 22+). Replace every `:3000` with `:3001`. Add a "Breaking changes in v2.0.0" section mirroring the CHANGELOG highlights. `rg ':3000|localhost:3000|127\.0\.0\.1:3000' README.md` must return zero.
- **AGENTS.md:** Delete the "Local Dev Quirk" section. Update "Run And Verify" to reflect port 3001 and tracing. Ensure `rg ':3000' AGENTS.md` returns zero.
- **`.factory/library/architecture.md`:** Already written by orchestrator; confirm it references port 3001, MappingDto, v2 snapshot, React 19, Axum 0.8. Adjust only if drift is found.

### Tag-push feature (final)

1. Verify `gh auth status` succeeds. If not, return to orchestrator.
2. Run the full CI-parity sweep locally (see `.factory/services.yaml::commands.ci-parity`). Abort on any non-zero exit.
3. Inspect `git status` — the only uncommitted change should be the current feature's work. Inspect `git log --oneline -20` to confirm the history is clean.
4. Verify no pre-existing `v2.0.0` tag: `git tag --list 'v2.0.0'` returns empty.
5. Commit and push to `main`:
   - `git add -A`
   - `git commit -m "Release v2.0.0" -m "<body summarizing breaking changes>"`
   - `git push origin main`
6. Wait for the main-branch CI run to report green (use `gh run watch` or poll `gh run list --branch main --workflow CI --limit 1`). If it fails, do NOT create the tag — return to orchestrator with the failure.
7. Create annotated tag and push:
   - `git tag -a v2.0.0 -m "Release v2.0.0"`
   - `git push origin v2.0.0`
8. Confirm the Release workflow kicked off: `gh run list --workflow Release --limit 1`.
9. Confirm release assets: `gh release view v2.0.0 --json assets | jq '.assets[].name'` should eventually list `.deb`, `.AppImage`, macos-arm64 `.dmg`, macos-x86_64 `.dmg`.

## Example Handoff

```json
{
  "salientSummary": "Bumped all 7 version touchpoints to 2.0.0, wrote the CHANGELOG v2.0.0 entry matching the release.yml regex, confirmed via targeted grep and jq. No code changes; cargo check + frontend build both clean. Ready for the docs-alignment and tag-push features to complete M7.",
  "whatWasImplemented": "Modified Cargo.toml, Cargo.lock (csv-align package entry), src-tauri/Cargo.toml, src-tauri/Cargo.lock (csv-align-app + csv-align dep entry), src-tauri/tauri.conf.json, frontend/package.json, and frontend/package-lock.json to version `2.0.0`. Added the `## v2.0.0 - 2026-04-18` section to CHANGELOG.md with 8 bullets across Breaking/Dependencies/Internal/Frontend/Tooling categories.",
  "whatWasLeftUndone": "README.md, AGENTS.md, and the library architecture doc still need alignment passes (next features). Tag creation and push is the final feature of M7.",
  "verification": {
    "commandsRun": [
      {"command": "rg '^version = \"2\\.0\\.0\"$' Cargo.toml src-tauri/Cargo.toml", "exitCode": 0, "observation": "two matches, one per file"},
      {"command": "jq -r '.version' frontend/package.json frontend/package-lock.json src-tauri/tauri.conf.json", "exitCode": 0, "observation": "three lines, all 2.0.0"},
      {"command": "rg -n '^## v2\\.0\\.0 - \\d{4}-\\d{2}-\\d{2}$' CHANGELOG.md", "exitCode": 0, "observation": "1 match on line 3"},
      {"command": "cargo check", "exitCode": 0, "observation": "Finished; no auto-updates to unrelated lockfile lines"},
      {"command": "cd frontend && npm run build", "exitCode": 0, "observation": "vite build 248 kB; no warnings"}
    ],
    "interactiveChecks": []
  },
  "tests": {"added": []},
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- CI fails on the main push — the mission needs a fix feature before the tag can be created. Return with `gh run view` log excerpt.
- `gh auth status` is not authenticated.
- A lockfile auto-update touches unrelated entries in a way that would need semver-approval.
- CHANGELOG regex check fails after edit — likely the heading format drifted (check `heading_pattern` in release.yml).
