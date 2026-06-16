# Codebase Quality And Simplicity Review - 2026-06-16

Scope: `src/`, `src-tauri/`, `frontend/src/`, tests, CI/release configuration, and existing review docs.

This is a planning artifact only. It does not implement runtime changes.

## Executive Summary

CSV Align is in better shape than a typical small desktop/web app: the core comparison behavior is shared between Axum and Tauri, transport parity is explicitly tested, CI runs Rust, frontend, Tauri, lint, formatting, and package metadata gates, and recent review findings have already been mostly resolved.

The next improvements should not be broad rewrites. The highest-value path is a small set of focused hardening and simplification phases:

1. Harden desktop/web trust boundaries and memory limits.
2. Measure before optimizing the known comparison and results-table hotspots.
3. Reduce public API footguns and remove avoidable bespoke complexity only where tests prove equivalent behavior.
4. Keep release/dependency hygiene current without adding heavyweight process.

## Stack Baseline

- Rust shared library and local web server: Rust 2024, Axum 0.8, Tokio, Tower, tracing, `thiserror`, `anyhow` (`Cargo.toml:4`, `Cargo.toml:16-25`).
- Desktop wrapper: Tauri 2.10 with dialog plugin and shared `csv-align` backend crate (`src-tauri/Cargo.toml:9-23`).
- Frontend: React 19.2, TypeScript 5.8, Vite 8, Tailwind 4, Vitest, oxlint, React Compiler Babel plugin (`frontend/package.json:22-38`, `frontend/vite.config.ts:7-11`).
- Validation: CI runs root Rust tests, fmt, clippy, frontend tests/lint/build, Tauri tests/fmt/clippy, package metadata validation, and Linux bundle validation (`.github/workflows/ci.yml:89-96`, `.github/workflows/ci.yml:134-146`, `.github/workflows/ci.yml:232-242`).

## External Research Used

- Rust language docs: `panic!` is for detected bugs; `Result` is for anticipated runtime failures.
  Source: https://github.com/rust-lang/rust/blob/master/library/core/src/macros/panic.md?plain=1#L26#when-to-use-panic-vs-result
- Rust API Guidelines: document `Errors` and `Panics` sections for public APIs.
  Source: https://github.com/rust-lang/api-guidelines/blob/master/src/documentation.md?plain=1#L66#function-docs-include-error-panic-and-safety-considerations-c-failure
- Axum docs: fallible middleware such as timeouts must be converted into responses through `HandleErrorLayer`.
  Source: https://github.com/tokio-rs/axum/blob/main/axum/src/docs/error_handling.md?plain=1#L94#applying-fallible-middleware
- Tauri security docs: CSP is a core WebView hardening layer and should be as restricted as practical.
  Source: https://v2.tauri.app/security/csp/
- Tauri config docs: CSP is important WebView security configuration; capabilities control which permissions are enabled.
  Source: https://tauri.app/reference/config/#securityconfig
- Tauri capabilities docs: capabilities reduce impact of frontend compromise and should constrain permissions by window/webview labels.
  Source: https://tauri.app/security/capabilities/
- Tauri filesystem docs: plugin filesystem APIs provide binary/text file APIs, streaming text lines, and scoped permissions for performance and safety.
  Source: https://v2.tauri.app/plugin/file-system/
- React docs: `useCallback` should not be added everywhere; prefer local state, pure rendering, and profiling before memoization.
  Source: https://react.dev/reference/react/useCallback#should-you-add-usecallback-everywhere
- React docs: `useDeferredValue` can keep input responsive when expensive UI re-renders lag behind input changes.
  Source: https://react.dev/reference/react/useDeferredValue#usage
- React 19 release notes: async transitions can represent pending UI while keeping current UI responsive.
  Source: https://react.dev/blog/2024/12/05/react-19
- Exa research: current Rust/Axum production guidance consistently emphasizes typed errors, thin handlers, structured tracing, request validation, security middleware, and graceful shutdown.
  Sources: https://docs.rs/axum/latest/axum/error_handling/index.html, https://github.com/gruberb/bulletproof-rust-web
