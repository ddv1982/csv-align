# Linux Debian License Metadata Plan

## Goal
Fix the release and distribution process so CSV Align exposes software-center-usable MIT license metadata in two paths:

1. **Direct `.deb` install:** the package artifact contains valid Debian copyright, desktop, and AppStream metainfo before it is signed and published.
2. **Software Center discovery/install:** a hosted signed APT repository publishes package metadata plus AppStream/DEP-11 catalog metadata so GNOME Software/Ubuntu Software can search for CSV Align and install it through the normal repository-backed app route. After the repository is enabled, `sudo apt update && sudo apt install csv-align` must work on supported Debian/Ubuntu derivatives.

Direct `.deb` installation should remain supported, but the strongest Software Center behavior comes from repository-backed AppStream metadata, not from a standalone local package alone.

## Background
- The installed screenshot is from version `2.1.61`, the release that added source-level Linux package metadata. The source now declares Tauri bundle `license: "MIT"`, `licenseFile: "../LICENSE"`, and custom `.deb` file mappings for Debian copyright plus AppStream metainfo (`src-tauri/tauri.conf.json:28-39`).
- The AppStream source file declares `<metadata_license>MIT</metadata_license>` and `<project_license>MIT</project_license>` (`src-tauri/appstream/com.csvalign.desktop.metainfo.xml:1-22`). Local `appstreamcli validate --no-net` succeeds with only `content-rating-missing`, and `appstreamcli check-license MIT` reports MIT is valid for AppStream metadata and free/open source.
- Current tests verify source JSON/XML strings and file existence, but not the built `.deb`, the installed file tree, AppStream composition/query behavior, or GNOME Software ingestion (`tests/linux_package_metadata_integration.rs:6-82`).
- GNOME Software’s metadata guide says the license tile is driven by metainfo `<project_license>`; its current safety-tile code shows “Unknown license” when `gs_app_get_license(app)` is `NULL` (Debian source `gs-app-context-bar.c:1560-1572`). Debian copyright metadata is still worth shipping, but it is not enough for the software-center license tile.
- Tauri’s Debian docs support `bundle.linux.deb.files`, with source paths relative to `tauri.conf.json`; they do not claim `.deb` AppStream metadata is generated automatically. A Tauri issue requesting generated metainfo for Debian bundles is still open, so CSV Align should own and validate this metadata explicitly.
- Debian/Ubuntu Software Center search is repository-oriented: Debian AppStream tooling composes application metadata from enabled package archives, and clients such as GNOME Software and KDE Discover consume that metadata. A local standalone `.deb` may install correctly and even contain valid metainfo, but it is not the same distribution path as an enabled APT repository with AppStream/DEP-11 catalog data.

## Diagnosis Strategy
Treat the visible “Unknown license” as evidence that GNOME Software did not receive a usable app license, not as proof that the source XML is wrong. Isolate the failure in this order:

1. **Artifact contents:** extract the exact `.deb` users install and prove it contains:
   - `/usr/share/metainfo/com.csvalign.desktop.metainfo.xml`
   - `/usr/share/doc/csv-align/copyright`
   - the generated `/usr/share/applications/*.desktop` file
2. **AppStream validity:** validate the extracted metainfo, not just the source file, and confirm `<project_license>MIT</project_license>` survives packaging.
3. **Component matching:** compare AppStream `<id>`, `<launchable type="desktop-id">…</launchable>`, the generated desktop-file basename, desktop `Exec`, and `mainBinaryName`. The current source uses `CSV Align.desktop` (`src-tauri/appstream/com.csvalign.desktop.metainfo.xml:11`); do not guess whether that is correct—extract the package and enforce the observed/canonical value.
4. **Cache/client behavior:** if extracted metadata and `appstreamcli` queries show MIT but GNOME Software still shows unknown, reproduce in a clean Ubuntu VM and document cache refresh/clean-room steps before changing package metadata again.

## Approach
Keep Tauri as the package builder and keep `release.yml` publishing the reusable CI artifact. Add a Linux `.deb` metadata validator that runs on the built artifact before signing/upload, then run the same read-only validation in the release workflow before GitHub Release upload.

The likely code fix is to make the AppStream launchable desktop-id match the packaged desktop file. Work Item 1 is blocking for metadata edits: after extraction, choose exactly one desktop-id contract for release gates. Prefer a stable reverse-DNS desktop id such as `com.csvalign.desktop.desktop` if Tauri’s supported `DebConfig.desktopTemplate` path can emit it cleanly; otherwise use the actual Tauri-generated desktop basename and make CI/release enforce that exact value. Do not rely on Debian copyright or Tauri’s package-level `license` field alone for GNOME Software.

