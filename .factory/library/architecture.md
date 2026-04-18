# csv-align v2 — Architecture

How the system is organized after the v2 refactor. Written as the target state; some elements (CsvAlignError, persistence::v1, shared SessionStore, MappingDto) are introduced during the mission and will be reflected in the codebase progressively.

## High-level shape

```
                            ┌────────────────────┐
                            │   React 19 + Vite  │
                            │    frontend/       │
                            └────────┬───────────┘
                                     │ HTTP /api (browser) or invoke (Tauri)
                                     │ single transport switch: services/tauri.ts
                                     ▼
                            ┌────────────────────┐
                            │     Transport      │
                            │  Axum 0.8 server   │  Tauri 2.x commands
                            │  src/main.rs       │  src-tauri/src/main.rs
                            └────────┬───────────┘
                                     │ thin adapter: argument marshalling only
                                     ▼
                            ┌────────────────────┐
                            │     backend/       │   Shared workflow layer
                            │  - store           │   (SessionStore, blocking sync API)
                            │  - load_csv        │   One CSV parsing path
                            │  - validation      │   One validate_selected_columns
                            │  - pair_order      │
                            │  - comparison_*    │
                            │  - error           │   CsvAlignError (thiserror)
                            └────────┬───────────┘
                                     ▼
                ┌────────────────────┴───────────────────────────┐
                │                                                │
          ┌─────▼──────┐                             ┌───────────▼──────────┐
          │ comparison │                             │ persistence (v1)     │
          │ engine     │                             │ versioned on-disk    │
          │ mapping    │                             │ decoupled from DTOs  │
          │ value_cmp  │                             └──────────────────────┘
          └─────┬──────┘
                ▼
         ┌─────────────┐
         │  data/      │   CsvData, ComparisonRow (flat struct post-M4),
         │  types.rs   │   ResultType enum (unit variants), ComparisonSummary,
         │  export.rs  │   ComparisonConfig
         └─────────────┘
                ▲
                │ observability spans
         ┌──────┴──────┐
         │  tracing    │   tracing + tracing-subscriber. env_logger/log removed.
         └─────────────┘
```

## Modules

- **`src/data/`** — Domain types (`CsvData`, `ColumnInfo`, `ComparisonRow`, `ResultType`, `ComparisonSummary`, `ComparisonConfig`), CSV ingestion (`csv_loader`), CSV export (`export`).
- **`src/comparison/`** — Comparison engine, column-mapping heuristics, value comparators. Pure logic; no I/O. Operates on `Arc<CsvData>` to avoid clones.
- **`src/backend/`** — Workflow orchestration used by both transports:
  - `store.rs` — `SessionStore` (sync API over `parking_lot::RwLock` or equivalent). Tauri calls directly; Axum wraps in `spawn_blocking`.
  - `load_csv.rs` — single CSV ingestion workflow.
  - `workflow.rs`, `requests.rs`, `session.rs` — compare/suggest-mappings/export orchestration.
  - `validation.rs` — sole `validate_selected_columns` impl (typed `CsvAlignError` errors).
  - `pair_order.rs`, `comparison_snapshot.rs` — save/load workflows for their respective file formats.
  - `error.rs` — `CsvAlignError` (thiserror). `impl IntoResponse for CsvAlignError` for Axum; `impl Serialize` for Tauri.
  - `persistence/v1/` — versioned on-disk snapshot schema. Decoupled from API response DTOs. `version: 2` on disk (the module is `v1` of the dedicated persistence schema).
