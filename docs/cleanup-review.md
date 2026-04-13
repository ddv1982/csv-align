# Cleanup review and execution guardrails

This note captures the current code-quality review for the approved cleanup pass so future work stays inside the agreed safety rails.

## Current review findings

### Backend duplication is real, but contract-first cleanup is required

The HTTP API and Tauri entrypoint currently duplicate transport DTOs and response-mapping code in these files:

- `src/api/handlers.rs`
- `src-tauri/src/main.rs`

Duplicated response families include:

- `ColumnResponse`
- `FileLoadResponse`
- `ResultResponse`
- `DifferenceResponse`
- `SummaryResponse`
- `CompareResponse`
- `MappingResponse`
- `SuggestMappingsResponse`
- `SessionResponse`

Because those shapes define user-visible response contracts, cleanup should add characterization coverage before any dedupe and must preserve field names and serialized output shape.

### Frontend structural cleanup is gated

The frontend currently exposes these npm scripts:

- `dev`
- `test`
- `build`
- `preview`
- `tauri`

The frontend now has a test script and repo-approved test tooling in `frontend/package.json`, so cleanup can use both `cd frontend && npm test` and `cd frontend && npm run build` as safety rails.

Structural cleanup should still stay scoped and reviewable, but it is no longer limited to production-build-only verification. Larger frontend cleanup now needs both the frontend test suite and the production build to stay green.

### Dead-code candidates still need execution-lane proof

The approved cleanup plan identifies several candidates, but this review lane is documenting them rather than deleting them. Current search evidence shows these items still need an execution lane to re-verify and remove safely:

- `frontend/src/services/api.ts`
- `frontend/src/services/tauri.ts` → `pickFile`
- `src/data/types.rs` → `ResultFilter`
- `src/comparison/mapping.rs` → `get_unmapped_columns`
- `src/api/state.rs` → `comparison_config`, `comparison_summary`

At review time:

- `frontend/src/services/api.ts` still exists, but current frontend imports are routed through `frontend/src/services/tauri.ts`, so `api.ts` appears to be a strong dead-code candidate for the execution lane to remove.
- `pickFile` still exists as a deprecated stub.
- `ResultFilter` still exists with no current live references found outside its definition.
- `get_unmapped_columns` still exists with no current live references found outside its definition.
- `comparison_config` and `comparison_summary` are still written from `src/api/handlers.rs`, so they must be removed together with those writes if an execution lane proves them unused.

## Required execution order for cleanup work

1. Record dirty-worktree state before editing owned files.
2. Re-run baseline verification:
   - `cargo check`
   - `cargo test`
   - `cd frontend && npm run build`
3. Add backend response-contract characterization coverage before deduping response mapping.
4. Remove only symbols that are re-verified unused.
5. Keep frontend structural cleanup deferred unless the verification gate changes.

## Documentation intent

This file is intentionally conservative. It exists to keep cleanup work reviewable, contract-safe, and aligned with the approved plan rather than to justify a broader refactor.
