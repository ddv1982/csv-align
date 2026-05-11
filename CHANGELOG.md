# Changelog

## v2.1.75 - 2026-05-11

- Fixed standalone HTML reports so Inspect actions and one-sided detail text stack with the same neat layout as the in-app results table.
- Added app and export regression coverage for detail text layout parity without embedding user-provided sample data.

## v2.1.74 - 2026-05-11

- Hardened flexible row-key matching so shared anchors respect case-sensitive normalization and reject conflicting numeric or embedded identifier tokens.
- Added limits and regression coverage for broad flexible key scans so wildcard-style matching fails fast with actionable guidance instead of doing excessive pair comparisons.

## v2.1.73 - 2026-05-11

- Supported flexible `**` row-key matching across mismatched selected key counts while preserving File A key shape in compare responses and CSV exports.
- Added a fail-fast validation guard for overly broad flexible key candidate sets so wildcard comparisons return actionable guidance instead of entering an expensive matching path.

## v2.1.72 - 2026-05-11

- Fixed explicit `**` row-key matching when the wildcard span crosses selected key component boundaries.
- Added neutral regression coverage for boundary-aware wildcard matching, single-asterisk literals, unrelated component redistribution, and match ordering.

## v2.1.71 - 2026-05-11

- Fixed standalone HTML exports so the match-rate progress fill renders at the intended full height.
- Added regression coverage for exported progress styling and ignored generated Python bytecode cache artifacts.

## v2.1.70 - 2026-05-10

- Improved the results table KEY column width so short numeric keys stay readable instead of wrapping into stacked digits in narrow cells.
- Kept in-app and standalone HTML export table styling aligned with shared key-column sizing and regression coverage.

## v2.1.69 - 2026-05-10

- Fixed the Linux APT repository setup installer so the downloaded temporary setup package is readable by APT's `_apt` sandbox before installation, avoiding the unsandboxed root access notice.

## v2.1.68 - 2026-05-10

- Clarified the Linux install lore so the one-time APT repository setup and normal package install commands are shown as separate terminal steps.
- Split the Ubuntu/Debian setup commands into copy-safe blocks, reducing the chance that the release setup script is skipped during manual installs.

## v2.1.67 - 2026-05-10

- Added a hosted `install-apt-repo.sh` release asset so Linux users can enable the signed APT repository with one command before installing `csv-align` through APT.
- Refreshed the README install section with macOS DMG guidance, Linux repository install instructions, and compact technology badges.

## v2.1.66 - 2026-05-10

- Removed the custom APT repository `.tar.gz` release asset while keeping the signed repository published through GitHub Pages.
- Updated release documentation so maintainers expect `.deb`, `.AppImage`, and repository setup assets without the extra repository archive.

## v2.1.65 - 2026-05-10

- Published the repository-backed Linux install path, including the setup package asset, GitHub Pages APT deployment, and release-time repository sanity checks.
- Hardened APT repository generation by deriving pool filenames from Debian control metadata and covering setup-package contents plus spaced source artifact names in tests.

## v2.1.64 - 2026-05-10

- Added signed APT repository generation for Linux releases, including Packages indexes, Release/InRelease signatures, exported keyring material, and DEP-11 catalog metadata for software centers.
- Normalized the Debian desktop id to the reverse-DNS AppStream launchable contract before package signing so `.deb` artifacts and repository metadata agree on `com.csvalign.desktop.desktop`.

## v2.1.63 - 2026-05-09

- Fixed the tagged release Linux asset job so it checks out the repository before running the Debian package metadata validator.
- Re-ran the Debian metadata gate release path after the v2.1.62 workflow exposed the missing checkout in the release-only job.

## v2.1.62 - 2026-05-09

- Added a Debian package artifact validator that extracts `.deb` files and gates AppStream MIT license, desktop launchable, binary, copyright, and desktop-entry metadata before release publishing.
- Wired Linux package metadata validation into CI and tagged releases before signing/upload, with maintainer documentation for diagnosing GNOME Software license metadata.

## v2.1.61 - 2026-05-09

- Added Linux software-center metadata so Ubuntu/GNOME Software reports the package license as MIT instead of unknown.
- Included Debian copyright metadata in the `.deb` bundle alongside the existing signed package artifacts.

## v2.1.60 - 2026-05-09

- Added CI-time Debian `.deb` signing with a dedicated GPG key, verifying signed Linux packages before the reusable release artifact is uploaded.
- Added release-side `.deb` signature verification and documented the Debian signing secrets, public-key variable, and maintainer verification flow.

## v2.1.59 - 2026-05-09

- Improved the in-app and standalone HTML report KEY column so multi-part row keys render as stacked compact chips instead of a cramped truncated line.
- Added regression coverage for app/export key-chip parity and export-side key escaping, then prepared the v2.1.59 patch release.

## v2.1.58 - 2026-05-09

- Fixed the file selection dropzone accessibility semantics so the drag-and-drop area no longer nests an interactive button while preserving the real local CSV picker control.
- Reduced repeated frontend step panel markup with shared intro/action primitives, aligned the Tailwind v4 result-surface token ownership, and prepared the v2.1.58 patch release.

## v2.1.57 - 2026-05-09

- Fixed exported HTML comparison detail panels so File A, arrow, and File B values keep the same readable side-by-side layout as the in-app results view, including long sensitive values.
- Added export regression coverage for the standalone diff-grid placement rules and prepared the v2.1.57 patch release.

## v2.1.56 - 2026-05-09

- Renamed the restored dark design-system primitives away from KINETIC terminology, moving app colors into semantic Tailwind v4 `@theme` tokens and neutral shared surface classes.
- Kept the HTML results report visually aligned with the in-app comparison view by sharing the same dark result-surface CSS, buttons, cards, filters, tables, and detail-panel styling.

