# Duplicate Results Exclude Mismatches: Plan

## Goal
Ensure rows/keys already represented in duplicate results do not also appear in mismatch results. One-sided duplicate key groups should be shown in the Duplicates category only, without also producing a separate first-row mismatch row for the same key.

## Background
- Backend result categories are emitted by `compare_csv_data(...)` and related group-processing helpers in `src/comparison/engine.rs`. `RowComparisonResult` and wire `ResultType` define mismatch, missing, unkeyed, and duplicate variants in `src/data/types.rs:133-179`.
- The current overlap happens in paired key groups with duplicates on only one side: `push_paired_group_results` emits a `Duplicate` result and then still calls the first-row comparison path, which can emit a separate `Mismatch` for the same key (`src/comparison/engine.rs:511-546`, `src/comparison/engine.rs:596-616`, `src/comparison/engine.rs:660-692`).
- Duplicate groups on both sides already short-circuit after one `Duplicate` result, so they do not also emit mismatch/match rows (`src/comparison/engine.rs:519-527`). Unmatched duplicate groups also emit only duplicate results and skip missing-row output (`src/comparison/engine.rs:548-594`).
- Existing integration coverage intentionally demonstrates today’s overlap: the fixture has duplicate key `2` in File A and one matching key `2` in File B with `Bob` vs `Robert`, and the test expects both `mismatches == 1` and `duplicates == 1` (`tests/comparison_engine_integration.rs:11-31`, `tests/comparison_engine_integration.rs:48-79`).
- Summary counting treats duplicate results separately from non-duplicate rows; duplicate-side counts are derived from `DuplicateSource`, while mismatches are counted from non-duplicate `ResultType::Mismatch` rows (`src/comparison/engine.rs:694-740`).
- API response projection exposes each result row with `result_type`, `values_a`, `values_b`, duplicate row fields, and `differences`; changing backend emission changes what both browser and Tauri transports receive (`src/presentation/responses.rs:28-37`, `src/presentation/responses.rs:146-160`).
- Snapshot persistence saves result rows and validates summaries by regenerating `generate_summary()` from persisted rows, so snapshot expectations should follow emitted rows rather than introduce a separate schema rule (`src/backend/persistence/v1/mod.rs`).
- Frontend result types mirror the wire categories and collapse duplicate variants into a single `duplicate` UI filter (`frontend/src/types/api.ts:6-16`, `frontend/src/types/api.ts:150-158`).
- Frontend filtering/counting already treats duplicate result rows as exclusive: rows whose `result_type` starts with `duplicate` increment only the duplicate filter bucket and return early (`frontend/src/features/results/presentation.ts:207-250`). This cannot prevent overlap when the backend sends an additional mismatch row for the same key.
- Summary UI receives backend summary directly; comparable stats include matches, mismatches, and missing rows, while duplicate side counts render as a separate warning banner (`frontend/src/features/results/presentation.ts:500-534`, `frontend/src/components/SummaryStats.tsx:45-118`).
- Prior frontend presentation work established shared helpers as the single semantic source for rows, filter counts, and summary/export behavior (`docs/plans/html-export-app-visual-parity-2026-05-09.md:9-11`).

## Approach
Make the backend result emission authoritative: `push_paired_group_results()` should treat any paired group with duplicates on either side as duplicate-only and return immediately after emitting the duplicate result. This matches the existing behavior for duplicate-on-both-sides and unmatched duplicate groups, and it fixes both exact and flexible key matching because both paths delegate to this helper.

Do not add frontend dedupe and do not change the wire schema. The frontend already treats each duplicate result row as an exclusive duplicate-bucket row; the confusing behavior exists because the backend sends an additional mismatch row for the same key. Hiding that row in the UI would make exports, snapshots, summaries, and API responses disagree with what the engine actually produced.

Keep this invariant: one-sided duplicate rows identify their duplicate side by leaving the singleton counterpart side empty in `Duplicate.values_*`. `DuplicateSource::from_duplicate_rows()` uses empty/non-empty duplicate row arrays to infer `duplicate_file_a`, `duplicate_file_b`, and `duplicate_both`; populating the singleton side would turn this into a broader result-model/schema change and could misclassify one-sided duplicates as `duplicate_both`.

Downstream behavior should then propagate naturally:
- `generate_summary()` will stop counting the removed first-row mismatch/match.
- `compare_response()` will serialize fewer rows without schema changes.
- HTTP and Tauri compare responses will receive corrected rows through the shared backend workflow.
- CSV export and saved snapshots will reflect the corrected result set.
- App UI and HTML export will display corrected counts through existing presentation helpers.

## Work Items

### Item 1 — Lock duplicate-only engine behavior
**Goal:** Define the new result-emission contract before changing the engine.

**Done when:** Engine integration coverage proves that one-sided duplicate paired groups emit a duplicate result for the duplicate key and no non-duplicate `Match` or `Mismatch` result for that same key. The proof should inspect result rows for the duplicate key; summary counts alone are not sufficient.

**Key files:** `tests/comparison_engine_integration.rs:11-79`, `src/comparison/engine.rs:511-546`.

**Dependencies:** None.

**Size:** Small.