- Exa research: Tauri security guidance emphasizes CSP, IPC trust boundaries, capabilities, and scoped permissions.
  Sources: https://v2.tauri.app/security/, https://v2.tauri.app/security/csp/, https://v2.tauri.app/security/capabilities/, https://v2.tauri.app/plugin/file-system/
- Exa research: React 19 performance guidance emphasizes measuring first, relying on React Compiler where appropriate, and virtualizing genuinely large lists instead of blanket memoization.
  Sources: https://react.dev/blog/2024/12/05/react-19, https://www.stanza.dev/concepts/react-performance

## Confirmed Strengths

- Shared backend architecture avoids separate web and desktop business logic (`src/lib.rs:1-5`, `src-tauri/src/commands.rs:10-20`).
- HTTP and Tauri transports call the same workflow/store functions (`src/api/handlers.rs:13-19`, `src-tauri/src/commands.rs:10-17`).
- The Tauri command registration is centralized through a macro, reducing invoke/handler drift (`src-tauri/src/main.rs:14-35`, `src-tauri/src/main.rs:55-59`).
- Session storage is already capped by count, addressing part of a prior memory-growth finding (`src/backend/store.rs:7-23`, `src/backend/store.rs:40-56`).
- Frontend workflow state has been moved into a reducer and action hooks instead of one monolithic `App` (`frontend/src/App.tsx:10-35`, `frontend/src/hooks/useComparisonWorkflow.ts:15-181`).
- Results UI already uses React 19-era primitives where useful: `useDeferredValue` and `useTransition` appear in `ResultsTable` for search/sort responsiveness (`frontend/src/components/ResultsTable.tsx:1`, `frontend/src/components/ResultsTable.tsx:168-193`, `frontend/src/components/ResultsTable.tsx:206-216`).
- Existing review artifact tracks previous findings and shows most were resolved, leaving session memory limits, flexible-key performance, desktop byte transfer, and panic-wrapper API as open items (`docs/reviews/codebase-improvement-review-2026-06-14.md:15-19`, `docs/reviews/codebase-improvement-review-2026-06-14.md:179-184`).

## Findings And Improvement Plan

### Phase 1 - Security And Resource Hardening

Goal: reduce trust-boundary and memory risk without changing product behavior.

1. Add a production CSP for the Tauri app.

Evidence: `src-tauri/tauri.conf.json:9-12` sets `"csp": null`. Tauri docs describe CSP as WebView XSS impact reduction and recommend a restricted policy.

Suggested work:

- Start with a minimal bundled-app CSP for local assets, IPC, fonts, images/blob/data URLs, and required inline style allowance only if Tailwind/Vite output needs it.
- Add `devCsp` separately if Vite dev requires looser `connect-src` or websocket allowances.
- Validate with `cd frontend && npm run build`, `cd src-tauri && cargo test`, and a manual desktop smoke test.

2. Tighten Tauri capability surface.

Evidence: `src-tauri/capabilities/default.json:5-10` grants `core:default`, `core:webview:allow-create-webview-window`, and dialog open/save to both `main` and `app-*`. Tauri docs warn that capabilities merge security boundaries across windows and recommend constraining permissions by labels.

Suggested work:

- Confirm whether `app-*` windows need all existing permissions or only subset permissions.
- Split capabilities by window label if secondary windows do not need file dialogs or webview creation.
- Review custom command exposure using Tauri's command manifest guidance, because registered commands are allowed by default unless constrained.
- Add a lightweight test or config check to preserve intended labels and permissions.

3. Add stronger session memory controls for web mode.

Evidence: `SessionStore` caps count at 128 sessions but has no TTL or approximate byte budget (`src/backend/store.rs:7-23`, `src/backend/store.rs:40-56`). `SessionData` can retain CSV data and comparison results (`src/backend/session.rs:7-18`). The previous review marks this as partially resolved (`docs/reviews/codebase-improvement-review-2026-06-14.md:53-68`).

Suggested work:

- Track `last_accessed` and evict idle sessions on create/access/delete.
- Add approximate session-size accounting for CSV rows plus result rows, then reject or evict before large repeated loads exhaust memory.
- Keep this in the shared store instead of adding transport-specific cleanup.
- Add tests for count, idle eviction, and oversized-session behavior.

4. Put explicit limits around file loading.

Evidence: browser mode accepts multipart bytes then reads the entire field (`src/api/handlers.rs:119-143`); desktop mode converts a selected `File` into `number[]` before invoking Rust (`frontend/src/services/tauri.ts:93-95`, `frontend/src/services/tauri.ts:151-166`). The previous review already calls out desktop byte-array expansion (`docs/reviews/codebase-improvement-review-2026-06-14.md:116-130`).

Suggested work:

- Define a documented maximum CSV size for current in-memory comparison behavior.
- Reject oversized loads early with a clear user-facing error in both transports.
- For desktop, investigate a Tauri binary/file-reading path that avoids expanding each byte into a JavaScript number.
- Avoid streaming comparison rewrites until there is evidence current limits block real users.

### Phase 2 - Measured Performance Work

Goal: benchmark hotspots before changing algorithms or UI structure.

1. Benchmark flexible-key matching before refactoring.

Evidence: `src/comparison/engine.rs` is 838 lines and contains flexible matching candidate collection, sorting, max-cardinality selection, and result emission. Existing caps allow 10,000 candidates and 1,000,000 comparisons (`src/comparison/engine.rs:13-14`). The prior review identifies repeated maximum matching work as open (`docs/reviews/codebase-improvement-review-2026-06-14.md:100-115`).

Suggested work:

- Add targeted benchmarks or timing tests around dense flexible-key inputs near caps.
- Preserve exact output ordering before changing the algorithm.
- Only then consider replacing repeated trial matching with cached graph state or deterministic weighted matching.
- Keep correctness tests separate from performance benchmarks so normal CI remains fast.

2. Add result-table scaling evidence and virtualize only if needed.

Evidence: `ResultsTable` renders every `visibleResults` row (`frontend/src/components/ResultsTable.tsx:321-368`) and only warns when more than 50 are shown (`frontend/src/components/ResultsTable.tsx:377-380`). React guidance says virtualization is the real fix for large DOM lists; `useDeferredValue` helps responsiveness but does not reduce DOM cost.

Suggested work:

- Add a repeatable profiling fixture with thousands of match/mismatch rows.
- Measure search, sort, expand, and filter interactions in browser and desktop.
- If the DOM is the bottleneck, introduce virtualization in `ResultsTable` while preserving table accessibility and exported HTML behavior.
- If current row counts are modest, keep the simpler table and just document practical limits.

3. Keep React memoization deliberate.

Evidence: React Compiler is enabled in Vite (`frontend/vite.config.ts:7-11`), and the code uses `useMemo`/`useCallback` in several state and table paths. React docs recommend not adding callback memoization everywhere and profiling first.

Suggested work:

- Do not add broad `memo`, `useMemo`, or `useCallback` sweeps.
- Remove manual memoization only when profiling or compiler diagnostics show it is unnecessary and tests remain stable.
- Prefer local state and pure rendering over new global state or query libraries.

### Phase 3 - API Safety And Simplicity

Goal: make safer paths the default and reduce custom complexity only where it has become a maintenance cost.

1. Make the fallible comparison API the primary public API.

Evidence: `compare_csv_data` panics on invalid configuration (`src/comparison/engine.rs:115-124`), while `try_compare_csv_data` already returns `ComparisonColumnSelectionError` (`src/comparison/engine.rs:126-165`). Rust guidance reserves panics for bugs and asks public APIs to document panic/error behavior.

Suggested work:

- Update docs and call sites to prefer `try_compare_csv_data`.
- Either rename the panic wrapper to make the unchecked behavior obvious or document a `# Panics` section if it remains public.
- Add a regression test that invalid column selection returns an error through the workflow/API path.

2. Reduce custom frontend request-token complexity carefully.

