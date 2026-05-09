# Debian Build Signing Plan

## Goal
Add signed `.deb` release artifacts for the Linux Tauri build without changing the current GitHub Release topology, Linux artifact reuse, or macOS signing/notarization flow.

## Background
- Linux packages are built in CI on `ubuntu-22.04` by `cargo tauri build --target x86_64-unknown-linux-gnu`, then uploaded as `csv-align-linux-x86_64-release-bundle` (`.github/workflows/ci.yml:226-249`).
- The release workflow downloads that reusable CI artifact and uploads `**/*.deb` plus `**/*.AppImage` to GitHub Releases (`.github/workflows/release.yml:187-213`).
- `src-tauri/tauri.conf.json` enables all Tauri bundle targets and has only minimal Linux `deb`/`rpm` overrides today (`src-tauri/tauri.conf.json:23-38`).
- Existing release docs cover macOS signing secrets and CI artifact reuse, but not Linux `.deb` signing (`docs/releasing.md:64-93`).
- Tauri’s Linux signing guide currently documents optional AppImage GPG signing, not Debian package signing. Tauri’s Debian guide and config reference expose `bundle > linux > deb` settings, but no native `.deb` signing switch.
- Debian’s `dpkg-sig` tool creates and verifies signatures embedded in `.deb` archives. Debian’s broader package-signing docs still treat archive/repository signing as the default apt trust model, so repository metadata signing should be a separate future plan if CSV Align starts publishing an apt repository.

## Decision
Use embedded per-package `.deb` signatures with `dpkg-sig` in the existing Linux CI build. Sign after Tauri produces the `.deb` and before CI uploads the reusable release artifact.

Do not add a second Linux build or signing path in `.github/workflows/release.yml`. The release workflow should publish the signed CI artifact unchanged, with a mandatory verification-only guard before upload.

## Approach
The authoritative seam is the `build-tauri` job in `.github/workflows/ci.yml`, between `Build Tauri app` and `Upload reusable Tauri bundle artifact` (`.github/workflows/ci.yml:226-249`). CI runs on both `push` and `pull_request` (`.github/workflows/ci.yml:3-6`), so signing should be mandatory only for release-producing `push` builds on `main`; pull request builds should still package for validation without requiring signing secrets.

For `push` builds on `main`, add a fail-closed signing block:

1. Install Debian signing tooling from apt (`dpkg-sig` and `gnupg`).
2. Validate Linux signing secrets before touching generated packages.
3. Import a dedicated Debian signing key into a temporary `GNUPGHOME`.
4. Configure noninteractive signing for a passphrase-protected key, using loopback pinentry/passphrase handling without echoing secret values.
5. Sign every generated `src-tauri/target/${TAURI_TARGET}/release/bundle/deb/*.deb` with `dpkg-sig --sign builder` and the configured key fingerprint.
6. Verify every signed `.deb` with `dpkg-sig --verify-role builder` before the artifact upload step.
7. Clean up decoded key material and keep the existing upload paths unchanged.

Use a dedicated Debian signing key rather than reusing Apple certificates or `GITHUB_TOKEN`.

Recommended GitHub Actions secret and variable contract:

| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `DEB_SIGNING_PRIVATE_KEY` | Secret | Yes | Base64-encoded ASCII-armored GPG private key for Debian package signing. |
| `DEB_SIGNING_KEY_FINGERPRINT` | Secret | Yes | Full fingerprint used to select and verify the imported signing key. |
| `DEB_SIGNING_KEY_PASSPHRASE` | Secret | Recommended | Passphrase for the imported private key. If the key is deliberately unprotected, document that exception before enabling signing. |
| `DEB_SIGNING_PUBLIC_KEY` | Repository variable | Yes | Base64-encoded ASCII-armored GPG public key used by the release workflow to verify downloaded `.deb` signatures without private key access. |