Notes for the implementation agent:
- Cover File A-only and File B-only duplicate cases where the first rows would otherwise mismatch.
- Cover, or extend an existing case to cover, a one-sided duplicate where first rows would otherwise match. This proves category-driven duplicate-only behavior rather than mismatch-only suppression.
- Update the existing broad fixture only as needed; focused regressions are preferred when they make the per-key assertion clearer.
- Exact matching coverage is the priority because the change is at the shared helper. Add a flexible-key regression only if existing tests do not exercise this helper path clearly enough after implementation.

### Item 2 — Short-circuit one-sided duplicate paired groups in the engine
**Goal:** Make backend result emission produce duplicate-only rows for any paired group with duplicates on either side.

**Done when:** `push_paired_group_results()` returns immediately after emitting a File A-only or File B-only duplicate, and `compare_first_rows(...)` is called only when neither side has duplicates.

**Key files:** `src/comparison/engine.rs:511-546`, `src/comparison/engine.rs:596-616`, `src/data/types.rs:281-294`.

**Dependencies:** Item 1.

**Size:** Small.

Notes for the implementation agent:
- Preserve the existing both-sided duplicate branch and payload shape.
- Preserve the one-sided duplicate-source invariant from the Approach section.
- Do not modify mismatch comparison rules in `find_differences(...)`; the issue is result emission precedence, not value comparison.

### Item 3 — Align shared backend contracts with corrected emitted rows
**Goal:** Keep API, snapshot, export, and response-contract coverage aligned with the backend’s corrected row set.

**Done when:** Any Rust tests that relied on the old duplicate-plus-mismatch overlap expect the corrected row count and summary, while existing schema-shape tests remain schema-only unless failures prove stale behavior assumptions.

**Key files:** `tests/response_contracts.rs`, `tests/presentation_responses_integration.rs:40-234`, `tests/export_integration.rs`, `tests/comparison_snapshot_persistence_integration.rs`, `src/presentation/responses.rs:28-160`, `src/data/export.rs`, `src/backend/persistence/v1/mod.rs`.

**Dependencies:** Item 2.

**Size:** Medium.

Notes for the implementation agent:
- At the response/API layer, ensure there is at least one contract assertion that a one-sided duplicate response contains the duplicate row and no mismatch row for that duplicate key. This can be an update to an existing response-contract test or a small new focused regression.
- Prefer expectation updates over new response fields.
- Snapshot and export changes should follow emitted-row counts; do not add compensating filters in those layers.

### Item 4 — Keep frontend presentation as a consumer, not a dedupe layer
**Goal:** Ensure browser UI and HTML export continue consuming corrected backend rows through shared presentation helpers.

**Done when:** No frontend key-based duplicate/mismatch hiding is added. Frontend source changes are made only if tests reveal a stale fixture or expectation caused by corrected backend payloads.

**Key files:** `frontend/src/features/results/presentation.ts:207-250`, `frontend/src/features/results/presentation.test.ts:80-124`, `frontend/src/features/results/htmlExport.ts`, `frontend/src/features/results/htmlExport.test.ts`.

**Dependencies:** Items 2 and 3.

**Size:** Small.

Notes for the implementation agent:
- Keep duplicate filtering prefix-based (`duplicate_*` → `duplicate`) and exclusive per result row.
- Avoid hiding mismatches by key in frontend code; that would leave exported/saved/API data inconsistent with what the user sees.
- Frontend validation is conditional: run it if frontend fixtures, UI-facing snapshots, or generated payload assumptions change.

### Item 5 — Validate the corrected behavior across shared runtime paths
**Goal:** Prove the change is correct at the engine seam and does not break shared browser/Tauri-facing contracts.

**Done when:** Targeted tests pass first, then the repository’s standard Rust validation passes for the touched backend surface.

**Key files:** `src/backend/workflow.rs`, `src/api/handlers.rs`, `src-tauri/src/commands.rs`, `tests/comparison_engine_integration.rs`, `tests/response_contracts.rs`.

**Dependencies:** Items 1–4.

**Size:** Medium.

Recommended validation:
- `cargo test --test comparison_engine_integration`
- `cargo test --test response_contracts`
- `cargo test`
- `cargo fmt --check && cargo clippy -- -D warnings` before commit
- `cd src-tauri && cargo test` if shared workflow changes or response-contract fallout affects Tauri-facing behavior
- `cd frontend && npm run build` only if frontend code, frontend fixtures, or UI-facing generated payload assumptions change

## Open Questions
None. The requested behavior is clear and can be implemented without schema, frontend architecture, or user-flow decisions.

## References
- `src/comparison/engine.rs`
- `src/data/types.rs`
- `src/presentation/responses.rs`
- `src/backend/workflow.rs`
- `src/data/export.rs`
- `src/backend/persistence/v1/mod.rs`
- `tests/comparison_engine_integration.rs`
- `tests/response_contracts.rs`
- `tests/presentation_responses_integration.rs`
- `tests/export_integration.rs`
- `tests/comparison_snapshot_persistence_integration.rs`
- `frontend/src/features/results/presentation.ts`
- `frontend/src/features/results/presentation.test.ts`
- `frontend/src/components/SummaryStats.tsx`
- `docs/plans/html-export-app-visual-parity-2026-05-09.md`
