# Codebase Improvement Plan

Date: 2026-06-17

## Review Scope

This review covered the shared Rust library in `src/`, the local web API/server,
the Tauri desktop wrapper in `src-tauri/`, the React frontend in `frontend/`,
integration tests, CI/release workflows, dependency metadata, and maintainer
documentation.

Overall, the project has a healthy shape: the backend is shared between web and
desktop, transport parity is explicitly tested, release automation is mature,
and the frontend workflow state is split across focused hooks. The most useful
next improvements are around large-input behavior, resource contention, desktop
UX edge cases, and maintenance hygiene.

## Priority 1: Fix User-Visible Large-Data Risks

### 1. Add a body limit for loading comparison snapshots in web mode

Evidence:

- `src/api/app.rs` applies a custom `DefaultBodyLimit` only to CSV upload at
  `LOAD_CSV_ROUTE`.
- `LOAD_COMPARISON_SNAPSHOT_ROUTE` accepts JSON through the default Axum body
  limit.
- `README.md` documents comparison snapshots as saved work that can be reopened.

Risk: users can save a large comparison snapshot and later fail to reload it in
browser mode if the JSON payload exceeds Axum's default request limit.

Plan:

- Define an explicit snapshot-load limit, ideally derived from the same resource
  policy as comparison snapshot persistence.
- Apply it to `LOAD_COMPARISON_SNAPSHOT_ROUTE`.
- Add router-level regression coverage with a snapshot payload above Axum's
  default JSON body limit.

### 2. Paginate or virtualize large result tables

Evidence:

- `frontend/src/components/ResultsTable.tsx` builds view models for all results
  and renders every filtered row.
- The component warns after 50 visible results but still renders the full list.

Risk: comparisons with thousands of rows can make the UI slow or unresponsive,
especially after search, sort, or detail expansion.

Plan:

- Choose pagination or virtualization for `ResultsTable`.
- Keep search, sort, filter, and expanded-row behavior explicit in tests.
- Add a large-result fixture to guard rendering and interaction performance.

### 3. Reduce duplicate CSV upload work

Evidence:

- `src/api/handlers.rs` converts multipart bytes with `bytes.to_vec()` before
  calling `load_csv_workflow`.
- `src/backend/workflow.rs` discovers virtual headers and columns during load,
  then recomputes similar metadata when applying the CSV to the session.

Risk: web uploads do avoidable memory copying and repeated metadata scans near
the 25 MiB CSV limit.

Plan:

- Pass owned upload bytes directly into `CsvLoadSource::Bytes`.
- Carry computed column metadata through `LoadedCsv` so session application does
  not repeat virtual-header discovery and column detection.
- Keep response equality covered by tests rather than a debug-only assertion.

## Priority 2: Improve Backend Robustness and Throughput

### 4. Shorten session-store lock hold times

Evidence:

- `src/backend/store.rs` uses a global write lock in both `with_session` and
  `with_session_mut`.
- Caller closures can perform expensive work such as snapshot serialization,
  snapshot load, or mapping suggestions while the lock is held.

Risk: one large operation can block unrelated sessions.

Plan:

- Snapshot minimal session state while locked, do heavy work outside the lock,
  then write back under a short lock when mutation is required.
- Consider per-session locking only after the simpler lock-scope reduction is
  measured or proven insufficient.
- Add contention-oriented regression tests around snapshot and mapping paths.

### 5. Benchmark and refactor flexible-key matching hot paths

Evidence:

- `src/comparison/engine.rs` allows up to 10,000 flexible-key candidates and
  1,000,000 comparisons.
- `src/backend/workflow.rs` checks comparison count, candidate count, and then
  runs comparison, causing related splitting and matching work to be repeated.

Risk: dense flexible-key cases are bounded but can still be slow.

Plan:

- Add benchmark fixtures for dense flexible-key inputs near configured caps.
- Cache split rows and candidate data across validation and comparison.
- Prefer a deterministic matching strategy that avoids rebuilding graph/index
  state in tight loops.

### 6. Tighten persisted virtual-field validation

Evidence:

- Snapshot metadata validation checks physical columns against headers.
- Selection validation accepts virtual-looking labels if their physical source
  header exists, without requiring them to be listed in persisted virtual header
  metadata.

Risk: malformed snapshot or pair-order files can surface arbitrary virtual labels
that were not part of the saved/discovered metadata.

Plan:

- Validate persisted virtual labels for syntax and source-header consistency.
- Require saved selections and mappings to reference either physical headers or
  persisted virtual headers.
- Add malformed snapshot and pair-order tests.

## Priority 3: Harden Frontend and Desktop UX

### 7. Model Tauri dialog cancellation explicitly

Evidence:

- Tauri commands return `Option` for save/load dialog cancellation.
- `frontend/src/services/tauri.ts` converts `null` loads to `undefined` and
  discards save/export return values.
- Persistence hooks generally stop loading or report completion without
  distinguishing cancel from success.

Risk: users can cancel a dialog and receive ambiguous or misleading feedback.

Plan:

- Represent persistence outcomes as `saved`, `loaded`, or `cancelled`.
- Show lightweight status feedback for cancellation.
- Cover save, load, export, and snapshot flows in desktop-oriented frontend
  tests.