For release-producing `main` pushes, failure should stop the CI job if any required secret is missing, no `.deb` is found, key import/fingerprint validation fails, signing fails, or verification fails. That prevents unsigned `.deb` packages from entering the CI artifact consumed by tag releases. Pull request builds can skip signing because release validation later consumes the successful CI run for the tagged `main` commit, not PR artifacts (`.github/workflows/release.yml:36-83`).

## Work Items
1. **Document the Debian signing contract first.**
   - Add `docs/releasing.md` guidance near the macOS prerequisites.
   - List the Debian signing secrets, key format, and fail-closed behavior.
   - State that `.deb` signatures are embedded with `dpkg-sig`, while apt repository metadata signing is out of scope until there is an apt repository.

2. **Add CI signing after Linux Tauri packaging.**
   - Modify `.github/workflows/ci.yml` `build-tauri` after `Build Tauri app` and before `Upload reusable Tauri bundle artifact`.
   - Install `dpkg-sig`/`gnupg`, validate signing secrets for `push` builds on `main`, import the key into a temporary `GNUPGHOME`, configure noninteractive passphrase handling, discover packages, run `dpkg-sig --sign builder`, and verify with `dpkg-sig --verify-role builder`.
   - Keep the existing artifact name and upload globs unchanged so `.github/workflows/release.yml` can continue reusing the CI artifact.

3. **Add release-side verification, not release-side signing.**
   - In `.github/workflows/release.yml`, install `dpkg-sig` after `Download reusable Tauri bundle artifact from CI`, import the configured public key in a temporary keyring, and verify downloaded `.deb` signatures with role `builder` before `Upload Linux packages`.
   - Do not decode private signing keys or mutate packages in the release workflow.

4. **Prepare operator-facing verification notes.**
   - Add a short maintainer check such as `dpkg-sig --verify-role builder <asset>.deb` to `docs/releasing.md`.
   - Keep README/release-note/user-facing verification docs out of scope for this plan.

## Verification Plan
- Static workflow review: `.github/workflows/ci.yml` signs and verifies `.deb` files before the artifact upload step and leaves the upload paths unchanged.
- Static release review: `.github/workflows/release.yml` does not re-sign or rebuild Linux packages and verifies downloaded `.deb` signatures before upload.
- Negative main-push CI check: with a required Debian signing secret missing, `build-tauri` fails before uploading the release-consumed CI artifact.
- Pull request CI check: Tauri packaging can still run without repository secrets and does not require signing for PR artifacts.
- Positive main-push CI check: with valid signing secrets, CI logs show every generated `.deb` signed with role `builder` and `dpkg-sig --verify-role builder` succeeds.
- Artifact check: download the CI artifact or GitHub Release `.deb` and run `dpkg-sig --verify-role builder` locally.
- Regression checks for repo changes: for workflow/docs-only implementation, use static workflow review plus GitHub Actions validation; if source code changes accompany it, keep the existing release validation commands from `docs/releasing.md`.

## Open Questions
None blocking. This plan intentionally solves direct GitHub Release `.deb` artifact signing; apt repository signing should be planned only if the distribution model changes.

## References
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `src-tauri/tauri.conf.json`
- `docs/releasing.md`
- `docs/plans/app-store-connect-api-release-auth-2026-05-09.md`
- `docs/plans/ci-release-efficiency-2026-05-09.md`
- Tauri Linux code signing: https://v2.tauri.app/distribute/sign/linux/
- Tauri Debian packaging: https://v2.tauri.app/distribute/debian/
- Tauri Linux config reference: https://tauri.app/reference/config#linuxconfig
- Debian `dpkg-sig(1)`: https://manpages.debian.org/bullseye/dpkg-sig/dpkg-sig.1.en.html
- Debian `debsig-verify(1)`: https://manpages.debian.org/testing/debsig-verify/debsig-verify.1.en.html
- Debian package signing manual: https://www.debian.org/doc/manuals/securing-debian-manual/deb-pack-sign.en.html
