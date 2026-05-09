# Linux Debian License Metadata Plan

## Goal
Fix the release process so installing the CSV Align `.deb` no longer leaves GNOME Software/Ubuntu Software with a `NULL`/unknown license, and add gates that prove the released artifact contains software-center-usable MIT metadata before it is signed and published.

## Background
- The installed screenshot is from version `2.1.61`, the release that added source-level Linux package metadata. The source now declares Tauri bundle `license: "MIT"`, `licenseFile: "../LICENSE"`, and custom `.deb` file mappings for Debian copyright plus AppStream metainfo (`src-tauri/tauri.conf.json:28-39`).
- The AppStream source file declares `<metadata_license>MIT</metadata_license>` and `<project_license>MIT</project_license>` (`src-tauri/appstream/com.csvalign.desktop.metainfo.xml:1-22`). Local `appstreamcli validate --no-net` succeeds with only `content-rating-missing`, and `appstreamcli check-license MIT` reports MIT is valid for AppStream metadata and free/open source.
- Current tests verify source JSON/XML strings and file existence, but not the built `.deb`, the installed file tree, AppStream composition/query behavior, or GNOME Software ingestion (`tests/linux_package_metadata_integration.rs:6-82`).
- GNOME Software’s metadata guide says the license tile is driven by metainfo `<project_license>`; its current safety-tile code shows “Unknown license” when `gs_app_get_license(app)` is `NULL` (Debian source `gs-app-context-bar.c:1560-1572`). Debian copyright metadata is still worth shipping, but it is not enough for the software-center license tile.
- Tauri’s Debian docs support `bundle.linux.deb.files`, with source paths relative to `tauri.conf.json`; they do not claim `.deb` AppStream metadata is generated automatically. A Tauri issue requesting generated metainfo for Debian bundles is still open, so CSV Align should own and validate this metadata explicitly.

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

## Verification Plan
- `appstreamcli validate --no-net src-tauri/appstream/com.csvalign.desktop.metainfo.xml` succeeds with no errors.
- `appstreamcli check-license MIT` confirms MIT is suitable and free/open source.
- `cargo test --test linux_package_metadata_integration` covers source relationship drift.
- A fresh Linux Tauri build produces a `.deb` that passes `scripts/validate_linux_deb_metadata.py`.
- CI fails before signing/upload if the `.deb` lacks metainfo, has no MIT project license, or has a launchable/desktop mismatch.
- Release fails before GitHub asset upload if the downloaded signed `.deb` fails the same metadata validator.
- Manual Ubuntu VM check: install the release `.deb`, refresh AppStream cache, verify `appstreamcli get com.csvalign.desktop` reports MIT, then confirm GNOME Software no longer shows “Unknown license.”

## Open Questions
- **Blocking before metadata edits:** what exact desktop-file basename is inside the current v2.1.61 `.deb`?
- **Blocking before choosing the desktop-id contract:** can Tauri v2 emit the preferred reverse-DNS desktop filename through `bundle.linux.deb.desktopTemplate` in this repo, or should the validator enforce Tauri’s generated basename?

These do not require more user input; Work Item 1 answers them from the artifact.

## References
- `src-tauri/tauri.conf.json`
- `src-tauri/appstream/com.csvalign.desktop.metainfo.xml`
- `src-tauri/debian/copyright`
- `tests/linux_package_metadata_integration.rs`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/releasing.md`
- Tauri Debian packaging: https://v2.tauri.app/distribute/debian/
- Tauri config reference: https://tauri.app/reference/config/#bundleconfig
- GNOME Software metadata guide: https://help.gnome.org/gnome-software/software-metadata.html
- GNOME Software safety-tile license fallback: https://sources.debian.org/src/gnome-software/48.3-2/src/gs-app-context-bar.c/
- AppStream metadata specification: https://freedesktop.org/software/appstream/docs/chap-Metadata.html
- AppStream CLI manual: https://freedesktop.org/software/appstream/docs/re01.html
- Tauri metainfo feature request for Debian bundles: https://github.com/tauri-apps/tauri/issues/10077
