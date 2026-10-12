# CSV Align codebase review, 2026-10-12

## Recommendation and scope

Retain the shared-backend architecture and fix six demonstrated issues. The main improvements are file integrity, bounded imported configuration, valid-input parsing and reliable validation coverage. A broad rewrite is not justified by the evidence.

Review coverage: shared Rust workflows, session locking/resource accounting, comparison and mapping, CSV loading/export, snapshots and pair orders, Axum request handling and loopback middleware, Tauri commands/registration/capabilities, React workflow hooks and transport services, results pagination/HTML export, contracts, representative tests, benchmarks, packaging scripts and CI/release workflows. Previous June and July reviews were consulted to avoid repeating delivered changes. This is broad static inspection plus the automated checks recorded in Flow, not an exhaustive line-by-line audit or proof of all behavior.

## Architecture

React workflow hooks/reducer call a browser HTTP or desktop invoke adapter. Both adapters call shared backend workflows, which coordinate session state, comparison, presentation and persistence. Keeping product validation in the shared library avoids platform-specific behavior drift. Transport parity fixtures provide a valuable executable contract.

Existing strengths, observed before implementation:

- Axum heavy operations use blocking tasks (`src/api/handlers.rs:63-94`); Tauri does likewise (`src-tauri/src/commands.rs:334-351,434-445`).
- Per-session locks and operation claims protect concurrent updates (`src/backend/store.rs:83-93,208-317`). Preserve the documented lock ordering.
- CSV structure/allocation bounds are enforced during parsing (`src/data/csv_loader.rs:74-172`).
- Browser snapshots use raw file upload and preflight limits (`frontend/src/services/tauri.ts:268-301`).
- Results paginate by 50 and load inspection details lazily (`frontend/src/components/ResultsTable.tsx:192-220,354-358`).
- Native production CSP is configured (`src-tauri/tauri.conf.json:10-12`).
- CSV export already uses temporary-file atomic publication (`src/data/export.rs:384-482`).
- Release workflow verifies artifacts and handles existing published releases immutably (`.github/workflows/release.yml:709-759,881-924`).

Line references describe the reviewed baseline and may move during remediation.

## Findings and phases

| ID | Priority | Evidence and effect | Improvement |
| --- | --- | --- | --- |
| OCT-01 | High | `src-tauri/src/commands.rs:50-61` uses `fs::write` for HTML, pair-order and snapshot saves. An existing destination is truncated before a later write failure, potentially destroying saved work. CSV export already has safer publication. | Reuse atomic publication, including portable permissions and symlink behavior. Inject partial-write/sync failures and verify original bytes. |
| OCT-02 | Medium | `.github/workflows/ci.yml:42-64` omits `contracts/**`. Rust and frontend tests consume those files (`tests/transport_parity_integration.rs:41-43`, `frontend/src/services/transportContract.test.ts:1-4`). A contract-only change can skip the checks enforcing it. | Select all consumer jobs for contract changes, including the frontend artifact prerequisite for desktop builds. Preserve docs-only exclusions. |
| OCT-03 | Medium | Native pair-order loading reads all contents (`src-tauri/src/commands.rs:138-150`); browser loading reads before backend validation (`frontend/src/services/tauri.ts:235-253`). Shared parsing has no content-byte limit and parses twice (`src/backend/pair_order.rs:39-94`). HTTP has an implicit extractor budget instead of explicit parity. | Apply a 2 MiB UTF-8 contents policy to save and load. Bound native reads, reject oversized browser files before reading, and allow worst-case JSON escaping in the HTTP envelope. This intentionally rejects configurations beyond the policy rather than promising arbitrarily long headers. |
| OCT-04 | Medium | `src/data/csv_loader.rs:303-337` counts delimiters on one physical line. A valid header `"customer\nname";amount` falls back to comma before seeing its semicolon. | Scan the first complete logical record, respecting quotes and escaped quotes; retain comma ties, BOM and encoding behavior. |
| OCT-05 | Medium | README claims Rust 1.85, while source uses let chains (`src/comparison/value_compare.rs:34-39,69-71`). Neither manifest declares a floor. README test commands navigate from `src-tauri` into a nonexistent child `frontend`; AGENTS incorrectly says Vitest is not CI-gated. | Declare and test Rust 1.88 with locked dependencies for both crates and correct paths/CI guidance. Both crates passed `cargo +1.88.0 check --locked` on Linux before edits; tests are required for the phase. |
| OCT-06 | Low | `src/backend/workflow.rs:530-548` clones `execution.response` before consuming the execution; commit uses results/configuration, not response. This deep-copies the response graph unnecessarily. | Move the original response through commit and verify allocation identity, returned values, stored results and stale-operation behavior. No broader retained-result redesign. |

