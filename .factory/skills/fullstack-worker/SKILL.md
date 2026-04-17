---
name: fullstack-worker
description: Implements features that require coordinated changes across Rust backend AND TypeScript frontend in a single commit (wire-contract changes, port changes, shared type bumps, transport migrations). Combines rust-worker and frontend-worker procedures with a focus on keeping the stack green end-to-end throughout.
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features where Rust and TypeScript MUST change together or the build/runtime will break between commits. Examples:
- Axum port 3000 → 3001 + vite.config.ts proxy alignment + README/AGENTS.md updates.
- `duplicate_filea` → `duplicate_file_a` serde rename (affects `src/data/types.rs` + `tests/response_contracts.rs` + `frontend/src/types/api.ts` + `frontend/src/features/results/presentation.ts` + Vitest assertions + DOM text).
- `MappingRequest`/`MappingResponse` → `MappingDto` collapse (affects both sides in lockstep).
- Persistence v2 snapshot format + frontend error handling for v1.x snapshots.

Do NOT use when the change can be cleanly split into one rust-worker feature followed by one frontend-worker feature without a broken intermediate state.

## Required Skills

- `agent-browser` — REQUIRED for verifying that the wire change still produces a working UI end-to-end. Use after both sides are implemented.

## Work Procedure

1. **Read the feature's preconditions, expectedBehavior, verificationSteps, and `fulfills`.** Open `.factory/library/architecture.md` and `.factory/library/user-testing.md`.
2. **Enumerate every file that must change.** Write a short plan comment in the implementation before starting. For wire renames, this means: domain type, serde attributes, conversion impls, integration tests, frontend TS type, feature helpers, Vitest assertions, any user-visible text.
3. **Update tests first** (both Rust and Vitest) to reflect the new contract. Confirm they fail. This is still TDD — both sides share one contract.
4. **Implement backend changes.** Verify:
   - `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` (root).
   - `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.
5. **Implement frontend changes.** Verify:
   - `cd frontend && npm run build && npm test -- --run && npm run lint`.
6. **End-to-end verification:**
   - Start Axum server per `.factory/services.yaml`.
   - Invoke `agent-browser` to drive the flow that exercises the new contract.
   - Capture a network request/response to confirm the on-wire JSON matches the new shape (for rename / DTO collapse features).
   - Capture console-errors (must be empty).
7. **Update docs in the same feature** if the wire change affects: `README.md`, `AGENTS.md`, or `.factory/library/*`. Do NOT leave stale doc references to the old contract.
8. **Cleanup:**
   - Kill Axum server (`lsof -ti :3001 | xargs kill`, `lsof -ti :3000 | xargs kill`).
   - Run the full CI-parity sweep one more time:
     ```
     cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test \
       && (cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test) \
       && (cd frontend && npm run build && npm test -- --run && npm run lint)
     ```
9. **No `#[allow]`, no `: any`, no stale references to the old contract.** A `rg` sweep for the old identifier across `src/ src-tauri/ tests/ frontend/src/` must return zero matches outside of intentional migration guidance.

## Example Handoff

```json
{
  "salientSummary": "Completed the v2 serde rename duplicate_filea/duplicate_fileb → duplicate_file_a/duplicate_file_b across src/data/types.rs (serde attrs), tests/response_contracts.rs + comparison_engine_integration.rs (fixture strings), frontend/src/types/api.ts + features/results/presentation.ts (type literal unions + label map). `rg duplicate_file(a|b)\\b` returns zero matches across the repo. Full CI-parity sweep green locally. agent-browser confirmed no legacy identifiers appear in POST /compare response or DOM.",
  "whatWasImplemented": "In src/data/types.rs, replaced `#[serde(rename = \"duplicate_filea\")]` with `#[serde(rename = \"duplicate_file_a\")]` (and the b variant), and lifted `#[serde(rename_all = \"snake_case\")]` to the ResultType enum so future variants are consistent. Updated 14 assertion strings across response_contracts.rs, comparison_engine_integration.rs, export_integration.rs, and presentation_responses_integration.rs. Updated frontend type literal `ResultType` in frontend/src/types/api.ts and the `RESULT_LABELS` map in features/results/presentation.ts. Updated the Duplicates filter predicate `matchesResultFilter` and its Vitest coverage.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {"command": "rg 'duplicate_file(a|b)\\b' src src-tauri tests frontend/src", "exitCode": 1, "observation": "zero matches (rg exit 1 = no results found, as expected post-rename)"},
      {"command": "cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test", "exitCode": 0, "observation": "76 passed / 0 failed"},
      {"command": "cd src-tauri && cargo test", "exitCode": 0, "observation": "3 passed"},
      {"command": "cd frontend && npm run build && npm test -- --run && npm run lint", "exitCode": 0, "observation": "tsc clean, 63 passed, oxlint 0 warnings"}
    ],
    "interactiveChecks": [
      {"action": "cargo run &; agent-browser open http://127.0.0.1:3001; load samples/file_a.csv + file_b.csv (one has a duplicated key); auto-pair; compare; inspect POST /compare response and DOM.", "observed": "Network response contains `\"result_type\":\"duplicate_file_a\"` and `\"duplicate_file_b\"`. DOM filter Duplicates badge shows 2; table renders 2 orange-badge rows. No occurrence of `duplicate_filea` or `duplicate_fileb` in the captured HAR or DOM text."}
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/response_contracts.rs",
        "cases": [
          {"name": "result_type_serializes_to_snake_case_v2", "verifies": "All 7 ResultType variants serialize to `match`/`mismatch`/`missing_left`/`missing_right`/`unkeyed_left`/`unkeyed_right`/`duplicate_file_a`/`duplicate_file_b`/`duplicate_both`."}
        ]
      },
      {
        "file": "frontend/src/features/results/presentation.test.ts",
        "cases": [
          {"name": "matchesResultFilter aggregates duplicate_file_a, duplicate_file_b, duplicate_both under duplicates filter", "verifies": "Filter predicate covers all three v2 variants."}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A wire change ripples into a module that was meant to be refactored separately (e.g., renaming DuplicateFile* exposes that the `RowComparisonResult` flatten feature should land first).
- Tauri wrapper tests fail in ways that suggest a shared backend bug — report the trace and suggest a precursor feature.
- You find a third call site for a rename (e.g., in docs or example snippets) that isn't in the feature description — flag and ask whether to include.
