# Codebase Review Findings Remediation Plan

Scope: current `main` at the July 2026 review baseline. Implementation is complete for all Work Items 1–11.

## Implementation Status

- [x] Batch 1 — Work Item 1: resource and transport contracts
- [x] Batch 2 — Work Item 2: structural resource limits and column catalogs
- [x] Batch 3 — Work Items 3, 4, 9, 10: operation ordering, snapshots, store concurrency, and Tauri blocking work
- [x] Batch 4 — Work Items 5, 7, 8: loopback security, bounded HTML export, and copy reduction
- [x] Batch 5 — Work Item 11: gated, rerunnable release publication
- [x] Batch 6 — Work Item 6: spreadsheet-safe CSV export and direct atomic desktop writing

## Goal

Resolve the confirmed reliability, integrity, security, performance, and maintainability findings without replacing CSV Align's shared Rust backend. Establish explicit resource and operation contracts first, then simplify ownership and publication boundaries in independently landable phases.

## Background

- CSV loading owns every decoded header and cell, while session accounting measures payload lengths rather than retained allocation and may protect an over-budget session (`src/data/csv_loader.rs:26-66`, `src/backend/session.rs:38-60`, `src/backend/store.rs:149-167`).
- Loads and snapshot restores prepare outside the store lock and commit without issuance ordering; comparison guards changed inputs but permits two comparisons on unchanged inputs to finish out of order (`src/backend/workflow.rs:84-131`, `src/backend/workflow.rs:342-398`, `src/backend/workflow.rs:468-493`).
- Snapshot validation is centralized and versioned, but Axum, browser, and Tauri apply different read/body bounds, and load/save perform avoidable conversions (`src/backend/comparison_snapshot.rs:9-109`, `src/backend/persistence/v1/mod.rs:284-515`, `src/api/app.rs:94-103`, `src-tauri/src/commands.rs:124-146`).
- Results are repeatedly represented as a Rust domain enum, flattened Rust/TypeScript DTOs, a rich frontend row model, and a second standalone HTML runtime; HTML export has no output bound (`src/presentation/responses.rs:26-174`, `frontend/src/types/api.ts:79-112`, `frontend/src/features/results/presentation.ts:439-486`, `frontend/src/features/results/htmlExportTemplate.ts:229-268`).
- The session store serializes unrelated sessions because read access also takes the store-wide write lock, and virtual JSON labels are rediscovered instead of retained as immutable session metadata (`src/backend/store.rs:103-167`, `src/data/json_fields.rs`).
- The loopback server lacks Host/Origin/fetch-metadata validation, and CSV export passes user-controlled spreadsheet formulas through unchanged (`src/api/app.rs:76-112`, `src/data/export.rs:142-309`).
- GitHub Release visibility is draft-gated, but APT Pages deploys before the final macOS gate and reruns can mutate an existing release (`.github/workflows/release.yml:156-189`, `.github/workflows/release.yml:553-588`, `.github/workflows/release.yml:719-732`).
- The June plan already delivered raw CSV limits, idle/count eviction, reusable comparison planning, raw desktop IPC, typed errors, reducer state, and chunked results. Do not reimplement those or introduce streaming comparison, schema generation, global frontend state, or a comparison-algorithm rewrite (`docs/plans/codebase-quality-simplicity-review-2026-06-16.md`).

## Approach

1. **Make policy explicit before changing ownership.** Put resource limits and transport parity into small checked contracts with regression tests.
2. **Guard every staged mutation.** Expensive work stays outside locks, but commits require a shared backend operation token so HTTP and Tauri have identical ordering.
3. **Bound at every trust boundary and again in the shared backend.** Frontend checks improve UX; backend checks remain authoritative.
4. **Simplify stable ownership seams, not the architecture.** Cache immutable column metadata and remove confirmed copies; share result ownership only when measurements justify the added serializer complexity.
5. **Use fail-closed, convergent release publication.** GitHub Releases and Pages cannot be transactional, so no public mutation begins until all platform artifacts pass and reruns never rewrite a published release.

