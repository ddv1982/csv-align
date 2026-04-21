# Changelog

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