### 8. Improve accessibility coverage for mapping controls

Evidence:

- `frontend/src/components/mapping-config/NormalizationPanel.tsx` has visible
  labels for null-token and date-format controls without explicit `htmlFor` and
  `id` associations.

Risk: assistive technology and label-click behavior can be less reliable.

Plan:

- Add stable IDs, `htmlFor`, and `aria-describedby` where helper text exists.
- Add focused accessibility tests for the normalization panel.
- Add a reduced-motion CSS override for global animations in
  `frontend/src/index.css`.

### 9. Handle clipboard failures in pair-order preview

Evidence:

- `frontend/src/components/mapping-config/PairPreview.tsx` awaits
  `navigator.clipboard.writeText` without feature detection or `try/catch`.

Risk: permission denial or unavailable Clipboard API can create an unhandled
rejection and no user feedback.

Plan:

- Add failure state and user-visible feedback.
- Guard for missing Clipboard API.
- Add tests for successful copy, rejected copy, and unavailable clipboard.

## Priority 4: Reduce Maintenance Drift

### 10. Split the frontend transport module

Evidence:

- `frontend/src/services/tauri.ts` mixes runtime detection, browser HTTP calls,
  Tauri invokes, error parsing, file-size validation, drag/drop subscription,
  and API operation definitions.
- The frontend duplicates the backend CSV size limit.

Risk: transport behavior becomes harder to reason about, and duplicated contract
constants can drift.

Plan:

- Split into browser transport, Tauri transport, shared transport errors, and
  shared contract constants.
- Keep route and invoke constants centralized because parity tests already depend
  on them.
- Consider an endpoint or generated contract for limits if more shared constants
  appear.

### 11. Prune unused dependencies and features

Evidence:

- The root manifest appears to include dependencies or features that may no
  longer be used by production code.
- `src-tauri/Cargo.toml` includes dependencies that appear test-only or unused.
- `frontend/package.json` includes Tauri plugins that were not found in frontend
  imports.

Risk: unnecessary dependencies increase audit surface, build time, and update
noise.

Plan:

- Run a dependency-pruning pass with source inspection plus build/test
  validation.
- Move test-only Rust dependencies to `dev-dependencies`.
- Remove unused frontend dependencies and lockfile entries.
- Consider adding periodic dependency hygiene checks such as `cargo machete` and
  a JavaScript dependency checker.

### 12. Pin the Tauri CLI used by CI and release

Evidence:

- `.github/workflows/ci.yml`, `.github/workflows/release.yml`, and `README.md`
  install `tauri-cli` with `--version "^2"`.
- App dependencies are pinned to specific Tauri 2.11.x versions in manifests.

Risk: a future Tauri CLI 2.x change can alter packaging behavior without a
repository metadata diff.

Plan:

- Pin `tauri-cli` to a known-compatible version.
- Centralize the version in workflow environment variables and docs.
- Bump it deliberately alongside Tauri dependency updates.

### 13. Sync release documentation and version badges

Evidence:

- `AGENTS.md` omits the AppStream metainfo file from its release version list,
  while `docs/releasing.md` and `scripts/check_release_metadata.py` include it.
- `README.md` badges advertise older Tauri and TypeScript versions than the
  current manifests.

Risk: contributors and automation agents can follow stale release guidance or
publish visibly stale project metadata.

Plan:

- Update `AGENTS.md` to include the AppStream metainfo file.
- Update README badges, or replace volatile version badges with major-version or
  unversioned badges.
- Define whether AppStream history should be curated or mirror all recent
  changelog entries.

### 14. Review macOS packaging assumptions

Evidence:

- `src-tauri/Entitlements.plist` enables JIT and unsigned executable memory
  without an adjacent rationale.
- CI runs root Rust tests on macOS, while Tauri wrapper tests and packaging
  validation are concentrated in Linux CI and tag-time macOS release jobs.

Risk: macOS desktop issues may surface late, and broad entitlements can remain
without confirmation that they are still required.

Plan:

- Verify whether both entitlements are required for notarized builds.
- Document the rationale or remove unnecessary exceptions.
- Add a lightweight macOS Tauri wrapper test job, or a scheduled/manual macOS
  packaging smoke workflow.

## Suggested Execution Order

1. Fix snapshot-load body limits and add router regression coverage.
2. Add result pagination or virtualization.
3. Remove upload duplication and shorten session-store lock scopes.
4. Harden Tauri cancel handling, clipboard copy failures, and mapping-control
   accessibility.
5. Add flexible-key benchmarks, then refactor matching only with baseline data.
6. Tighten persisted virtual-field validation.
7. Split frontend transport responsibilities.
8. Prune unused dependencies and pin the Tauri CLI.
9. Sync release docs, badges, AppStream policy, and macOS packaging notes.

## Validation Targets for Follow-Up Work

- Root Rust changes: `cargo fmt --check && cargo test && cargo clippy -- -D warnings`.
- Tauri wrapper changes: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy -- -D warnings`.
- Frontend changes: `cd frontend && npm test && npm run lint && npm run build`.
- Release metadata changes: `python3 scripts/check_release_metadata.py --expected-tag vX.Y.Z`.