## Work Items

### 1. Lock resource and transport contracts

Add `src/backend/limits.rs` for authoritative backend limits and a small `contracts/transport-contract.json` for operation keys, HTTP method/path, Tauri command name, and mirrored frontend-visible limits. Rust remains authoritative at runtime; tests compare Rust and frontend constants to the checked contract—no generated source or runtime schema layer.

Initial policy:

| Boundary | Initial limit |
|---|---:|
| Raw CSV | existing 25 MiB |
| Decoded CSV | 100 MiB |
| CSV columns / rows / cells | 4,096 / 250,000 / 5,000,000 |
| Retained CSV / comparison results | 128 MiB each |
| Virtual labels / path depth | 10,000 / 64 |
| Retained session | 384 MiB |
| Snapshot | 128 MiB |
| HTML export rows / data / document | 50,000 / 32 MiB / 40 MiB |

Treat these as shipped product policy, not benchmark placeholders: errors name the violated limit, tracing records which limit fired, and later changes require fixture evidence plus release notes.

Keep `MAX_CSV_FILE_BYTES` as a compatibility alias during this work. Contract fixtures stay narrow: one compare response covering every result variant and canonical error bodies. Existing focused snapshot, dialog, and normalization tests remain authoritative; do not build a general fixture framework.

**Acceptance:** method/path/command/limit or DTO drift fails tests; normal requests remain wire-compatible.

**Tests:** `tests/transport_parity_integration.rs`, `tests/response_contracts.rs`, Tauri registration tests, and a new frontend `transportContract.test.ts`.

### 2. Enforce structural CSV, result, and per-session limits

In `src/data/csv_loader.rs`, stop at decoded-byte, column, row, cell, retained-allocation, virtual-label, and path-depth limits instead of finishing an oversized parse. Make JSON virtual-field discovery bounded and fallible; skip JSON parsing for cells that cannot be object values.

Replace `SessionData::estimated_size_bytes` with conservative `retained_size_bytes` accounting based on `String`/`Vec` capacity and nested allocation overhead using saturating arithmetic. The accounting unit is memory retained by one session after commit: count an `Arc` allocation once within that session, even when its response/export borrows it; exclude transient parse/serialization buffers because their own input/output limits bound them. Cross-session sharing is not introduced.

During this same item, retain the detected columns and virtual labels as one immutable per-side column catalog in `SessionData`; discovery remains bounded and occurs once per loaded file. In `src/comparison/engine.rs`, route result emission through a bounded collector. Before load, compare, or snapshot commit, calculate prospective session size and reject without mutation if it exceeds the per-session limit; total-store LRU eviction remains a secondary policy.

**Acceptance:** exact-boundary inputs pass; limit-plus-one fails; failed work leaves prior files, mappings, configuration, and results unchanged; one protected session cannot exceed its own cap.

**Tests:** extend `tests/csv_loader_integration.rs`, `tests/backend_workflow_integration.rs`, and `tests/session_store_integration.rs`; add `tests/comparison_resource_limits_integration.rs`.

### 3. Add latest-issued-wins operation tokens

Add runtime-only operation state in `src/backend/operation.rs` and the store's `SessionEntry` control plane—not persisted `SessionData`—so the later per-session locking refactor keeps the same boundary. A token contains a checked monotonic sequence and kind: File A load, File B load, compare, or snapshot restore.

Conflict policy:

| New operation | Supersedes |
|---|---|
| File A load | older File A load, compare, snapshot restore |
| File B load | older File B load, compare, snapshot restore |
| Compare | both pending loads, older compare, snapshot restore |
| Snapshot restore | every earlier staged operation |

Different-side loads may both commit unless a later compare/snapshot claim intervenes. A compare deliberately snapshots the currently committed inputs and supersedes pending loads rather than waiting for them. Claims are strict issuance order: failure, cancellation, or dropped callers do not revive older work; deletion invalidates all claims; successful or duplicate commit consumes/rejects the token; sequence exhaustion is an internal error, never wraparound.

