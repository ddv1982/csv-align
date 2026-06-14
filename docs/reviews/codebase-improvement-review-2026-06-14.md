# Codebase Improvement Review - 2026-06-14

Scope: `src/`, `src-tauri/src/`, `frontend/src/`, `tests/`, `scripts/`, `.github/workflows/`, and release docs.

This is a review artifact only. It records confirmed improvement areas and does not change runtime behavior. Findings marked resolved or partially resolved are addressed by the accompanying changes; the original evidence is retained for audit context.

## Validation Baseline

- `cargo test` - passed. Rust unit, integration, release metadata, transport parity, and doc tests completed successfully.
- `cd frontend && npm run build` - passed. TypeScript and Vite production build completed successfully.
- `cd src-tauri && cargo test` - passed. Tauri wrapper command tests completed successfully.

## Findings

Current status:

- Resolved by the accompanying changes: findings 1, 2, 4, 5, 8, and 9.
- Partially resolved by the accompanying changes: finding 3 now has a session-count cap, but still has no TTL or approximate byte limit.
- Still open: findings 6, 7, and 10.

### 1. Release artifacts can be skipped for APT installer-only changes

Severity: High

Status: Resolved by the accompanying changes. `run_tauri_ci` now includes the APT repository builder and installer scripts, with a regression test covering the path-filter entries.

Original evidence:

- `.github/workflows/ci.yml:52-62` gates the Tauri/package artifact job on a short list of scripts and omits `scripts/build_apt_repository.py` and `scripts/install-apt-repo.sh`.
- `.github/workflows/release.yml:69-75` requires CI artifacts named `csv-align-linux-x86_64-release-bundle` and `csv-align-frontend-dist` before release continues.
- `.github/workflows/release.yml:481-503` and `.github/workflows/release.yml:531-570` consume `scripts/build_apt_repository.py` and publish the patched `scripts/install-apt-repo.sh`.

Impact: A release tag whose code changes are limited to APT repository or installer scripts can pass CI path filtering without producing the Linux release bundle artifact required by the release workflow, causing the release workflow to fail after tagging.

Implemented improvement: Added `scripts/build_apt_repository.py` and `scripts/install-apt-repo.sh` to `run_tauri_ci`, plus a workflow regression test for release-consumed APT script coverage.

### 2. Snapshot load validates headers and results but not persisted column metadata

Severity: Medium

Status: Resolved for structural column metadata by the accompanying changes. Snapshot load now rejects column count, index, and name mismatches before hydrating session metadata. Persisted `data_type` values are still accepted because loaded snapshots do not contain source rows to re-infer types from.

Original evidence:

- `src/backend/persistence/v1/mod.rs:145-165` hydrates `session_data.columns_a` and `columns_b` directly from persisted `file.columns`.
- `src/backend/persistence/v1/mod.rs:292-323` validates selection, mappings, and summary consistency against `file.headers`, but does not verify that `file.columns` matches those headers.
- `src/backend/persistence/v1/mod.rs:523-531` returns persisted column metadata in the snapshot load response.

Impact: A malformed snapshot can pass validation with headers and results that are internally consistent while returning or storing stale/mismatched column indexes, names, or data types. That creates avoidable trust in unvalidated persisted metadata.

Implemented improvement: Added snapshot file metadata validation for column count, index, and name invariants, with integration coverage for malformed snapshots.

### 3. Web-mode session storage has no expiry or byte limit

Severity: Medium

Status: Partially resolved by the accompanying changes. `SessionStore` now has a default maximum session count and evicts the oldest session when capacity is reached, but it still has no TTL or approximate memory/byte limit.

Original evidence:

- `src/backend/store.rs:12-23` stores sessions in a process-wide `HashMap<String, SessionData>`.
- `src/backend/store.rs:27-46` only deletes sessions through explicit calls and offers no TTL, maximum count, byte limit, or eviction policy.
- `SessionData` can hold loaded CSV data and comparison results, so a session can be much larger than a simple metadata record.

Impact: The local web server is vulnerable to unbounded memory growth if sessions are abandoned, if React/dev bootstrapping creates extra sessions, or if large CSV comparisons are run repeatedly without deletion.

Remaining improvement: Add idle expiration, approximate byte limits, and periodic cleanup if the local web runtime needs stronger memory controls than count-based eviction.

### 4. React StrictMode can create orphan backend sessions in development

Severity: Medium

Status: Resolved by the accompanying changes. The workflow session lifecycle now deletes stale bootstrap/reset sessions that resolve after unmount and deletes the active session on unmount.

Original evidence:

- `frontend/src/main.tsx:10-13` wraps the app in `StrictMode`.
- `frontend/src/hooks/useWorkflowSessionLifecycle.ts:39-55` creates a session in a mount effect but has no cleanup or cancellation path that deletes a session created by a stale StrictMode mount.

Impact: In React development, mount effects are intentionally re-run. The first `createSession()` response can become stale and never dispatch, but the backend session still exists. This compounds the unbounded-session risk and can make local debugging noisier.

Implemented improvement: Added effect cancellation and session cleanup for stale bootstrap/reset responses, with hook tests for unmount and delayed resolution paths.

### 5. Result row expansion uses IDs that are unstable across outer filtering

Severity: Medium

Status: Resolved by the accompanying changes. `ResultsStep` now passes unfiltered results and the active filter into `ResultsTable`, so row IDs are generated before filtering and expansion no longer carries onto another filtered row.

Original evidence:

