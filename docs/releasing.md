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

## macOS release prerequisites

The release workflow requires App Store Connect API key authentication for macOS notarization. Apple ID/app-specific-password notarization is not supported in CI.

Configure these GitHub Actions secrets before pushing a release tag:

- `APPLE_CERTIFICATE` — base64-encoded Developer ID Application `.p12` certificate
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_API_ISSUER` — App Store Connect Issuer ID
- `APPLE_API_KEY` — App Store Connect Key ID
- `APPLE_API_PRIVATE_KEY` — single-line base64-encoded `.p8` private key content

Use a Team App Store Connect API key suitable for notarization. The workflow decodes `APPLE_API_PRIVATE_KEY` during the macOS release job and passes the generated `AuthKey_<APPLE_API_KEY>.p8` path to Tauri.

## Debian release prerequisites

The CI workflow normalizes Linux `.deb` packages to the AppStream-friendly desktop id `com.csvalign.desktop.desktop`, then signs them on `push` builds for `main` before uploading the reusable Tauri bundle artifact. Pull request builds still package Linux artifacts without signing because repository secrets and variables are not required for PR validation.

Configure these GitHub Actions secrets before the release-producing `main` push, not just before publishing release tags:

- `DEB_SIGNING_PRIVATE_KEY` — single-line base64-encoded ASCII-armored GPG private key dedicated to Debian package signing
- `DEB_SIGNING_KEY_FINGERPRINT` — full fingerprint for the Debian signing key
- `DEB_SIGNING_KEY_PASSPHRASE` — passphrase for the Debian signing key; if the key is intentionally unprotected, document that exception before enabling release signing

Configure this GitHub Actions repository variable for release-time verification:

- `DEB_SIGNING_PUBLIC_KEY` — single-line base64-encoded ASCII-armored GPG public key matching `DEB_SIGNING_KEY_FINGERPRINT`

The `.deb` signature is embedded with `dpkg-sig --sign builder`. Missing signing inputs, missing `.deb` packages, fingerprint mismatches, signing failures, and verification failures stop CI before the reusable artifact is uploaded. The release workflow does not re-sign or rebuild Linux packages; it imports the public key and runs `dpkg-sig --verify-role builder` before uploading the downloaded `.deb` assets to GitHub Releases.

Maintainers can verify a downloaded release asset locally after importing the public key:

```bash
dpkg-sig --verify-role builder path/to/csv-align_*.deb
```

## APT repository release asset prerequisites

Tagged releases also build a minimal signed APT repository from the exact `.deb` artifact downloaded from CI. The release workflow publishes it as `csv-align-apt-repository-vX.Y.Z.tar.gz`. The tarball is a static repository tree suitable for syncing to HTTPS hosting, for example GitHub Pages or another static web host:

```text
pool/main/c/csv-align/csv-align_*.deb
dists/stable/InRelease
dists/stable/Release
dists/stable/Release.gpg
dists/stable/main/binary-amd64/Packages
dists/stable/main/binary-amd64/Packages.gz
dists/stable/main/dep11/Components-amd64.yml
dists/stable/main/dep11/Components-amd64.yml.gz
csv-align-archive-keyring.pgp
```

Configure these GitHub Actions secrets before publishing a release that should include the APT repository asset:

- `APT_REPO_SIGNING_PRIVATE_KEY` — single-line base64-encoded ASCII-armored GPG private key dedicated to signing APT repository `Release` metadata
- `APT_REPO_SIGNING_KEY_FINGERPRINT` — full fingerprint for the APT repository signing key
- `APT_REPO_SIGNING_KEY_PASSPHRASE` — passphrase for the APT repository signing key; if the key is intentionally unprotected, document that exception before enabling repository signing

A dedicated APT repository signing key is preferred. Until those `APT_REPO_SIGNING_*` secrets are configured, the release job falls back to the existing `DEB_SIGNING_*` package-signing key so releases still produce a signed repository asset. `dpkg-sig` signs the `.deb`; APT trusts the repository by verifying `InRelease` / `Release.gpg`. The release job exports the selected public repository key as `csv-align-archive-keyring.pgp` inside the repository tree.

Local repository generation for a downloaded release `.deb`:

```bash
python3 scripts/build_apt_repository.py \
  --output apt-repository \
  --suite stable \
  --gpg-key "$APT_REPO_SIGNING_KEY_FINGERPRINT" \
  path/to/csv-align_*.deb
