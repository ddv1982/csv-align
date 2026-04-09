# Changelog

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