## v2.1.55 - 2026-05-09

- Reworked the HTML results export to share the app results styling surface, keeping reports visually aligned with in-app cards, filters, summary stats, tables, badges, and detail panels.
- Captured the active app theme in exported HTML reports while preserving standalone filtering, search, sorting, expandable details, and browser/Tauri export delivery.

## v2.1.54 - 2026-05-09

- Switched macOS release notarization in CI to require App Store Connect API key authentication, removing the Apple ID/app-specific-password fallback path.
- Documented the required macOS release secrets and prepared the release workflow to use the generated API key file for notarized DMG publishing.

## v2.1.53 - 2026-05-09

- Reduced CI and release packaging duplication by publishing a reusable frontend dist artifact for Tauri packaging while keeping Linux and macOS Tauri bundles OS-specific.
- Added an explicit prebuilt-frontend build hook contract, early release validation for required CI artifacts, and release docs for the Linux/macOS-only packaging path.

## v2.1.52 - 2026-05-09

- Restored macOS release asset publishing for tagged releases, building both Apple Silicon and Intel Tauri DMGs while keeping the regular CI package reuse path Linux-only.
- Required configured Apple signing and notarization credentials before publishing a release, so the restored macOS jobs fail clearly if App Store Connect access or secrets are still invalid.

## v2.1.51 - 2026-05-05

- Added opt-in flexible key matching so `**` can bridge variable key segments across CSV files while preserving default exact-key behavior when disabled.
- Fixed flexible wildcard matching to maximize paired rows before applying deterministic preferences, support overlapping wildcard patterns on both sides, and prepared the v2.1.51 patch release.

## v2.1.50 - 2026-05-05

- Fixed workflow state recovery so replacing files or resetting during in-flight work no longer lets stale results, mappings, filters, or older async responses overwrite the current session.
- Rejected duplicate CSV headers and made virtual JSON field labels unambiguous for dotted object keys and dotted physical header prefixes, then prepared the v2.1.50 patch release.

## v2.1.49 - 2026-04-29

- Updated the decimal-rounding cleanup copy to use user-facing `decimal places` language, clarifying that `0` means whole-number rounding and that rounded values also appear in results and exports.
- Kept the existing rounding behavior unchanged, refreshed the UI regression assertions for the new wording, and prepared the v2.1.49 patch release.

## v2.1.48 - 2026-04-29

- Fixed decimal rounding semantics so the cleanup setting now removes the configured count of digits from the right side of the decimal part, matching examples such as `100.22` -> `100` for a setting of `2`.
- Clarified the cleanup UI copy to describe “decimal digits to remove,” added regression coverage for the corrected rule, and prepared the v2.1.48 patch release.

## v2.1.47 - 2026-04-29

- Added a separate decimal-rounding cleanup option so users can round numeric keys and compared values to a chosen precision before matching, including whole-number rounding such as `100.6` -> `101`.
- Kept the feature opt-in and disabled by default, surfaced the rounded values in results/exports, added backend/frontend regression coverage, and prepared the v2.1.47 patch release.

## v2.1.46 - 2026-04-28

- Simplified CI by folding the former standalone `test-tauri-wrapper` job into `build-tauri`, so the Tauri Linux dependency setup, frontend install/build, and Rust cache warming happen once before wrapper tests and packaging.
- Kept the safety gates intact by running `cargo test` in `src-tauri` before `cargo tauri build`, then prepared the v2.1.46 patch release.

## v2.1.45 - 2026-04-28

- Moved the Tauri frontend/backend command-name registry helper out of `src-tauri/src/main.rs` into a dedicated `src-tauri/src/test_support.rs` module so runtime code stays separate from test-only support code.
- Kept the frontend/backend command parity test coverage intact by importing the helper from the new test-support module, then prepared the v2.1.45 patch release.

## v2.1.44 - 2026-04-28