```

Use `--unsigned` only for local smoke tests; do not publish an unsigned APT repository.

After syncing the extracted repository tree to HTTPS hosting, users should install it with a `Signed-By` keyring file rather than `apt-key` or global trust. Example for a repository hosted at `https://example.com/csv-align-apt/`:

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://example.com/csv-align-apt/csv-align-archive-keyring.pgp \
  | sudo tee /etc/apt/keyrings/csv-align-archive-keyring.pgp >/dev/null
sudo tee /etc/apt/sources.list.d/csv-align.sources >/dev/null <<'EOF'
Types: deb
URIs: https://example.com/csv-align-apt/
Suites: stable
Components: main
Architectures: amd64
Signed-By: /etc/apt/keyrings/csv-align-archive-keyring.pgp
EOF
sudo apt update
sudo apt install csv-align
```

The repository includes DEP-11 `Components-amd64.yml.gz` metadata generated from the packaged AppStream metainfo and desktop file. That catalog-level metadata is what gives APT-backed software centers the strongest package-to-app license association.

## Linux software-center metadata verification

CI normalizes each built `.deb` before validation/signing because Tauri currently emits a product-name desktop file (`CSV Align.desktop`). The normalizer renames that packaged launcher to `com.csvalign.desktop.desktop` and keeps AppStream `<launchable type="desktop-id">` aligned. CI then validates the normalized `.deb` before signing/upload, and the release workflow repeats the same read-only check after signature verification and before GitHub Release upload:

```bash
python3 scripts/validate_linux_deb_metadata.py \
  'src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/*.deb' \
  --json-report deb-metadata-report.json
```

The validator enforces the AppStream component id `com.csvalign.desktop`, project license `MIT`, binary `csv-align`, and desktop id `com.csvalign.desktop.desktop`. If Ubuntu Software or GNOME Software shows “Unknown license,” treat that as evidence that the app license did not reach GNOME Software, even when `/usr/share/doc/csv-align/copyright` exists in the Debian package.

Manual extraction fallback for a downloaded artifact:

```bash
workdir="$(mktemp -d)"
dpkg-deb -x path/to/csv-align_*.deb "$workdir/root"
appstreamcli validate --no-net "$workdir/root/usr/share/metainfo/com.csvalign.desktop.metainfo.xml"
desktop-file-validate "$workdir/root/usr/share/applications/com.csvalign.desktop.desktop"
grep -n '<project_license>MIT</project_license>' "$workdir/root/usr/share/metainfo/com.csvalign.desktop.metainfo.xml"
grep -n '<launchable type="desktop-id">com.csvalign.desktop.desktop</launchable>' "$workdir/root/usr/share/metainfo/com.csvalign.desktop.metainfo.xml"
```

After installing the `.deb` on Ubuntu, refresh and query AppStream metadata before opening the software center:

```bash
sudo appstreamcli refresh-cache --force
appstreamcli get com.csvalign.desktop
```

If the artifact validator and `appstreamcli get com.csvalign.desktop` both report MIT but GNOME Software still shows an unknown license, reproduce in a clean Ubuntu VM before changing package metadata again. Install the same `.deb`, refresh the AppStream cache, query `com.csvalign.desktop`, then open GNOME Software/Ubuntu Software and inspect the license tile.

## GitHub Actions behavior

Pushing a tag matching `v*` triggers the release workflow.

The CI workflow runs Rust tests/formatting/clippy, Tauri wrapper tests, frontend tests/lint/build, and validates that release metadata stays aligned across the documented version-bearing files. For Tauri-impacting changes, CI also publishes two 7-day artifacts used by the release workflow: the Linux package bundle and `csv-align-frontend-dist`.

The tagged release workflow validates release metadata against the tag, checks the Rust, Tauri, and frontend validation suite, expects a matching non-empty `CHANGELOG.md` section, verifies both CI artifacts exist before creating or refreshing the draft GitHub Release, uploads the packaged assets, and only publishes the final GitHub Release after packaging succeeds.

If the CI artifacts expire before publishing, rerun CI on the `main` push commit that the tag points to; the tag push itself does not create those artifacts. Then rerun the release workflow for the tag.

Tauri packaging currently targets Linux and macOS only. The Tauri `beforeBuildCommand` uses a Bash script, so Windows local packaging is not a supported release path right now.
