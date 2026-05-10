# GitHub-Hosted APT Setup Install Plan

## Goal
Let Linux users enable the existing CSV Align APT repository from a GitHub-hosted setup package without manually browsing release assets first.

The improved flow should still be repository-backed: fetch the setup `.deb`, install it locally with APT, run `sudo apt update`, then install `csv-align` from the signed APT repository.

## Background
- `README.md:33-58` currently asks users to download `csv-align-repository-setup_1.0_all.deb` from the GitHub Releases page before running `sudo apt install ./csv-align-repository-setup_1.0_all.deb`.
- `docs/releasing.md:105-117` already defines the signed APT repository at `https://ddv1982.github.io/csv-align/apt/` and the setup package name `csv-align-repository-setup_1.0_all.deb`.
- `.github/workflows/release.yml:429-484` already builds the setup `.deb`, validates its keyring/source contents, deploys the apt tree to GitHub Pages, and uploads `csv-align-repository-setup_*.deb` to GitHub Releases.
- `scripts/build_apt_repository.py:491-554` already writes the setup package contents: a repository keyring and Deb822 `.sources` file.
- APT supports local `.deb` installs and configured repositories; the plan should not depend on `sudo apt install https://...deb` working directly. Use an explicit download step, then local `sudo apt install ./...deb`.

## Approach
Use the existing GitHub Releases asset as the stable user-facing setup-package URL:

```text
https://github.com/ddv1982/csv-align/releases/latest/download/csv-align-repository-setup_1.0_all.deb
```

Then update user and maintainer docs to expose that URL with a clear command sequence:

```bash
curl -fsSLo csv-align-repository-setup_1.0_all.deb \
  https://github.com/ddv1982/csv-align/releases/latest/download/csv-align-repository-setup_1.0_all.deb
sudo apt install ./csv-align-repository-setup_1.0_all.deb
sudo apt update
sudo apt install csv-align
```

Prefer this over copying the setup `.deb` into the Pages-hosted apt tree. GitHub Pages should remain the static APT repository host, while GitHub Releases remains the binary asset host. This avoids an extra publication path and reuses the existing release upload.

## Resolved Decisions
- **URL strategy:** use GitHub Releases `latest/download` for the setup package. Use exact tag URLs only for maintainer testing of non-latest or prerelease builds.
- **Command shape:** use explicit `curl` download plus local `sudo apt install`; do not pipe downloaded content into a privileged shell.
- **Setup package version:** keep `csv-align-repository-setup_1.0_all.deb` fixed for this UX change. Revisit only when the setup package’s installed source/keyring contract changes.
- **Release automation:** no script or workflow change is required for the first implementation; the workflow currently generates `csv-align-repository-setup_1.0_all.deb` and uploads it to Releases.
- **Live URL status:** as of 2026-05-10, the `latest/download` URL returns HTTP 200 and redirects to the current `v2.1.66` setup-package asset. Future releases still need the checklist check below.

## Work Items
1. **Update the README Linux install flow.**
   - Replace the manual “download from GitHub Releases” instruction in `README.md:33-58` with the direct `curl` URL.
   - Keep the existing `sudo apt install ./...deb`, `sudo apt update`, and `sudo apt install csv-align` steps.
   - Keep the GNOME Software / Ubuntu Software note and standalone `.deb` fallback note.

2. **Update maintainer release docs.**
   - In `docs/releasing.md:105-187`, add the direct setup-package URL as the canonical end-user bootstrap URL.
   - Mirror the README command block so user docs and release docs do not drift.
   - Document the setup package version policy: keep `1.0` for this docs-only UX change; bump only when the installed setup package contract changes.

3. **Add release checklist coverage for the direct URL.**
   - Extend the existing hosted repository verification near `docs/releasing.md:158-166` with a check that the setup package URL returns successfully.
   - Include a local package-field check after download: `Package: csv-align-repository-setup`, `Version: 1.0`, and `Architecture: all`.
   - State that a setup package version bump must update README commands, release docs, and any workflow filename assumptions in the same change.

4. **Validate the existing release seam.**
   - Confirm `.github/workflows/release.yml:429-484` still generates `csv-align-repository-setup_1.0_all.deb` and uploads it through the GitHub Release asset glob.
   - Treat this as manual review for the docs-only change; do not add release automation unless the seam has drifted.

## Verification Plan
- Static docs check: `README.md` and `docs/releasing.md` use the exact same setup package URL and filename.
- Manual release seam check: `.github/workflows/release.yml` still creates `csv-align-repository-setup_1.0_all.deb` and uploads `csv-align-repository-setup_*.deb`.
- Current URL smoke evidence: on 2026-05-10, `curl -fsSL -o /dev/null -w '%{http_code}' https://github.com/ddv1982/csv-align/releases/latest/download/csv-align-repository-setup_1.0_all.deb` returned `200`.
- Hosted asset smoke check after the next release:
  ```bash
  curl -fsSLo /tmp/csv-align-repository-setup.deb \
    https://github.com/ddv1982/csv-align/releases/latest/download/csv-align-repository-setup_1.0_all.deb
  dpkg-deb --field /tmp/csv-align-repository-setup.deb Package Version Architecture
  ```
- Clean VM install check:
  ```bash
  sudo apt install /tmp/csv-align-repository-setup.deb
  sudo apt update
  apt-cache policy csv-align
  sudo apt install csv-align
  ```
- Existing repository checks remain in force for `InRelease`, `Packages.gz`, DEP-11 metadata, and keyring reachability (`docs/releasing.md:158-166`).

## Open Questions
None blocking. The implementation can proceed with docs-only changes unless direct URL validation reveals an asset-name mismatch.

## References
- `README.md:33-58`
- `docs/releasing.md:105-187`
- `.github/workflows/release.yml:429-484`
- `scripts/build_apt_repository.py:491-554`
- `docs/plans/linux-deb-license-metadata-2026-05-09.md`
- APT `sources.list(5)`: https://manpages.debian.org/unstable/apt/sources.list.5.en.html
- APT `apt-secure(8)`: https://manpages.debian.org/unstable/apt/apt-secure.8.en.html
- GitHub release asset links: https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases
