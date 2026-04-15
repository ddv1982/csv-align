# Changelog

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
- Added regression coverage for standard comma CSVs plus semicolon-delimited and UTF-16 BOM upload variants.
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