Split shared workflows into atomic begin/snapshot and guarded commit operations. Issue only after request/session/side or native-dialog validation, but before body/file I/O, parse, or compare work. Keep `data_revision` and `Arc::ptr_eq` checks as defense in depth. A stale commit returns typed `superseded` / HTTP 409. Frontend hooks silently ignore that code and clear loading state only when their local action generation is still current.

**Acceptance:** reverse completion order cannot overwrite newer intent; session deletion prevents commit; duplicate commit fails; committed state survives failure of the newest operation.

**Tests:** add barrier-driven `tests/operation_ordering_integration.rs` covering every conflict pair and extend reducer/action tests. Do not use timing-only assertions.

### 4. Canonicalize and bound snapshot persistence

Use the shared 128 MiB snapshot limit in browser preflight, Axum body handling, Tauri metadata plus limited reads, shared deserialization, and save output. Refactor `prepare_comparison_snapshot_load` to deserialize once, validate once, and produce a fully prepared object whose commit only moves data.

Keep snapshot version 2 and its valid wire shape. Add unknown-field rejection and result-variant invariants so fields irrelevant to a declared result type must be empty and duplicate first-row fields agree with duplicate arrays. Valid snapshots from the prior release must still load.

Post the raw snapshot JSON document instead of a `{ contents }` envelope to avoid JSON re-encoding and limit ambiguity; remove `LoadComparisonSnapshotRequest`. Repository search found only internal code/tests and no README, example, or automation consumer, so update the route contract, handler, frontend service, and tests atomically. If a downstream consumer is identified before implementation, preserve the old route and add a versioned raw route instead.

**Acceptance:** all valid existing v2 files load; malformed, contradictory, unknown-field, oversized, or unsupported snapshots fail without session mutation; browser, HTTP, Tauri, and backend enforce the same policy.

**Tests:** extend snapshot persistence, Tauri snapshot, frontend service, and transport parity tests for all variants and exact boundaries.

### 5. Harden the loopback HTTP boundary

Add `src/api/loopback_security.rs` middleware around API and static fallback routes. Require an allowed loopback Host authority; reject `Sec-Fetch-Site: cross-site`; when `Origin` exists, require an exact configured loopback origin. Continue allowing requests without Origin/fetch metadata for local CLI use. Share the listener port between `src/main.rs` and the policy; do not add CORS as a substitute.

**Acceptance:** foreign/missing Host, foreign Origin, and cross-site requests receive 403 before state mutation; normal browser, health, static, and local CLI requests still work.

**Tests:** extend `tests/web_runtime_bootstrap_integration.rs` across Host/Origin/fetch-metadata combinations and assert rejected requests cannot create or mutate sessions.

### 6. Make CSV export spreadsheet-safe and avoid full desktop buffering

At the final `csv::Writer` boundary in `src/data/export.rs`, prefix the complete original field with an apostrophe when its first meaningful character is `=`, `+`, `-`, or `@`, or it begins with tab/CR/LF. Apply this to every user-influenced field, including generated headers, keys, values, summaries, and duplicate rows. Preserve all other content and CSV quoting.

Build records from borrowed/`Cow<str>` fields so ordinary values are not cloned. After the native save dialog, have Tauri write through the shared export writer instead of first building a complete `Vec<u8>`. Keep browser byte materialization for now; Axum streaming adds lifecycle complexity without removing retained results.

**Acceptance:** spreadsheet-dangerous cells are neutralized by default; safe cells and rectangular CSV shape remain exact; desktop write failures never report success. Record the intentional content change in the release changelog.

**Tests:** extend `tests/export_integration.rs` for every field position and leading whitespace/control characters; parse output back through `csv::Reader`. Add a Tauri direct-write failure test.

### 7. Bound HTML export, then measure representation cost

