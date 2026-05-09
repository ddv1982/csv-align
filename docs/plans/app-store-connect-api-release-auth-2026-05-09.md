# App Store Connect API Release Auth Plan

## Goal
Make App Store Connect API key authentication the required macOS release authentication path in CI, replacing the current Apple ID/app-specific-password fallback for notarized Tauri DMG publishing.

## Background
- The macOS release job already builds Apple Silicon and Intel DMGs on `macos-latest` and publishes only after the full release graph succeeds (`.github/workflows/release.yml:215-225`, `.github/workflows/release.yml:360-369`).
- Signing certificate secrets are mandatory, but notarization auth still accepts either App Store Connect API keys or Apple ID fallback credentials (`.github/workflows/release.yml:235-283`).
- API-key mode already decodes `APPLE_API_PRIVATE_KEY` into `AuthKey_<APPLE_API_KEY>.p8` and exports `APPLE_API_KEY_PATH` for Tauri (`.github/workflows/release.yml:310-322`).
- Tauri macOS bundle settings already keep `providerShortName` null; leave that boundary unchanged unless a real API-key notarization failure proves otherwise (`src-tauri/tauri.conf.json:24-44`).
- Release docs describe CI artifacts and release sequencing, but not the App Store Connect API-key-only secret contract (`docs/releasing.md:66-78`).

External constraints:
- Apple App Store Connect API keys require Issuer ID, Key ID, and a once-downloadable `.p8` private key. Use a Team key suitable for notarization; Apple says individual keys cannot use `notaryTool`: https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api
- Tauri v2 supports macOS notarization with App Store Connect API env vars once `APPLE_API_KEY_PATH` points at the `.p8` file: https://v2.tauri.app/distribute/sign/macos/
- GitHub Actions secrets must be explicitly passed into workflows and should not be exposed on command lines: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions

## Decision
Require App Store Connect API key authentication for macOS release notarization in CI. Remove the Apple ID fallback path instead of keeping dual auth modes.

Keep the release graph, CI artifact validation, Linux artifact reuse, two-target macOS matrix, signing certificate import, frontend artifact handoff, Tauri build command, and final publish dependency chain unchanged.

## Approach
Use a narrow workflow/documentation change because the release pipeline already has the right API-key mechanics. The implementation seam is `build-macos-release` auth preparation in `.github/workflows/release.yml`.

Required macOS release secrets after the change:
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY`
- `APPLE_API_PRIVATE_KEY`

`APPLE_API_PRIVATE_KEY` must be single-line base64-encoded `.p8` content. The workflow should decode it during the release job into `AuthKey_<APPLE_API_KEY>.p8` and export only `APPLE_API_KEY_PATH`; avoid writing private-key material into `$GITHUB_ENV`.

Implementation prerequisites:
- The six required GitHub secrets must exist before a real macOS release can pass.
- If the repo has no accepted dry-run tag/release procedure, treat live GitHub Actions validation as a post-merge/manual release-readiness check rather than a blocker for static implementation review.

Non-goals:
- Do not change `.github/workflows/ci.yml`, `scripts/check_release_metadata.py`, or `src-tauri/tauri.conf.json`.
- Do not alter the release publish sequence or macOS target matrix.

## Work Items
1. **Make API-key auth mandatory in `build-macos-release`.**
   - Update `Prepare Apple signing environment` to require the existing signing certificate trio plus `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_PRIVATE_KEY`.
   - Prefer one combined prerequisite check that reports all missing signing/API-key secrets together before certificate import or Tauri build.
   - Keep private signing/API-key secret values scoped to the steps that need them; export only non-secret derived values such as `APPLE_SIGNING_IDENTITY` and `APPLE_API_KEY_PATH` to `$GITHUB_ENV`.

2. **Remove Apple ID fallback handling from release CI.**
   - Stop reading `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, and `APPLE_PROVIDER_SHORT_NAME` in `.github/workflows/release.yml`.
   - Remove `auth_mode=apple_id` and the auth-mode branch that accepts Apple ID credentials.
   - Treat reintroducing Apple ID fallback as a policy rollback, not a compatibility feature.

3. **Make App Store Connect key preparation unconditional.**
   - Remove the `if: steps.apple_env.outputs.auth_mode == 'api_key'` condition from `Prepare App Store Connect API key`.
   - Keep the existing decode/write/export behavior for `AuthKey_<APPLE_API_KEY>.p8` and `APPLE_API_KEY_PATH`.
   - Preserve downstream Tauri build behavior and `CSV_ALIGN_USE_PREBUILT_FRONTEND=1`.

4. **Update release documentation.**
   - Add a macOS release prerequisites section to `docs/releasing.md` listing the six required secrets.
   - State that CI no longer supports Apple ID/app-specific-password notarization.
   - Document that the App Store Connect key must be a Team key suitable for notarization and that `APPLE_API_PRIVATE_KEY` is single-line base64-encoded `.p8` content.
   - Keep the existing CI artifact and 7-day retention guidance intact.

## Verification Plan
- Static workflow check: no remaining `.github/workflows/release.yml` references to `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_PROVIDER_SHORT_NAME`, or `auth_mode=apple_id`.
- Static workflow check: `Prepare App Store Connect API key` runs unconditionally after prerequisite validation and before `cargo tauri build`.
- Static docs check: `docs/releasing.md` lists the required API-key-only macOS secret contract and no longer implies Apple ID fallback support.
- Local validation: run `python3 scripts/check_release_metadata.py` to confirm release metadata validation remains unaffected.
- GitHub Actions validation: in a safe tag/test context or next real release, confirm both macOS matrix jobs reach Tauri notarization using `APPLE_API_KEY_PATH` and publish DMGs only after Linux and macOS asset jobs succeed.
- Negative-path validation, if practical: omit one API-key secret in a safe CI context and confirm the macOS release job fails before certificate import/build with the new prerequisite error.

## Open Questions
None blocking. The plan assumes the repository will use a Team App Store Connect API key for notarization and will intentionally drop Apple ID/app-specific-password CI support.

## References
- `.github/workflows/release.yml`
- `src-tauri/tauri.conf.json`
- `docs/releasing.md`
- `docs/plans/ci-release-efficiency-2026-05-09.md`
- Apple App Store Connect API keys: https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api
- Tauri macOS signing/notarization: https://v2.tauri.app/distribute/sign/macos/
- GitHub Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