- **`src/presentation/`** — API response DTOs (`CompareResponse`, `FileLoadResponse`, `SuggestMappingsResponse`, etc.) with `impl From<_>` conversions from domain types. Single source of truth for wire shape.
- **`src/api/`** — Axum handlers, `AppState` (wraps `SessionStore`). Handlers are thin: parse → call workflow → map errors. Every handler carries `#[tracing::instrument(skip(state))]`.
- **`src/main.rs`** — Axum server. Listens on `127.0.0.1:3001`. Serves `/api/*` + static `frontend/dist` fallback.
- **`src-tauri/src/main.rs`** — Tauri commands. Shares `SessionStore` with the workflow layer. Command bodies are argument-marshalling wrappers around `backend::*` functions. No duplicated `AppState`; no duplicated CSV parsing.
- **`frontend/src/`** — React 19 app.
  - `App.tsx` — top-level composition.
  - `components/ui/` — shared primitives (SectionCard, NavButton, LoadResultButton, Icon set).
  - `components/app/` — step-specific chrome (AppHeader, ProgressSteps, FileSelectionStep, ConfigurationStep, ResultsStep, ErrorBanner, LoadingState).
  - `components/` — feature components (FileSelector, MappingConfig, SummaryStats, FilterBar, ResultsTable) + `mapping-config/` children.
  - `hooks/` — `useComparisonWorkflow` (useReducer-based state machine post-M6), `useThemePreference`.
  - `features/mapping/autoPair.ts`, `features/results/presentation.ts` — pure helpers.
  - `services/tauri.ts` — transport switch (one function per backend operation; branches on `isTauri`).
  - `services/browserDownload.ts` — `downloadBlob` (moved out of tauri.ts in M6).
  - `services/appWindows.ts` — `openNewAppWindow` (moved out of tauri.ts in M6).
  - `types/api.ts` — mirrors Rust DTOs. `MappingDto` only (collapsed from MappingRequest/Response in M4).
  - `test/fixtures.tsx` — shared `vi.hoisted` mocks (TSX is required because fixture mocks render JSX).

## Data flow

### Compare request (web)

1. Frontend `handleCompare` → `services/tauri.ts::compareFiles` → `POST /api/sessions/{session_id}/compare` with `{ key_columns_a, key_columns_b, comparison_columns_a, comparison_columns_b, column_mappings: MappingDto[], normalization }`.
2. Axum handler `compare` → `SessionStore.with_session(sid, ...)` → `backend::run_comparison(arc_csv_a, arc_csv_b, request)`.
3. `run_comparison` → `comparison::engine::compare_csv_data(arc_a, arc_b, config)` returns `Vec<ComparisonRow> + ComparisonSummary`.
4. Handler writes results back to session (via `with_session_mut`) and returns `CompareResponse` (From<_> conversion on domain types).
5. Every handler emits tracing spans with `session_id`, `rows_a`, `rows_b` fields.

### Compare request (Tauri)

Same flow, but transport is `invoke('compare', …)`. Tauri command body calls the same `backend::run_comparison` (NO re-implementation). Errors serialize directly from `CsvAlignError`.

### Snapshot save/load

- Save: `backend::save_comparison_snapshot_workflow` constructs a `persistence::v1::Snapshot` from session state, serializes to JSON with `version: 2`, returns bytes.
- Load: `backend::load_comparison_snapshot_workflow` reads JSON, checks `version == 2` (rejects v1.x with `Unsupported comparison snapshot version {n} — this file was produced by an older csv-align release. Re-run the comparison in v2.`), hydrates session, returns `LoadComparisonSnapshotResponse`.

## Invariants

- **One source of truth per concept.** Exactly one `validate_selected_columns`, one CSV parsing path, one `SessionStore`, one DTO-conversion direction (domain → response).
- **No transport-specific logic in the workflow layer.** `backend::*` functions are transport-agnostic.
- **Arc-shared session data.** `SessionData` holds `Arc<CsvData>` so comparison inputs do not clone CSVs per request.
- **Wire = DTO.** API response shapes live in `src/presentation/`. On-disk snapshot shape lives in `src/backend/persistence/v1/` and is NOT the API DTO (decoupled to allow independent evolution).
- **Port discipline.** Axum binds `127.0.0.1:3001`. Vite dev proxy targets `3001`. Nothing else.
- **Observability.** Every handler and every `#[tauri::command]` opens a tracing span. `RUST_LOG` controls verbosity.
- **v2 wire contract.** `ResultType` serde: snake_case; `duplicate_file_a`/`duplicate_file_b`/`duplicate_both`. `MappingDto` everywhere (no MappingRequest/Response).

## Non-invariants / intentional asymmetries

- **Browser vs Tauri file-loading I/O differs.** Browser sends multipart bytes; Tauri sends a file path and lets Rust read it. Both converge on `backend::load_csv_workflow` internally.
- **Snapshot persistence is NOT backward-compatible.** v1.x snapshots fail with an explicit message. Intentional — v2 major bump.
- **Tauri desktop e2e is not automated.** Web surface + `cd src-tauri && cargo test` are the full validation of the shared code.