Add a second distribution lane for Software Center searchability: publish a signed APT repository at a stable HTTPS URL, generate `Packages` metadata and AppStream/DEP-11 catalog metadata from the same validated `.deb`, and provide an optional repository bootstrap package that installs the archive keyring plus Deb822 source file. This lets users enable the CSV Align repository once, then find/install CSV Align via APT and Software Center like other repository-backed desktop apps.

## Work Items
1. **Extract one current release `.deb` and record the actual desktop/AppStream state.**
   - Use `dpkg-deb -x` on the v2.1.61 artifact from the release or CI artifact.
   - Record metainfo path, desktop file basename, desktop `Name`/`Exec`/`Icon`, AppStream `<id>`, `<project_license>`, `<launchable>`, and `<provides><binary>`.
   - This determines whether the immediate fix is missing packaged metainfo, launchable/desktop mismatch, or client cache behavior.

2. **Lock the source metadata contract.**
   - Update `src-tauri/appstream/com.csvalign.desktop.metainfo.xml` only after Work Item 1 identifies the correct desktop-id contract.
   - Keep `MIT` for both `<metadata_license>` and `<project_license>`.
   - Keep `src-tauri/tauri.conf.json` installing metainfo under `/usr/share/metainfo/` and copyright under `/usr/share/doc/csv-align/copyright`.
   - If Tauri emits an awkward desktop filename, use the supported `bundle.linux.deb.desktopTemplate` field (Tauri `DebConfig`) or another Tauri-supported path rather than post-build mutation.

3. **Add a package artifact validator.**
   - Add `scripts/validate_linux_deb_metadata.py`.
   - Inputs: `.deb` glob, expected component id, expected license, expected binary, expected desktop-id, optional JSON report path.
   - Behavior: extract each `.deb`, assert required files exist, parse AppStream XML and desktop file, run `appstreamcli validate --no-net` and `desktop-file-validate`, and fail with clear messages for missing/invalid metadata.
   - Support a temporary investigation mode that prints detected desktop ids, but make CI/release gate mode require one exact desktop-id.
   - Output: concise console summary plus JSON containing detected metainfo path, desktop path, project license, launchable, binary, AppStream validation result, and package filename.

4. **Strengthen source-level regression tests.**
   - Expand `tests/linux_package_metadata_integration.rs` so it checks relationships, not just string presence: Tauri identifier ↔ AppStream id, Tauri main binary ↔ AppStream binary, Tauri version ↔ release version, and AppStream launchable ↔ the chosen desktop-id contract.
   - Do not expand `scripts/check_release_metadata.py` unless artifact validation leaves a source-only blind spot; the immediate problem is the packaged artifact, not version/changelog metadata.

5. **Gate CI before signing and artifact upload.**
   - In `.github/workflows/ci.yml`, extend `Install dependencies (Ubuntu)` (`.github/workflows/ci.yml:208-211`) with `appstream` and `desktop-file-utils`.
   - Add a `Validate Debian package metadata` step immediately after `Build Tauri app` (`.github/workflows/ci.yml:230-238`) and before `Install Debian signing tools` / `Sign Debian packages` (`.github/workflows/ci.yml:240-343`).
   - Run the validator for pull requests and main pushes; signing secrets remain required only for main pushes.
   - Append the validator JSON/summary to `$GITHUB_STEP_SUMMARY` so release diagnosis starts from artifact evidence.

6. **Gate release before publishing.**
   - In `.github/workflows/release.yml`, extend `Install Debian signature verification tools` (`.github/workflows/release.yml:203-206`) into `Install Debian signature and metadata validation tools` with `dpkg-sig`, `gnupg`, `appstream`, and `desktop-file-utils`.
   - Add `Validate Debian package metadata` after `Verify Debian package signatures` (`.github/workflows/release.yml:208-282`) and before `Upload Linux packages` (`.github/workflows/release.yml:284-295`).
   - Keep release read-only: do not rebuild, re-sign, or mutate Linux packages in the release workflow.

7. **Document maintainer reproduction after the validator exists.**
   - Add a short `docs/releasing.md` section for Linux software-center metadata verification.
   - Include the validator command, a minimal manual extraction fallback, `appstreamcli refresh-cache --force`, `appstreamcli get com.csvalign.desktop`, and a clean-VM GNOME Software fallback only if artifact checks pass but the UI still shows unknown.
   - Explicitly state that “Unknown license” means the app license did not reach GNOME Software, even if Debian copyright exists.

