# CI and Release Efficiency Plan

## Goal
Reduce CI/release runtime and GitHub Actions cost without weakening release safety. The central decision is: **do not try to reuse one Tauri build for Linux and macOS**; reuse artifacts only at safe boundaries.

## Background
- CI already avoids obvious waste by path-filtering docs-only and scoped changes before jobs fan out (`.github/workflows/ci.yml:17-49`).
- Root Rust validation runs on both Ubuntu and macOS (`.github/workflows/ci.yml:55-79`).
- Frontend install/test/lint/build runs in CI (`.github/workflows/ci.yml:100-120`), then frontend install/build repeats in the Linux Tauri build (`.github/workflows/ci.yml:155-168`) and both macOS release matrix jobs (`.github/workflows/release.yml:305-318`).
- CI already builds and uploads the Linux release bundle (`.github/workflows/ci.yml:122-199`), and the tag release workflow downloads that bundle from the successful CI run instead of rebuilding Linux packages (`.github/workflows/release.yml:25-83`, `.github/workflows/release.yml:168-193`).
- macOS release assets are built in a two-target macOS matrix with signing/notarization setup before upload (`.github/workflows/release.yml:202-350`).
- Tauri currently runs `cd frontend && npm run build` before every `tauri build`, then consumes `../frontend/dist` (`src-tauri/tauri.conf.json:2-6`). This must change before a frontend artifact can save time.
- Release metadata/changelog validation is centralized in `scripts/check_release_metadata.py`, including expected-tag changelog checks during release (`scripts/check_release_metadata.py:40-81`, `scripts/check_release_metadata.py:105-140`).
- Prior release history already optimized CI/release handoff and Linux package reuse (`CHANGELOG.md:53-57`, `CHANGELOG.md:48-51`), while the current release restored macOS DMGs and kept Linux reuse separate (`CHANGELOG.md:3-7`).

External constraints:
- Tauri distribution is platform-specific: https://v2.tauri.app/distribute/.
- Tauri macOS app bundles/DMGs are built with `tauri build` on a Mac: https://v2.tauri.app/distribute/macos-application-bundle/.
- Tauri's GitHub Actions guide uses an OS/target matrix for macOS and Linux builds: https://v2.tauri.app/distribute/pipelines/github/.
- GitHub Actions caches are for dependencies/intermediates; produced bundles should move as artifacts: https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching.

## Decision
A single Tauri build cannot safely serve both Linux and macOS releases.

Use these reuse boundaries instead:
1. **Same OS/target package artifacts:** keep reusing the CI-built Linux `.deb`/`.AppImage` for release publishing.
2. **OS-independent frontend artifact:** build `frontend/dist` once per relevant CI run and reuse it for Linux packaging and macOS release packaging.
3. **Per OS/target Tauri bundles:** continue building macOS DMGs on macOS for `aarch64-apple-darwin` and `x86_64-apple-darwin`.

## Approach
Keep the current release model and make one focused artifact-reuse refactor:

1. Preserve invariants: metadata validation, expected-tag changelog validation, draft release until all assets succeed, Linux artifact availability, and explicit macOS signing/notarization failures.
2. Introduce `csv-align-frontend-dist`, retained for the same 7-day window as `csv-align-linux-x86_64-release-bundle`.
3. Replace the hard-coded Tauri `beforeBuildCommand` with a repo script contract, for example `scripts/build_frontend_for_tauri.sh`:
   - Default/local path: run `cd frontend && npm run build`, preserving local `cargo tauri build` behavior.
   - CI prebuilt path: when `CSV_ALIGN_USE_PREBUILT_FRONTEND=1`, fail if `frontend/dist/index.html` is missing and skip `npm run build`.
4. Make CI produce the frontend artifact whenever `run_frontend_ci == 'true' || run_tauri_ci == 'true'`.
5. Make Linux and macOS package jobs download `csv-align-frontend-dist`, set `CSV_ALIGN_USE_PREBUILT_FRONTEND=1`, and run `cargo tauri build` without duplicate Node install/build work.
6. Extend release validation to require both CI artifacts before `create-release` runs, so missing/expired artifacts fail before draft-release mutation or macOS runner spend.

## Work Items
1. **Lock the safety invariants.**
   - Leave `scripts/check_release_metadata.py` unchanged unless a release-gate bug is found.
   - Keep `release.yml` validating `--expected-tag` before any asset job (`.github/workflows/release.yml:25-83`).
   - Keep `publish-release` dependent on Linux and macOS asset jobs (`.github/workflows/release.yml:359-368`).