- Updated GitHub-maintained Actions to newer Node 24-capable majors (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v6`, and `actions/download-artifact@v6`) to address the Node 20 deprecation warnings on GitHub-hosted runners.
- Fixed the release publication steps to pass `--repo ${{ github.repository }}` to `gh release` commands so publish/edit operations no longer depend on a checked-out `.git` directory, then prepared the v2.1.44 patch release.

## v2.1.43 - 2026-04-28

- Reworked the release pipeline to reuse the Tauri bundle built by CI: CI now uploads a reusable Linux package artifact, and the tag-triggered release downloads that artifact from the successful CI run for the same commit instead of rebuilding Tauri.
- Added an explicit artifact-availability check in the release gate, widened release artifact upload globs to match extracted artifact layout, and prepared the v2.1.43 patch release.

## v2.1.42 - 2026-04-28

- Optimized GitHub Actions costs and throughput by adding concurrency cancellation, path-scoped CI job triggers, shorter-lived PR artifacts, and better Rust cache reuse across CI and release workflows.
- Simplified the release workflow so tagged releases wait for the matching successful CI run on `main` before packaging instead of rerunning the full validation matrix, then prepared the v2.1.42 patch release.

## v2.1.41 - 2026-04-28

- Fixed normalized key matching so cleanup rules still determine row matches internally while comparison results, exports, and API payloads preserve the original CSV key text from the source rows.
- Added regression assertions that cleanup-enabled key matching keeps the displayed key stable across trim/case, date, and numeric-equivalence scenarios, then prepared the v2.1.41 patch release.

## v2.1.40 - 2026-04-28

- Added an opt-in comparison cleanup rule that treats equivalent decimal representations such as `100`, `100.0`, and `100.00` as the same value while still reporting genuinely different numbers.
- Exposed the numeric equivalence option in the Cleanup panel, kept it disabled by default for compatibility, added backend/frontend regression coverage, and prepared the v2.1.40 patch release.

## v2.1.39 - 2026-04-28

- Fixed key matching so cleanup rules such as trimming, case-insensitive comparison, and date normalization are applied consistently before rows are matched between CSV files.
- Prepared the v2.1.39 patch release by synchronizing the documented release metadata files before rerunning the broad release validation suite.

## v2.1.38 - 2026-04-26

- Fixed session-scoped compare and mapping workflows so stale comparison writes are rejected, missing-session transport calls stay consistent across HTTP and Tauri, and zero-result comparisons can still export and round-trip through saved snapshots.
- Aligned snapshot metadata and normalization defaults across the backend and frontend, improved reset recovery and accessibility semantics for saved-result/file-picker flows, and reran the documented validation suite before this patch release.

## v2.1.37 - 2026-04-24

- Added virtual JSON field mapping so object keys stored inside a single CSV cell can be selected in Step 2 and compared against separate columns or other JSON subfields.
- Preserved saved pair-order and snapshot compatibility for the new dot-notation virtual fields, added dedicated backend and frontend regression coverage in new test files, and prepared the v2.1.37 patch release by synchronizing release metadata.

## v2.1.36 - 2026-04-22

- Fixed the comparison workflow error handling so saved pair-order load failures now preserve the backend's specific mismatch message in the UI instead of falling back to an unexpected error.
- Added frontend regression coverage for non-`Error` rejection payloads and prepared the v2.1.36 patch release by synchronizing the documented release metadata files before rerunning the documented validation suite.

## v2.1.35 - 2026-04-21

- Refined the standalone HTML export inspect-row presentation so saved reports now match the app's paired-row inspection spacing and structure more closely.
- Prepared the v2.1.35 patch release by synchronizing the documented release metadata files and rerunning the documented broad validation suite.

## v2.1.34 - 2026-04-21

- Refined the matched-row inspection presentation so paired values now keep the same success tone on both sides, making review state clearer without changing mismatch styling.
- Kept the standalone HTML export aligned with the same inspection tone update, then prepared the v2.1.34 patch release by synchronizing the documented release metadata files.

## v2.1.33 - 2026-04-21

- Fixed the collapsed Results row value presentation so long joined values now wrap instead of truncating, keeping full match context visible during review.
- Kept the standalone HTML export aligned with the same wrapped collapsed-value treatment, added regression coverage for both surfaces, and prepared the v2.1.33 patch release by synchronizing the documented release metadata files.

## v2.1.32 - 2026-04-21

- Restored the collapsed Results table value cells to a horizontal comma-separated layout so reviewers can scan more values per row while keeping the expanded Inspect detail unchanged.
- Kept the standalone HTML export aligned with the same collapsed presentation, added dedicated regression coverage for the joined row text, and prepared the v2.1.32 patch release by synchronizing the documented release metadata files.

## v2.1.31 - 2026-04-21

- Fixed the comparison workflow so a selected key pair can also remain a comparison pair, keeping its values visible in expanded Results rows and standalone HTML exports instead of filtering that pair out before review.
- Added dedicated frontend regression coverage for overlap-pair request construction, results wiring, expanded matched-row visibility, and HTML export context, then prepared the v2.1.31 patch release by synchronizing the documented release metadata files.

## v2.1.30 - 2026-04-21

- Fixed the paired-values detail context so key pairs no longer stay in the review/export comparison-column inputs after compare filtering, preventing expanded match rows from shifting labels and values onto the wrong mapped columns.
- Added frontend workflow regressions plus Rust sample-data-backed coverage for leading key-pair selections with null-equal mapped rows, then prepared the v2.1.30 patch release by synchronizing the documented release metadata files.

## v2.1.29 - 2026-04-21

- Fixed the paired-values detail context so results review now uses the same non-key comparison columns and retained mappings as the actual compare request, preventing key-pair selections from shifting expanded labels and values.
- Added frontend workflow and Rust regression coverage for leading key-pair selections with mapped null-equal rows, then prepared the v2.1.29 patch release by synchronizing the documented release metadata files.

## v2.1.28 - 2026-04-21

- Fixed the paired-values detail so matched and zero-diff rows now keep the correct compare-column labels even when explicit mapping order differs from selected column order and the compared values are null-equal.
- Added frontend and Rust regression coverage for mapped null-equal comparisons using project-controlled test data, then prepared the v2.1.28 patch release by synchronizing the documented release metadata files.

## v2.1.27 - 2026-04-21

- Restored the simpler collapsed Results row presentation so match and mismatch rows once again show the same main-table layout as before while keeping expandable detail panels for paired values and mismatches.
- Kept the standalone HTML export aligned with the in-app Results view, then prepared the v2.1.27 patch release by synchronizing the documented release metadata files.

## v2.1.26 - 2026-04-21

- Fixed the shared results presentation so zero-diff mismatch rows now fall back to the same paired-value Inspect panel already used for matching and other zero-diff value-bearing rows.
- Added regression coverage for the shared presentation model, in-app Results table, and standalone HTML export, then prepared the v2.1.26 follow-up patch release by synchronizing version metadata across the documented release files.

## v2.1.25 - 2026-04-21

- Added a shared expandable inspection panel for matching and other zero-diff result rows so reviewers can open the same File A and File B value context even when no differences are present.
- Kept the Results table and standalone HTML export aligned by reusing the same presentation model for paired-value inspection details while preserving the existing mismatch Value Differences behavior.

## v2.1.24 - 2026-04-21

- Tightened release-prep validation by extending the metadata checker to require an explicit expected tag with a matching non-empty changelog entry, backed by integration coverage for both accepted and rejected release states.
- Preserved browser and Tauri transport parity by centralizing the shared API route templates, then hardened the CSV loading workflow so uploaded filenames stay normalized, empty uploads are rejected clearly, reloaded files clear stale comparison state, and those paths stay covered by regression tests.

## v2.1.23 - 2026-04-20

- Fixed the tagged release workflow so the final publish step now runs with repository context, allowing GitHub releases to transition cleanly out of draft after successful asset packaging.
- Prepared the v2.1.23 follow-up patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation suite.

## v2.1.22 - 2026-04-20

- Improved release readiness by tightening CI and Tauri coverage, aligning release automation with the documented process, and adding broader runtime/bootstrap plus session-store validation so the shared web and desktop surfaces ship with stronger regression protection.
- Reduced frontend workflow duplication by splitting transport and workflow responsibilities into smaller hooks while preserving the same comparison behavior, then prepared the v2.1.22 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation suite.

## v2.1.21 - 2026-04-20

- Refactored the standalone HTML export and in-app results styling to share the same presentation building blocks, reducing duplication while keeping exported comparison reports visually aligned with the review surface.
- Prepared the v2.1.21 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation suite.

## v2.1.20 - 2026-04-20

- Refined the standalone HTML export Step 3 parity work so saved reports now match the in-app review surface more closely, tightening the comparison-results header and Value Differences presentation for clearer exported mismatch review.
- Prepared the v2.1.20 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation suite.

## v2.1.19 - 2026-04-20

- Refined the standalone HTML export presentation so saved reports now show a clearer comparison-results header with explicit File A and File B names and a more polished Value Differences card layout that better matches the in-app review surface.
- Prepared the v2.1.19 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation workflow.

## v2.1.18 - 2026-04-20

- Fixed the standalone HTML export styling so value-difference layouts now match the in-app results presentation more closely, keeping exported comparison reports easier to scan outside the app.
- Removed the frontend Vite warning around the Tauri transport layer, then prepared the v2.1.18 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation workflow.

## v2.1.17 - 2026-04-20

- Added standalone HTML results export so comparison runs can be saved with embedded summary data, filter counts, searchable result rows, and desktop save support for later review outside the app.
- Prepared the v2.1.17 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation workflow.

## v2.1.16 - 2026-04-20

- Added richer pair-order load diagnostics so invalid imports now explain the concrete File A and File B column mismatches instead of failing with less specific feedback.
- Prepared the v2.1.16 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation workflow.

## v2.1.15 - 2026-04-20

- Fixed the step-1 drag-and-drop flow so desktop Tauri file drops now activate only when they land inside the intended selector and still preserve the dropped CSV basename correctly across browser, macOS, and Windows-style paths.
- Prepared the v2.1.15 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented broad validation suite.

## v2.1.14 - 2026-04-20

- Realigned the mismatch Value Differences arrow block with the adjacent File A and File B value boxes so results like Bob -> Robert render with consistent styling in the Results UI.
- Prepared the v2.1.14 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning broad validation.

## v2.1.13 - 2026-04-20

- Polished the frontend shell with a lighter sticky header treatment and more stable progress-step sizing so the top-level workflow stays readable while the shell scrolls.
- Disabled pair-order copying when no pairs exist, then prepared the v2.1.13 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning broad validation.

## v2.1.12 - 2026-04-19

- Disabled the pair-order save action until at least one column pair exists, preventing empty-state exports from the Configure step while leaving save behavior unchanged once a pair order is present.
- Prepared the v2.1.12 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the documented validation workflow.

## v2.1.11 - 2026-04-19

- Retuned the dark-only KINETIC theme toward flatter black surfaces by removing gradient-based shell, panel, button, and progress treatments while keeping the existing palette colors reserved for borders and accent states.
- Prepared the v2.1.11 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles after rerunning targeted frontend validation for the refreshed theme.

## v2.1.10 - 2026-04-19

- Refined the dark-mode theming so accent and highlight treatments pop more clearly across the shell, cards, chips, progress states, and drag/drop surfaces while keeping the Tailwind v4 CSS-theme setup intact.
- Prepared the v2.1.10 patch release by synchronizing version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the full validation suite.

## v2.1.9 - 2026-04-19

- Hardened the shared web and desktop runtime entrypoints so recoverable startup and request-path failures now propagate explicitly instead of relying on `expect`/`unwrap` in production flows.
- Refactored the frontend comparison workflow into a dedicated reducer module, centralized Tauri invoke command names with backend parity checks, and prepared the v2.1.9 patch release after rerunning the full validation suite.

## v2.1.8 - 2026-04-19

- Replaced unclear step-1 file-selection wording with clearer language for choosing CSV files, reviewing saved results, and moving through the flow.
- Tightened nearby file-picker, stepper, and file-details copy, then prepared the v2.1.8 patch release by updating version metadata before rerunning broad validation.

## v2.1.7 - 2026-04-19

- Cleaned up the step-2 configuration language so row keys, comparison columns, auto-pair guidance, and cleanup rules read more clearly during setup.
- Moved the pair-order copy action into the pair-order box, switched it to a clipboard icon with success feedback, and prepared the v2.1.7 patch release by updating version metadata before rerunning broad validation.

## v2.1.6 - 2026-04-19

- Fixed the tagged release validation flow so the frontend build now runs before Tauri wrapper tests, ensuring `tauri::generate_context!()` can resolve the configured `frontendDist` path during CI release checks.
- Prepared the v2.1.6 follow-up patch release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning the full validation suite.

## v2.1.5 - 2026-04-19

- Hardened the shared web and desktop runtime surfaces by centralizing comparison-snapshot version validation, moving the main blocking Axum workflow paths onto `spawn_blocking`, and initializing desktop tracing with the same baseline subscriber setup used by the web runtime.
- Strengthened the release process with synced-version validation tooling, frontend test/lint/build gates in CI, a tagged-release validation job covering Rust, Tauri, and frontend checks, and the v2.1.5 metadata/doc updates required for the patch release.

## v2.1.4 - 2026-04-19

- Moved auto-pair controls fully into the comparison area and removed the standalone Pairing panel, keeping the configure flow focused without changing the underlying pair-order or automatic pairing behavior.
- Preserved the existing save/load pair-order workflow and auto-pair results while preparing the v2.1.4 release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning broad validation.

## v2.1.3 - 2026-04-19

- Finalized the shipped KINETIC shell as a dark-only experience by removing the theme toggle and light palette path, dropping the legacy header CA badge, and tightening the configure header and file overview chrome so the workflow stays focused on comparison setup.
- Cleaned up pair-order setup by moving save/load actions into the Current pair order preview, simplifying the auto-pair panel copy, and stabilizing the progress stepper labels with left-aligned text while preserving the same direct step navigation behavior.

## v2.1.2 - 2026-04-19

- Tightened the KINETIC follow-up polish with lighter theme copy, cleaner results and configure card treatment, and a more direct stepper so the workflow reads faster without changing the comparison engine or saved-data contracts.
- Prepared the v2.1.2 follow-up release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles, then rerunning the documented broad validation workflow.

## v2.1.1 - 2026-04-19

- Trimmed the broadcast-HUD shell so the primary workflow steps stay in focus, moving secondary file inventory details behind expandable panels and keeping the intake, configure, and header controls tighter without changing comparison behavior.
- Prepared the v2.1.1 follow-up release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles, then rerunning the documented broad validation workflow.

## v2.1.0 - 2026-04-19

- Rebuilt the frontend around the KINETIC design system with a fixed dark broadcast-HUD presentation, bundled local fonts, and redesigned shell, workflow, filter, summary, and results surfaces so the app ships a distinct new visual identity without changing the shared comparison engine or saved-data contracts.
- Prepared the v2.1.0 release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles, then rerunning the documented broad validation workflow including targeted frontend tests for the redesigned surfaces.

## v2.0.2 - 2026-04-18

- Improved the Results table Value Differences cards so long column-name headers render in larger wrapped chips, making mismatched fields easier to scan without changing the underlying comparison data.
- Refreshed the macOS release workflow for the Apple ID notarization path by supporting optional `APPLE_PROVIDER_SHORT_NAME` and updating the repository `APPLE_TEAM_ID` secret, then prepared the v2.0.2 patch release across the Rust crates, desktop config, frontend package metadata, and lockfiles.

## v2.0.1 - 2026-04-18

- Aligned the Configure step cleanup panel with the shared section-card styling so its icon chip now matches the neighboring configure cards instead of using the inconsistent bordered shell.
- Prepared the v2.0.1 patch release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles after rerunning the documented validation workflow.

## v2.0.0 - 2026-04-18

- **Breaking changes:** Upgraded the saved comparison snapshot format to the v2 `persistence::v1` schema with on-disk `version: 2`; snapshots produced by v1.x releases are intentionally not backward compatible and must be regenerated by re-running the comparison in v2.
- **Breaking changes:** Renamed duplicate result wire values from `duplicate_filea` / `duplicate_fileb` to the corrected snake_case `duplicate_file_a` / `duplicate_file_b`, alongside the normalized `duplicate_both` variant.
- **Breaking changes:** Moved the local web app to `127.0.0.1:3001` so the built Axum server, health checks, and frontend proxy all share the same port.
- **Breaking changes:** Collapsed the previous `MappingRequest` / `MappingResponse` split into a single `MappingDto` contract used consistently across compare requests, responses, persistence, and tests.
- **Platform and dependency upgrades:** Modernized the stack to React 19, Axum 0.8, Rust edition 2024 (MSRV 1.85+), TypeScript 5.8, and current Tokio / tower / tower-http / uuid / strsim / tempfile / chrono dependencies for the v2 release line.
- **Internal refactors:** Rebuilt the backend around a shared `SessionStore`, typed `CsvAlignError` handling, the dedicated `persistence::v1` snapshot module, unified CSV-loading and selected-column validation workflows, and a flatter comparison domain model.
- **Frontend improvements:** Extracted shared `SectionCard`, `NavButton`, `LoadResultButton`, and icon primitives, moved the comparison workflow onto a `useReducer` state machine, trialed the React Compiler integration, and shipped accessibility fixes across the shell, drop zones, filters, and footer layout.
- **Tooling and observability:** Added `oxlint` with `npm run lint` coverage in CI and replaced the old env_logger setup with structured `tracing` / `tracing-subscriber` instrumentation across handlers and commands.

## v1.2.3 - 2026-04-17

- Polished the comparison Results table with a refreshed header row (stacked up/down sort glyphs with the active direction highlighted in the primary color), a monospace pill for the Key column, and a consistent mono-boxed treatment for the File A / File B value cells that matches the rest of the app's typography.
- Redesigned the expanded Value Differences panel: each diff now renders as a self-contained card with a column_a → column_b title row, explicit File A (rose) / File B (emerald) labels, and a circular arrow separator, so before/after values are easier to scan in both light and dark mode.
- Bumped release metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles for the v1.2.3 patch release.

## v1.2.2 - 2026-04-17

- Polished the Configure step so it shares the same section anatomy (icon chip, eyebrow label, title, description) already used on the Results step, replacing the heavier borders and decorative backgrounds with the softer translucent-white-over-subtle-border treatment used across the rest of the app.
- Moved the 'Back to file selection' button into a dedicated Configure header strip, unified the comparison/key-column chip styling with the Results filter pills, and gave the 'Current pair order' preview a consistent mini-header.
- Bumped release metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles for the v1.2.2 patch release.

## v1.2.1 - 2026-04-17

- Upgraded the comparison results page with a consistent section anatomy (icon chip, eyebrow label, title, description) across the summary, save-strip, results filter, and results table, plus a dedicated Match rate block that shows absolute counts alongside the percentage and per-outcome share labels on each stat card.
- Made the progress stepper directly navigable: clicking an unlocked step number jumps straight to that step (Step 1 is always reachable, Step 2 unlocks once both files are loaded, and Step 3 unlocks once a comparison summary exists), while locked steps stay visually disabled and snapshot read-only guards are preserved.
- Bumped release metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles for the v1.2.1 patch release.

## v1.2.0 - 2026-04-17

- Refreshed the application UI for a more minimal and professional feel: compact sticky header with a translucent surface, simplified progress-step indicators, and flatter results filter pills with solid primary highlighting, while preserving all existing functionality.
- Moved the dark/light mode toggle fully to the right-hand side of the header and made it icon-only — the "Light"/"Dark" text label was dropped in favor of an accessible aria-label and a visual divider separating it from the other actions.
- Migrated the Tailwind configuration to Tailwind v4 CSS-first best practices: the design palette now lives in `@theme` in `frontend/src/index.css`, the legacy `frontend/tailwind.config.js` and `@config` directive were removed, and class-based dark mode is preserved via `@custom-variant dark`.
- Bumped release metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles for the v1.2.0 minor release.

## v1.1.9 - 2026-04-17

- Added a header `New window` action so you can open another CSV Align window without manually restarting the app, making side-by-side comparisons easier.
- Added results-table sorting for diff counts and diff details, and refreshed release metadata across the Rust crates, desktop config, frontend package manifests, and lockfiles for the v1.1.9 patch release.

## v1.1.8 - 2026-04-17

- Replaced the Current pair order copy action with an icon-only control that flips to a green checkmark after copying, keeping the interaction compact while preserving accessible copy feedback.
- Added frontend regression coverage for the icon-only copy button state and refreshed release metadata across the Rust crates, desktop config, frontend package manifests, and lockfiles for the v1.1.8 patch release.

## v1.1.7 - 2026-04-17

- Fixed the Current pair order copy action so it now copies only the exact text shown on screen, including browser-normalized whitespace in column labels.
- Prepared the v1.1.7 follow-up patch release by updating the required version metadata and rerunning the full validation workflow.

## v1.1.6 - 2026-04-17

- Added a "Copy current pair order" action so the currently displayed mapping order can be copied directly in the same text format used by pair-order save/load workflows.
- Prepared the v1.1.6 patch release by updating version metadata across the Rust crates, desktop bundle config, frontend package manifests, and lockfiles before rerunning broad validation.

## v1.1.5 - 2026-04-17

- Restored dark-mode readability on the results filter by adding the missing `primary-950` shade to the Tailwind palette and strengthening the active pill contrast so the label and count stay clearly visible.
- Added a discoverable "Start new comparison" button to the read-only snapshot banner so loaded snapshots can be exited without having to restart the app.

## v1.1.4 - 2026-04-16

- Updated the release workflow so Linux packaging can still upload to GitHub Releases even if macOS notarization fails, and added early Ubuntu cleanup to reduce runner disk pressure during release builds.

## v1.1.3 - 2026-04-16

- Fixed the results filter dark-mode hover so inactive filter pill text uses gray-100 instead of the near-white gray-50, avoiding a jarring bright-on-dark effect.

## v1.1.2 - 2026-04-16

- Updated the macOS release workflow so Apple ID notarization can proceed without forcing `APPLE_TEAM_ID`, which avoids the inaccessible-team error for single-team Apple Developer accounts.
- Removed the repository `APPLE_TEAM_ID` secret and bumped release metadata across the Rust crates, desktop config, frontend package, and lockfiles for the follow-up release.

## v1.1.1 - 2026-04-16

- Rebuilt the macOS release certificate bundle in a `security import` compatible format and updated the GitHub signing secrets so the Apple certificate can be imported successfully during release builds.
- Fixed the macOS release workflow to search the temporary keychain alongside the system trust stores before resolving the `Developer ID Application` identity, allowing notarized signing to proceed in CI.

## v1.1.0 - 2026-04-16

- Added a dedicated macOS release entitlements plist and switched the desktop bundle away from hardcoded ad-hoc signing so tagged builds can use the configured Developer ID certificate and notarization flow.
- Tightened the release workflow to require a `Developer ID Application` identity and bumped release metadata across the Rust crates, desktop config, frontend package, and lockfiles for the v1.1.0 release prep.

## v1.0.27 - 2026-04-16

- Added sortable comparison-result columns so you can reorder rows by type, key, or the visible File A/File B values directly from the table header.
- Added a results-table search field that filters the currently visible comparison rows by keys, values, duplicate rows, and difference text, then reran the full release validation workflow before publishing.

## v1.0.26 - 2026-04-16

- Improved the dark-mode results-filter hover state so inactive pills are easier to read, with clearer hover contrast against the surrounding results panel.
- Added the same CSV Align app logo used by the desktop shell into the in-app header and reran the full validation workflow before publishing the patch release.

## v1.0.25 - 2026-04-16

- Softened the new results styling by removing the heavier gradient backgrounds so the app feels closer to the earlier dark mode while keeping the stronger icon colors and cleaner results presentation.
- Revalidated the refreshed Tailwind v4 frontend plus the Rust and Tauri suites before publishing the patch release.

## v1.0.24 - 2026-04-16

- Refined the results experience with stronger summary icon chips and more polished result panels, filters, banners, and diff rows so dark mode keeps the same confident color cues as light mode.
- Migrated the frontend from Tailwind CSS v3 to v4 using the official Vite integration while preserving the manual dark-theme toggle, then reran the full release validation workflow before publishing.

## v1.0.23 - 2026-04-16

- Confirmed that additional refactoring was not the best next step and instead strengthened the most valuable missing test coverage around local file loading and compare-request validation.
- Added regression coverage for local-file loading failures and session side effects, aligned the new wording with a local-only tool, and reran the full release validation workflow before publishing.

## v1.0.22 - 2026-04-16

- Realigned the Rust test structure by moving backend public-behavior workflow coverage into top-level integration tests while keeping the frontend's colocated test layout intact.
- Clarified the project structure succinctly in the README and prepared the patch release with the full validation workflow required by the documented release process.

## v1.0.21 - 2026-04-16

- Restored stronger dark-mode results contrast by making summary icons easier to read and giving result-filter hover and active states clearer visual feedback.
- Validated the patch with results-focused frontend coverage and the full release checks required before publishing.

## v1.0.20 - 2026-04-16

- Improved the results experience for live and saved comparisons with stronger light-theme contrast, clearer dark-mode read-only status styling, and more deliberate summary, filter, and diff callouts.
- Validated Rust tests, the frontend test suite, the frontend production build, and the Tauri desktop crate build before cutting the patch release.

## v1.0.19 - 2026-04-16

- Refreshed the light-mode presentation so the desktop and web UI stay clearer and more polished outside the default dark theme.
- Added saved comparison snapshot save/load support so users can reopen prior comparison setup and results in read-only mode, with the save action surfaced from results and the load entry point surfaced from file selection.
- Fixed file-selection back navigation so leaving a comparison can return users to the file-picking step instead of stranding them in later setup flow.

## v1.0.18 - 2026-04-15

- Refactored shared backend/frontend comparison plumbing to reduce repeated response, projection, workflow, and transport logic while keeping the existing behavior and contracts intact.
- Added concise README and docs coverage for auto-pairing so users can understand when it is available and how it chooses confident matches.

## v1.0.17 - 2026-04-15

- Updated auto-pair so users must select matching key columns first, and the chosen key pair(s) are shown first in the auto-pair order before the remaining confident matches.
- Clarified the configure-step guidance for key-first auto-pairing and replaced the recent instance-matching regression fixtures with neutral test data.

## v1.0.16 - 2026-04-15

- Improved auto-pairing so loaded CSV content can drive confident comparison-column matches even when the headers are very different.
- Added conservative low-information guards so repeated categorical values and small numeric score domains are not auto-paired just because their value sets overlap.

## v1.0.15 - 2026-04-15

- Added configure-step auto-pair controls that can select confident comparison-column pairs using File A or File B as the leading order beside the existing pair-order actions.
- Reused the existing mapping workflow with conservative confidence filtering and small export-header aliases so auto-pairing prefers clear one-to-one matches and leaves weak columns unselected.

## v1.0.14 - 2026-04-15

- Improved results-table status badges so longer labels stay readable and keep their dot indicator visible instead of collapsing in narrow type cells.
- Restricted comparison file selection to `.csv` filename extensions only while preserving compatibility with Python-generated CSV files that may not advertise a CSV MIME type.

## v1.0.13 - 2026-04-15

- Clarified result UX by relabeling one-sided rows as file-oriented outcomes, moving unusable-key rows into an explicit ignored-rows explanation, and aligning export wording with the new presentation.
- Added dedicated frontend and Rust regression coverage for ignored-row copy, export labels, and nullish-key scenarios that must stay separate from duplicate and one-sided result buckets.

## v1.0.12 - 2026-04-15

- Restored the pre-v1.0.10 missing-left/right behavior for valid keys by separating rows with unusable selected keys into explicit unkeyed result buckets.
- Prevented nullish selected keys from distorting missing counts, updated the API/UI/export contracts accordingly, and added regression coverage for the new unkeyed result handling.

## v1.0.11 - 2026-04-15

- Restored comparison execution when some selected key values are nullish by treating those rows as one-sided missing results instead of rejecting the whole comparison.
- Prevented nullish selected keys from being grouped into duplicate buckets, added separate regression coverage, and bumped release metadata for the patch release.

## v1.0.10 - 2026-04-15

- Prevented misleading duplicate-key results by rejecting comparisons when the selected key columns contain nullish or empty values under the active normalization rules.
- Added separate Rust regression coverage for nullish key validation and bumped release metadata for the patch release.

## v1.0.9 - 2026-04-15

- Fixed the desktop Load pair order action by granting the Tauri open-dialog permission required to show the native file picker.
- Kept the existing save/load pair-order workflow intact and bumped release metadata for the new patch release.

## v1.0.8 - 2026-04-15

- Added save/load support for manual pair-order selections so repeated comparisons can restore the same key and comparison column setup when the loaded CSV headers match.
- Added frontend and Rust regression coverage for pair-order persistence, and updated release docs/version metadata for the new release.

## v1.0.7 - 2026-04-14

- Fixed the macOS release workflow so empty Apple signing variables are no longer exposed to Tauri, allowing unsigned builds to fall back cleanly to ad-hoc signing.
- Kept optional Apple certificate import and notarization support available only when the required secrets are configured.

## v1.0.6 - 2026-04-14

- Fixed macOS release packaging so both Apple Silicon and Intel DMGs are rebuilt with explicit signing instead of shipping damaged or unsigned app bundles.
- Added optional Apple certificate import in the release workflow so CI can produce properly signed macOS artifacts when signing secrets are configured.

## v1.0.5 - 2026-04-14

- Improved export readability to better match the UI with clearer labels, summary fields, and side-specific duplicate details.
- Refactored shared backend and frontend workflows for stronger typed contracts, explicit validation, cleaner module boundaries, and smaller components/helpers.
- Moved the remaining inline Rust and Tauri tests into dedicated test files and expanded direct frontend hook coverage, including key error paths.

## v1.0.4 - 2026-04-14

- Removed the misleading file-selection helper text that claimed a 50MB limit even though no such size cap is enforced.

## v1.0.3 - 2026-04-13

- Kept abbreviated date normalization support for values like `18-FEB-19` while moving its coverage fully into separate integration tests.
- Removed the temporary in-file engine tests so normalization behavior is verified only through the external regression suites.

## v1.0.2 - 2026-04-13

- Expanded default date normalization so abbreviated month-name values like `18-FEB-19` match equivalent ISO dates without requiring custom patterns.
- Added regression coverage for the default abbreviated-month normalization path in both the comparison engine and cleanup-settings integration suites.

## v1.0.1 - 2026-04-13

- Clarified local file-selection wording and renamed the local file-loading contract surfaces to keep the desktop and web flows aligned.
- Cleaned up release and contributor docs, and validated CI-aligned release checks including changelog extraction for the tagged release flow.

## v1.0.0 - 2026-04-13

- Simplified the configure experience with clearer cleanup wording, better missing-value defaults, and advanced date patterns moved out of the main path.
- Smoothed the step flow by adding back navigation from Configure to file selection plus a quick return path to Configure without reselecting both files.
- Strengthened comparison reliability with new frontend and Rust regression coverage for cleanup settings, normalization behavior, and step navigation.

## v0.2.21 - 2026-04-13

- Fixed the Tauri suggest-mappings command by building its response before moving the generated mappings into session state, resolving the ownership error that broke CI and release builds.
- Bumped release metadata across the core crate, Tauri app, frontend package, lockfiles, and desktop config for a consistent v0.2.21 cut.

## v0.2.20 - 2026-04-13

- Reduced duplicate response shaping between the HTTP and Tauri layers by introducing shared presentation response models while preserving API contract behavior.
- Removed validated dead code and stale generated schema artifacts, including the unused frontend API service path, and documented cleanup guardrails for future passes.
- Added new regression coverage for comparison-engine behavior and serialized response contracts, and bumped release metadata across app surfaces for a consistent cut.

## v0.2.19 - 2026-04-13

- Fixed CSV loading for XML-converted exports that include BOM-prefixed headers and occasional short rows by normalizing leading UTF-8 BOM markers and enabling flexible record-width parsing.
- Added integration regression tests for BOM handling, semicolon/comma delimiters, uneven rows, and type inference while moving loader tests out of `src/data/csv_loader.rs` into `tests/csv_loader_integration.rs`.
- Bumped version metadata across core crate, Tauri app, frontend package, lockfiles, and desktop config for a consistent release.

## v0.2.18 - 2026-04-13

- Fixed CSV import for XML-converted exports by decoding BOM-marked UTF-8/UTF-16 inputs before parsing and auto-detecting semicolon-delimited files.
- Added regression coverage for standard comma CSVs plus semicolon-delimited and UTF-16 BOM local file variants.
- Bumped the release version across the Rust crate, Tauri app, frontend package metadata, and desktop config to keep distribution surfaces in sync.

## v0.2.17 - 2026-04-10

- Added JSON-aware comparison for CSV field values so semantically equivalent JSON payloads (for example different whitespace or object key order) are treated as matches.
- Preserved strict raw-string fallback for non-JSON or malformed JSON field values to avoid unintended normalization.
- Added regression tests covering equivalent JSON matches, semantic JSON mismatches, and malformed JSON fallback behavior.

## v0.2.16 - 2026-04-09

- Improved CSV export quality by writing comparison outputs with dedicated columns for keys, File A values, File B values, and mismatch details instead of packing values into semicolon-delimited cells.
- Unified export formatting across the API and desktop app by reusing the shared Rust export writer, ensuring consistent and correctly escaped CSV output.
- Added regression tests for the export formatter to guarantee rectangular, column-split CSV records across result types.

## v0.2.15 - 2026-04-09

- Removed automatic suggested mappings from the frontend configure flow so column pairing is fully user-driven.
- Added persistent back-navigation from Results to Configure, keeping key and comparison selections intact for quick adjustments and re-runs.

## v0.2.14 - 2026-04-09

- Fixed remaining false-match scenarios by improving comparison difference detection to prefer explicit mappings and fall back to selected column position pairing when mapping metadata is missing.
- Fixed summary totals so File A and File B row counts now display the real source CSV row counts instead of 0 in results.

## v0.2.13 - 2026-04-08

- Fixed mismatch classification so rows are marked as mismatches when mapped comparison column values differ, even when key columns match.
- Restored desktop Export CSV behavior by opening a native save dialog and writing exported results to the selected file path.
- Added regression coverage for mapped columns with different names and updated Tauri dialog permissions/wiring required for desktop export.

## v0.2.6 - 2026-04-08

- Added an explicit MIT license file for the repository with copyright attributed to Douwe de Vries.
- Updated the README license section to link directly to the license text.

## v0.2.5 - 2026-04-07

- Added a dark/light theme toggle in the app header with dark mode enabled by default.
- Updated core UI components and shared styles to support readable dark mode and light mode surfaces.
- Validated frontend production build and Tauri crate build before publishing the release.

## v0.2.4 - 2026-04-07

- Fixed desktop CSV file recognition by sending selected file bytes directly to the Tauri backend.
- Removed the unreliable second selection step in desktop mode and updated UI wording to emphasize file selection.
- Validated Rust tests, frontend production build, and Tauri desktop crate build before release.