8. **Add a repository-backed Software Center install path.**
   - Build and publish a signed APT repository from the release `.deb` at a stable HTTPS URL, preferably GitHub Pages under a predictable path such as `https://ddv1982.github.io/csv-align/apt/`.
   - Generate repository `Packages`/`Packages.gz`, signed `Release` metadata, `InRelease`, detached `Release.gpg`, and AppStream/DEP-11 `Components-<arch>.yml.gz` metadata that includes CSV Align’s component id, package name, desktop launchable id, binary, release version, summary, and MIT project license.
   - Add a release asset for a minimal repository setup package, for example `csv-align-repository-setup_1.0_all.deb`, that installs `/usr/share/keyrings/csv-align-archive-keyring.pgp` and `/etc/apt/sources.list.d/csv-align.sources` using `Signed-By`.
   - Keep the setup package independently versioned from the app. It should change only when the repository URL, keyring, source configuration, or pinning changes; the app package remains versioned as `csv-align_<app-version>_<arch>.deb`.
   - Update `README.md` with the recommended Linux install path: install the repository setup package once, run `sudo apt update`, then install via `sudo apt install csv-align` or search for CSV Align through APT/GNOME Software/Ubuntu Software.
   - Update `docs/releasing.md` with maintainer-facing release and verification details for publishing the APT repository, setup package, and Software Center metadata.
   - Make clear in both documents that CSV Align becomes searchable in Software Center only after the repository is enabled and the system metadata cache has refreshed.
   - Treat standalone `.deb` double-click installation as a fallback path. It should contain correct metadata, but it cannot provide the same repository-level discoverability guarantees as a signed APT repo with AppStream/DEP-11 metadata.

## Verification Plan
- `appstreamcli validate --no-net src-tauri/appstream/com.csvalign.desktop.metainfo.xml` succeeds with no errors.
- `appstreamcli check-license MIT` confirms MIT is suitable and free/open source.
- `cargo test --test linux_package_metadata_integration` covers source relationship drift.
- A fresh Linux Tauri build produces a `.deb` that passes `scripts/validate_linux_deb_metadata.py`.
- CI fails before signing/upload if the `.deb` lacks metainfo, has no MIT project license, or has a launchable/desktop mismatch.
- Release fails before GitHub asset upload if the downloaded signed `.deb` fails the same metadata validator.
- Manual Ubuntu VM check for direct package fallback: install the release `.deb`, refresh AppStream cache, verify `appstreamcli get com.csvalign.desktop` reports MIT, then confirm whether GNOME Software still treats the local package as unknown.
- Manual Ubuntu/Zorin VM check for repository-backed discovery: install the repository setup package, run `sudo apt update`, confirm the CSV Align repo metadata is present under `/var/lib/apt/lists/`, verify `sudo apt install csv-align` resolves from the CSV Align repository, verify `appstreamcli get com.csvalign.desktop --details` reports MIT and package `csv-align`, then search for “CSV Align” in GNOME Software/Ubuntu Software and install it from that route.
- Release verification fails if the hosted APT repository tarball lacks signed `Release` metadata, valid `Packages` metadata, or DEP-11 metadata carrying the CSV Align MIT project license.

## Resolved Decisions and Remaining Operational Prerequisite
- The packaged desktop-id contract is `com.csvalign.desktop.desktop`; the CI/release normalizer and validator enforce that value.
- The repository setup package is named `csv-align-repository-setup` and currently uses independent setup package version `1.0`.
- The hosted APT repository path is `https://ddv1982.github.io/csv-align/apt/`; the release workflow deploys the generated repository tree there through GitHub Pages.
- Remaining operational prerequisite before claiming live Software Center searchability: GitHub Pages for `ddv1982/csv-align` must be configured to deploy from GitHub Actions, and the tagged release workflow must complete successfully.

## References
- `src-tauri/tauri.conf.json`
- `src-tauri/appstream/com.csvalign.desktop.metainfo.xml`
- `src-tauri/debian/copyright`
- `tests/linux_package_metadata_integration.rs`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/releasing.md`
- `README.md`
- Tauri Debian packaging: https://v2.tauri.app/distribute/debian/
- Tauri config reference: https://tauri.app/reference/config/#bundleconfig
- GNOME Software metadata guide: https://help.gnome.org/gnome-software/software-metadata.html
- GNOME Software safety-tile license fallback: https://sources.debian.org/src/gnome-software/48.3-2/src/gs-app-context-bar.c/
- AppStream metadata specification: https://freedesktop.org/software/appstream/docs/chap-Metadata.html
- AppStream CLI manual: https://freedesktop.org/software/appstream/docs/re01.html
- AppStream DEP-11 YAML: https://www.freedesktop.org/software/appstream/docs/sect-AppStream-YAML.html
- Debian AppStream: https://wiki.debian.org/AppStream
- Debian third-party repositories: https://wiki.debian.org/DebianRepository/UseThirdParty
- Tauri metainfo feature request for Debian bundles: https://github.com/tauri-apps/tauri/issues/10077