Evidence: workflow request freshness is managed through `workflowGenerationRef`, `workflowMutationRef`, `currentSessionIdRef`, and token comparison (`frontend/src/hooks/useComparisonWorkflow.ts:19-59`). This is purposeful race protection, not accidental slop, but it is a bespoke pattern that every async workflow action must remember to use (`frontend/src/hooks/useWorkflowComparisonActions.ts:45-66`, `frontend/src/hooks/useWorkflowPersistenceActions.ts:52-68`).

Suggested work:

- Do not remove the race protection.
- Consider extracting the token generation/check/invalidation into one small hook with a narrow API and existing tests moved around it.
- Consider `AbortController` for browser HTTP requests only if it simplifies, not if it forces separate desktop behavior.
- Use React 19 `useEffectEvent` only for effect-local latest callbacks if it removes dependency churn; do not cargo-cult it into event handlers.

3. Split large logic files along existing domain seams, not arbitrary size thresholds.

Evidence: large files are concentrated in real hotspots: `src/comparison/engine.rs` has 838 lines, `frontend/src/features/results/presentation.ts` has 634 lines, and `frontend/src/components/ResultsTable.tsx` has 385 lines. Size alone is not a defect, but these modules mix multiple responsibilities.

Suggested work:

- In `engine.rs`, extract only behavior-preserving pieces after flexible-key benchmarks exist, such as flexible candidate selection or result emission helpers.
- In results presentation, split search/sort row-model builders only if tests remain behavior-focused and imports get clearer.
- Avoid broad folder churn or new architectural layers.

### Phase 4 - Validation, Release, And Dependency Hygiene

Goal: keep existing high CI quality without increasing maintenance drag.

1. Add targeted security/dependency checks after trialing noise locally.

Evidence: CI is strong for behavior, formatting, lint, build, and package metadata, but does not appear to run dependency vulnerability/license checks (`.github/workflows/ci.yml:66-146`, `.github/workflows/ci.yml:180-320`).

Suggested work:

- Trial `cargo audit`/`cargo deny` and `npm audit --omit=dev` or an equivalent Dependabot/security workflow outside the required CI path first.
- Promote to CI only after false-positive policy is documented.
- Keep license policy aligned with current MIT project metadata and release packaging.

2. Preserve release metadata gates and avoid expanding release process unless failures recur.

Evidence: version metadata is intentionally synchronized across Rust, Tauri, frontend, lockfiles, AppStream, changelog, and release docs (`AGENTS.md`, `README.md:194-198`, `.github/workflows/ci.yml:98-109`).

Suggested work:

- Keep the existing `scripts/check_release_metadata.py` gate.
- Add new release checks only for concrete failure modes, not speculative completeness.
- Keep docs-only changes exempt from full release requirements.

## Work To Avoid For Now

- Do not introduce Redux/Zustand/React Query just to manage the current three-step workflow; the reducer/hooks are adequate.
- Do not split the Rust crate into multiple crates unless compile times, ownership boundaries, or external consumers demand it.
- Do not rewrite CSV processing as streaming until file-size evidence proves the current in-memory model is limiting users.
- Do not add blanket memoization or `React.memo` passes; React Compiler is already enabled and React docs recommend profiling first.
- Do not replace the shared backend transport architecture; it is one of the strongest parts of the codebase.

## Recommended Sequence

1. Tauri CSP and capability tightening.
2. Session TTL/byte limits and explicit CSV size limits.
3. Desktop large-file transfer investigation.
4. Flexible-key benchmark harness and algorithm decision.
5. Results-table profiling and possible virtualization.
6. Public comparison API documentation/rename.
7. Extract frontend request-token helper if it reduces call-site complexity.
8. Trial dependency/security scanning and promote only if low-noise.

## Validation Plan For Future Implementation

- Root Rust: `cargo fmt --check && cargo test && cargo clippy -- -D warnings`.
- Tauri wrapper: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy -- -D warnings`.
- Frontend: `cd frontend && npm test && npm run lint && npm run build`.
- Security hardening: manual Tauri smoke test for file load, compare, export CSV, export HTML, save/load pair order, and save/load comparison snapshot.
- Performance phases: checked-in benchmark/profiling notes with before/after datasets and no behavior changes unless measured improvement justifies them.