Execution checklist: [codebase-improvements-2026-10-12.md](../plans/codebase-improvements-2026-10-12.md).

## Complexity assessment

- **Session synchronization:** index/control/data locks, eviction retries and resource metadata are inherently sensitive. Existing lock ordering and barrier-driven concurrency tests are better safeguards than removing operation claims for apparent simplicity.
- **Flexible matching:** Cartesian candidate classification plus graph matching is a profiling target. Existing survey bounds matter, but no new latency measurements justify changing the algorithm.
- **Mapping suggestions:** column-pair scoring/sorting and content-profile intersections (`src/comparison/mapping.rs:49-79,218-229`) scale with column combinations. Measure representative wide files before changing scoring or caches.
- **Persistence:** strict validation and borrowed snapshot serialization are useful. A module named `v1` containing snapshot version 2 is naming debt, not evidence of a broken reader.
- **Frontend concurrency:** generation, mutation and per-operation tokens have distinct responsibilities. Consolidation requires behavioral evidence; blanket hook/state-library replacement is unwarranted.
- **Results/export:** React and standalone exported HTML run in separate environments. Share pure presentation semantics where practical, without inventing a common rendering framework.
- **CI/release:** workflow size alone is not a defect. Signing, artifact validation and immutable reruns explain much of the complexity. Fix concrete path-filter gaps before restructuring publication.

No numerical cyclomatic-complexity, vulnerability or benchmark improvement claim is made by this review.

## Researched standards and application

Official sources were retrieved through Ref and Exa during the review:

1. [Rust `fs::write`](https://doc.rust-lang.org/std/fs/fn.write.html): convenience wrapper around create/write-all which replaces existing contents. Supports OCT-01's integrity concern.
2. [Cargo `rust-version`](https://doc.rust-lang.org/cargo/reference/rust-version.html): declares a supported toolchain and gives direct diagnostics on unsupported compilers. Support should be verified, including dependency compatibility. Supports OCT-05.
3. [Axum extractor request-body limits](https://github.com/tokio-rs/axum/blob/main/axum/src/docs/extract.md#request-body-limits): Bytes-backed extractors, including Json, default to 2 MB. Set explicit limits for a cross-transport product policy rather than relying on defaults. Supports OCT-03.
4. [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html), section 2: quoted CSV fields can contain line breaks and double quotes escaped by doubling. Semicolon dialect support is a product extension; quoted logical-record handling is still necessary. Supports OCT-04.
5. [Tokio `spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html): blocking work belongs off the async executor; CPU-bound parallel work may need explicit concurrency control, and started blocking tasks cannot be aborted. Existing adapters follow offloading guidance. Capacity/cancellation redesign remains a measured follow-up.
6. [React Compiler introduction](https://github.com/reactjs/react.dev/blob/main/src/content/learn/react-compiler/introduction.md): compiler optimizes component/hook rendering, not all ordinary functions; profile expensive calculations before adding complexity. Avoid blanket memoization changes in this compiler-enabled frontend.
7. [Tauri capabilities](https://v2.tauri.app/security/capabilities/): permissions apply per window/webview, overlapping capabilities merge permissions, and custom registered commands are broadly allowed by default unless constrained. Existing CSP/capabilities deserve review against supported secondary-window behavior, not arbitrary permission removal.

## Deferred opportunities and assurance boundaries

Mapping/flexible-key profiling, global transient-work capacity/cancellation, shared retained-result ownership, capability narrowing and dependency-use/security scans remain follow-ups. None has enough current measurement or supported-product evidence for a safe implementation here. No state-library migration, crate split, streaming comparison or blanket memoization is proposed.

Linux GTK/WebKit/native dependencies are available locally, allowing wrapper compilation/tests. Headless tests do not verify native dialogs, live WebView rendering, accessibility, CSP at runtime or packaged application installation. Cross-platform native builds, release-signing rehearsal and interactive UI sweeps were not performed.