- `frontend/src/components/app/ResultsStep.tsx:94-103` applies the top-level filter before passing `filteredResults` to `ResultsTable`.
- `frontend/src/features/results/presentation.ts:422-443` assigns row IDs as `row-${index}` based on the current input array index.
- `frontend/src/components/ResultsTable.tsx:161` stores the expanded row by ID, and `ResultsTable.tsx:320-338` uses that ID to decide which detail row to show.

Impact: If a user expands `row-0` and then changes the top-level filter, the filtered array is reindexed and another result can now be `row-0`, causing the wrong row to appear expanded. Internal search resets expansion, but outer result filter changes do not.

Implemented improvement: Moved top-level result filtering into `ResultsTable` and added regression coverage for expanded detail state across filter changes.

### 6. Flexible key selection recomputes maximum matching for each candidate

Severity: Medium

Status: Open.

Evidence:

- `src/comparison/engine.rs:13-14` allows up to 10,000 flexible key candidates and 1,000,000 comparisons.
- `src/comparison/engine.rs:448-469` calls `maximum_flexible_match_count` once for the target count and then again for each candidate trial.
- `src/comparison/engine.rs:481-536` rebuilds the matching graph and runs matching for each of those calls.

Impact: Existing caps prevent unbounded explosion, but worst-case flexible-key comparisons can still redo substantial graph work thousands of times. This is a performance and maintainability hotspot around one of the more complex comparison features.

Suggested improvement: Benchmark dense flexible-key cases near configured limits, then replace the repeated trial matching with a deterministic weighted matching/min-cost strategy or a cached graph representation that preserves current ordering rules.

### 7. Desktop file loading expands file bytes into a JavaScript number array

Severity: Low to Medium

Status: Open.

Evidence:

- `frontend/src/services/tauri.ts:93-95` converts a selected `File` to `Array.from(new Uint8Array(...))`.
- `frontend/src/services/tauri.ts:151-166` sends that array through the `loadCsvBytes` invoke path.
- `src-tauri/src/commands.rs:173-191` receives the payload as `Vec<u8>` and loads the CSV.

Impact: Large CSV files pay avoidable memory and serialization overhead in desktop mode because each byte becomes a JavaScript number before IPC serialization.

Suggested improvement: Prefer a binary IPC or Tauri file-reading path if available. If invoke must remain, document practical file-size limits and add UI/error handling for oversized desktop loads.

### 8. Release guide omits enforced AppStream version metadata and has a copy-paste validation bug

Severity: Medium

Status: Resolved by the accompanying changes. The release guide now lists AppStream metadata and uses subshells for Tauri/frontend validation commands.

Original evidence:

- `docs/releasing.md:23-31` lists version-bearing files but omits `src-tauri/appstream/com.csvalign.desktop.metainfo.xml`.
- `scripts/check_release_metadata.py:120-134` enforces the latest AppStream release version.
- `src-tauri/appstream/com.csvalign.desktop.metainfo.xml:19-20` contains the latest release version entry.
- `docs/releasing.md:56-65` shows `cd src-tauri && cargo test` followed by `cd frontend && ...`; copied as one shell block, the frontend commands run from `src-tauri` and fail. The block also omits Tauri `cargo fmt --check` and `cargo clippy -- -D warnings`, which CI runs at `.github/workflows/ci.yml:230-240`.

Impact: Maintainers following the release guide can miss an enforced version file and can run a broken or incomplete pre-push validation block.

Implemented improvement: Added the AppStream file to the release metadata list, rewrote validation commands with subshells, and added a release-doc regression test for enforced version metadata files.

### 9. Browser transport branches have thinner direct test coverage than Tauri branches

Severity: Low

Status: Resolved by the accompanying changes. Browser-mode tests now cover mapping suggestions, CSV export, pair-order save/load request construction, blob handling, and missing-file behavior.

Original evidence:

- `frontend/src/services/tauri.ts:183-194`, `frontend/src/services/tauri.ts:211-222`, and `frontend/src/services/tauri.ts:237-275` contain browser HTTP branches for mapping suggestions, CSV export, pair-order save, and pair-order load.
- `frontend/src/services/tauri.test.ts:308-386` directly tests the Tauri invoke branches for those helpers, but not the corresponding browser URLs, methods, bodies, blob handling, or missing-file behavior.

Impact: Backend route parity is covered by Rust transport tests, but frontend regressions in browser-specific fetch construction would be caught later than equivalent Tauri invoke regressions.

Implemented improvement: Added browser-mode service tests for URL, method, headers/body, blob handling, and missing-file errors across the previously thin transport branches.

### 10. Public comparison panic wrapper obscures safer API usage

Severity: Low to Medium

Status: Open.

Evidence:

- `src/comparison/engine.rs:115-124` exposes public `compare_csv_data` and panics when the config references unknown columns.
- `src/comparison/engine.rs:126-165` exposes `try_compare_csv_data`, which returns a structured `ComparisonColumnSelectionError`.

Impact: Internal workflows validate before comparison, but external library users can still call a public API that aborts the current task on invalid input. The safer API exists but the panic wrapper has the simpler name.

Suggested improvement: Prefer the fallible function as the primary public API in docs and call sites. If the panic wrapper remains, rename or document it as unchecked/test-oriented.

## Suggested Order Of Work

1. Add TTL, approximate byte limits, and periodic cleanup if count-based session eviction is not enough for web-mode memory control.
2. Benchmark dense flexible-key cases near configured limits, then refactor only after preserving current behavior with targeted performance tests.
3. Improve desktop large-file handling by avoiding JavaScript number-array expansion or documenting practical size limits.
4. Prefer the fallible comparison API in public docs and call sites, or rename/document the panic wrapper as unchecked.