First enforce the row, UTF-8 data, and final-document limits against the current export model, without truncation. Surface a typed `HtmlExportLimitError` through the existing accessible error banner with guidance to use CSV or reduce the result set. Tauri independently rejects oversized HTML before opening a dialog or writing.

Remove the duplicate `HtmlExportDocument` declaration and measure serialized bytes/peak generation memory on representative 1k, 10k, and limit-sized fixtures. Only add an export-specific row projection if it reduces serialized data by at least 25%; if justified, omit the original result, duplicate search text, CSS class strings, and fields derivable from expanded detail. Do not attempt to share executable React code with the standalone script.

**Acceptance:** no silent truncation; oversized exports fail before download/write; escaping and filter/search/sort/expand behavior remain unchanged. Projection work is evidence-gated rather than required for the bounds fix.

**Tests:** extend `htmlExport.test.ts`, `presentation.test.ts`, `ResultsTable.test.tsx`, and Tauri HTML export tests for limits, Unicode byte counts, escaping, and existing behavior.

### 8. Remove confirmed copies; profile shared result ownership

Remove the unconditional value-array clone in `compare_single_match` by computing differences while borrowing raw values, then consuming them into normalized display values. Make snapshot save serialize borrowed result/config data rather than constructing a second full persistence graph. Column metadata caching is already delivered in Item 2.

Add a repeatable 100k-result benchmark or allocation measurement around comparison response creation and snapshot save. Defer changing public `CompareResponse.results` or introducing custom `Arc<[RowComparisonResult]>` serialization unless the retained/peak-memory reduction is at least 20% and existing JSON fixtures stay exact. This keeps a complex ownership refactor out of the critical path unless evidence justifies it.

**Acceptance:** confirmed local deep copies are removed; response and snapshot JSON fixtures remain unchanged; any shared-result follow-up includes measurements and no public source break.

**Tests:** comparison semantic tests, response fixtures, snapshot JSON parity, and the benchmark harness.

### 9. Reduce cross-session store contention

Refactor `SessionStore` to a short-held index lock over `HashMap<String, Arc<SessionEntry>>`; each entry owns its own `RwLock<SessionData>`, atomic activity/size metadata, and deterministic LRU tie-breaker. Never hold the index lock while acquiring an entry lock. Guarded commits perform a fresh lookup so deleted/evicted entries cannot be resurrected. Preserve the operation control plane introduced in Item 3 on `SessionEntry`.

**Acceptance:** a blocked session A does not prevent session B progress; same-session mutations remain serialized; deletion/eviction races cannot resurrect data.

**Tests:** barrier/channel store tests for cross-session progress, deterministic eviction, and deletion/budget races. Land after Item 3; do not combine with Tauri command changes.

### 10. Move blocking Tauri work off the command thread

Move synchronous file reads/writes and known heavy CSV parse/compare/snapshot work to `tauri::async_runtime::spawn_blocking` after owned arguments and operation tokens are captured. Measure mapping suggestions and other short commands on representative inputs; move them only if they perform blocking I/O or exceed the documented responsiveness threshold. Preserve invoke names, handler registration, cancellation outcomes, and error shapes.

**Acceptance:** native file I/O and heavy shared workflows do not run on the Tauri command thread; cancellation and stale-token behavior remain unchanged.

**Tests:** focused Tauri wrapper tests for async success, cancellation, join/write failures, and invoke registration.

### 11. Make release publication gated and rerunnable

Restructure `.github/workflows/release.yml` so Linux and both macOS jobs only stage uniquely named Actions artifacts. A final publication job depends on every platform result, downloads all artifacts, verifies an exact manifest, uploads the complete managed asset set to the draft, deploys the staged APT Pages artifact, verifies the public repository, and only then undrafts the GitHub Release.

Add `scripts/verify_release_assets.py` for expected basenames, package/tag versions, uniqueness, non-empty files, sizes, and SHA-256 manifest output. Keep `build_apt_repository.py --clean`; do not add stateful historical-repository merging.

Rerun policy:

- absent release: create a draft;
- existing draft: replace the complete managed set and redeploy;
- existing published release: never redraft or mutate; verify and no-op when consistent, otherwise fail with an immutable-release error;
- same-tag runs queue rather than cancel.

GitHub Releases and Pages cannot commit atomically. The ordering above ensures no public mutation starts before all builds pass and makes the small Pages-success/release-publish-failure window convergent on rerun.

**Acceptance:** macOS failure cannot publish APT content; published reruns are immutable; missing/extra/duplicate/zero-byte/version-mismatched assets fail before public mutation; Pages verification precedes undrafting.

**Tests:** extend release/package integration tests for workflow dependencies, immutable reruns, manifest failures, and publication order. In CI, pin Actionlint v1.7.12 via `actions/setup-go` at a commit SHA plus `go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12`; do not depend on a floating binary.

## Delivery Sequence

Use one behavior-focused PR per numbered work item and land the runtime sequence in numeric order. Items 5–8 and 11 can proceed independently after Item 1; Items 3–4 must stay ordered, and Item 9 depends on Item 3. Keep release workflow changes separate from runtime changes.

## Verification

Each PR runs the smallest named suites above. Before the remediation series is released, run:

```text
cargo fmt --check
cargo test
cargo clippy -- -D warnings

cd src-tauri
cargo fmt --check
cargo test
cargo clippy -- -D warnings

cd ../frontend
npm test
npm run lint
npm run build

cd ..
cargo test --test linux_package_metadata_integration
cargo test --test release_metadata_script_integration
python3 scripts/check_release_metadata.py
go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
actionlint .github/workflows/release.yml
```

Reproduce the measurement-only evidence separately from normal test gates:

```text
cargo bench --features benchmark-owned-snapshot --bench result_representation
cd frontend && npm run measure:html-export
```

Baseline captured on 2026-07-13:

- At 100k results, borrowed snapshot serialization allocated 85,798,079 bytes in 600,042 calls versus 110,087,731 bytes in 1,200,079 calls for the owned reference; median time was about 29.6 ms versus 41.2 ms.
- Isolated HTML runs produced 1,741,281 / 17,666,428 serialized-data bytes at 1k / 10k rows and completed successfully. The 50k fixture produced 89,516,830 serialized-data bytes and was rejected by the 32 MiB data limit before document construction. Process-memory figures are observational and platform-dependent, not CI thresholds.

Also perform focused manual smoke tests for browser CSV/snapshot import/export, desktop dialogs and cancellation, large-result HTML rejection, and one draft-release dry run. No production release should be used to validate the workflow for the first time.

## Open Questions

None. Repository search found no documented external snapshot-envelope consumer, so Item 4 treats the route as internal and changes it atomically. Item 8 does not change the public `CompareResponse.results` type unless a separate measured follow-up can preserve source compatibility.

## Finding Coverage

| Review finding | Work item |
|---|---:|
| CSV/session structural memory limits | 1–2 |
| Out-of-order load/compare/snapshot commits | 3 |
| Snapshot validation and inconsistent bounds | 1, 4 |
| Loopback request hardening | 5 |
| Spreadsheet formula injection | 6 |
| HTML export amplification and duplicated row data | 7; projection is evidence-gated |
| Avoidable comparison/export/snapshot copies | 6, 8 |
| Repeated virtual JSON scans | 2 |
| Global session-store contention | 9 |
| Blocking Tauri work | 10 |
| Route, command, method, limit, and DTO parity | 1 |
| APT/GitHub publication order and rerun safety | 11 |

## References

- `docs/plans/codebase-quality-simplicity-review-2026-06-16.md`
- `docs/reviews/codebase-improvement-review-2026-06-14.md`
- Axum body limits: https://docs.rs/axum/latest/axum/extract/struct.DefaultBodyLimit.html
- Tokio blocking guidance: https://docs.rs/tokio/latest/tokio/task/
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- GitHub Actions job dependencies: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs
- Actionlint releases: https://github.com/rhysd/actionlint/releases/tag/v1.7.12