2. **Control Tauri frontend rebuilds explicitly.**
   - Add the frontend-build script contract above.
   - Point `src-tauri/tauri.conf.json` `beforeBuildCommand` at that script instead of the hard-coded npm command (`src-tauri/tauri.conf.json:4`).
   - Acceptance: package-job logs show no `npm ci` or `npm run build` after the frontend artifact is downloaded; local `cargo tauri build` still builds the frontend by default.

3. **Create the frontend dist artifact in CI.**
   - Refactor `test-frontend` into the authoritative frontend validation/build job (`.github/workflows/ci.yml:100-120`).
   - Use job condition: `run_frontend_ci == 'true' || run_tauri_ci == 'true'`.
   - Keep `npm test` and `npm run lint` conditional on `run_frontend_ci == 'true'` if Tauri-only changes should only produce the artifact.
   - Always run `npm ci` and `npm run build` when the job runs.
   - Upload `frontend/dist/**` as `csv-align-frontend-dist` when `run_tauri_ci == 'true'`.

4. **Make Linux Tauri packaging consume the frontend artifact.**
   - Update `build-tauri` dependencies from `test-frontend` to the new frontend producer job (`.github/workflows/ci.yml:122-131`).
   - Remove direct Node setup/install/build from `build-tauri` (`.github/workflows/ci.yml:155-168`).
   - Download `csv-align-frontend-dist` into `frontend/dist` before `cargo tauri build`.
   - Set `CSV_ALIGN_USE_PREBUILT_FRONTEND=1` for the Tauri build step.
   - Keep `cd src-tauri && cargo test` before packaging (`.github/workflows/ci.yml:178-179`).

5. **Make release fail early on missing CI artifacts.**
   - Add `FRONTEND_DIST_ARTIFACT_NAME=csv-align-frontend-dist` alongside the existing Linux artifact env (`.github/workflows/release.yml:17-19`).
   - In `validate-release`, loop over both artifact names and run the existing `gh api .../artifacts?name=...` check for each (`.github/workflows/release.yml:40-83`).
   - Keep this in `validate-release`, before `create-release`, so missing artifacts do not create/refresh a draft release.

6. **Make macOS release jobs consume the frontend artifact.**
   - Download `csv-align-frontend-dist` from `needs.validate-release.outputs.ci_run_id` into `frontend/dist`.
   - Remove Node setup/install/build from `build-macos-release` (`.github/workflows/release.yml:305-318`).
   - Set `CSV_ALIGN_USE_PREBUILT_FRONTEND=1` for `cargo tauri build`.
   - Preserve signing/notarization setup and the per-target macOS matrix (`.github/workflows/release.yml:202-350`).

7. **Update release documentation.**
   - Amend `docs/releasing.md` to say release now depends on two CI artifacts: Linux packages and frontend dist.
   - Document the 7-day retention window and recovery path: rerun CI on the tagged/main commit if artifacts expire before publishing.
   - Keep the current pre-push validation list intact (`docs/releasing.md:61-64`).

## Verification Plan
- For workflow-only changes, run static review plus one real GitHub Actions validation on a branch/PR; local commands cannot prove cross-run artifact behavior.
- Confirm the frontend job still runs `npm test`, `npm run lint`, and `npm run build` for frontend-impacting changes.
- Confirm a Tauri-only change still produces `csv-align-frontend-dist`.
- Confirm Linux `build-tauri` still runs `cd src-tauri && cargo test` and uploads `.deb`/`.AppImage` on `main`.
- Confirm release `validate-release` fails before `create-release` if either CI artifact is missing.
- Confirm macOS release logs still fail clearly when Apple signing/notarization secrets are missing.
- Confirm no package job logs duplicate frontend install/build after the artifact handoff is in place.

## Follow-up Note
After the artifact-reuse refactor is stable, consider a separate PR that keeps Tauri wrapper tests on PRs but skips Linux `cargo tauri build` and release-artifact upload except on pushes to `main`. Do not mix that policy change into the first refactor.

## Open Questions
None blocking for the first implementation pass.

## References
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `src-tauri/tauri.conf.json`
- `scripts/check_release_metadata.py`
- `docs/releasing.md`
- `CHANGELOG.md`
- Tauri distribution docs: https://v2.tauri.app/distribute/
- Tauri macOS app bundle docs: https://v2.tauri.app/distribute/macos-application-bundle/
- Tauri GitHub Actions guide: https://v2.tauri.app/distribute/pipelines/github/
- GitHub Actions dependency caching: https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching
