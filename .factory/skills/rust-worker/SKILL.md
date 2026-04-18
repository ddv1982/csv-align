---
name: rust-worker
description: Implements Rust backend changes — library crate (src/), Axum handlers (src/api/), Tauri wrapper (src-tauri/), Rust dependency upgrades, and shared test suites under tests/ and src-tauri/src/. Uses TDD, keeps clippy clean at -D warnings, and preserves behavior (or updates tests in lockstep with wire-contract changes).
---

# Rust Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features touching:
- Cargo dependency bumps (Axum, tokio, tower-http, chrono, uuid, strsim, tempfile, tauri, thiserror, anyhow, tracing).
- Rust edition / MSRV changes.
- `src/` library code: data types, comparison engine, mapping heuristics, CSV loader, export, presentation DTOs.
- `src/api/` Axum handlers, routing, `AppState`.
- `src/backend/` workflows, validation, session state, error types (`CsvAlignError`), pair-order + snapshot persistence.
- `src-tauri/src/` Tauri commands and their tests.
- `tests/*.rs` integration suites.

Do NOT use for: frontend-only features (use `frontend-worker`), release orchestration (use `release-worker`).

## Required Skills

None specific. If a feature requires UI verification, return to orchestrator — do not spin up agent-browser from a Rust worker.

## Work Procedure

1. **Read the feature's preconditions, expectedBehavior, verificationSteps, and `fulfills` assertions.** Open `.factory/library/architecture.md` and `.factory/library/user-testing.md` for context.
2. **Read the relevant source files before editing** — do not guess at existing shapes. For cargo dep bumps, also read upstream release notes or the cached research at `.factory/research/deps-2026-04.md`.
3. **Red → Green TDD:**
   - Write (or update) the failing test first in `tests/` or `src-tauri/src/*tests*.rs`. For wire-contract changes that break old tests, update the existing test to the new contract in a first commit-step, then implement.
   - Run `cargo test` (or `cd src-tauri && cargo test`) to confirm red.
   - Implement minimal code to make green.
   - Re-run the targeted test, then the full suite.
4. **Local quality gates after each non-trivial change:**
   - `cargo fmt` (apply, don't just check).
   - `cargo fmt --check` to confirm.
   - `cargo clippy --all-targets -- -D warnings` at the repo root.
   - `cd src-tauri && cargo clippy --all-targets -- -D warnings` when touching the wrapper.
   - Full suites: `cargo test` AND `cd src-tauri && cargo test`.
5. **For Axum route or wire-contract changes:** verify the frontend still builds after the change (`cd frontend && npm run build`). If frontend `types/api.ts` or `services/tauri.ts` must change in lockstep, update them within the same feature — do NOT leave a broken build for a follow-up feature unless the mission plan explicitly splits it.
6. **For error-type changes:** ensure `CsvAlignError` (or equivalent) has `IntoResponse` for Axum AND `Serialize` for Tauri; write a test asserting each variant's HTTP status.
7. **For dep bumps with breaking changes:** follow the dep research doc at `.factory/research/deps-2026-04.md`. Apply migration codemods where available; otherwise do manual updates with compile-driven iteration.
8. **No `#[allow(dead_code)]` / `#[allow(unused)]` added without an inline `// reason:` comment.**
9. **Leave no orphaned processes.** Any `cargo run &` or dev server you started — kill by PID before reporting the handoff.
10. **Final verification before handoff:**
    - `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
    - `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` (always — wrapper compilation matters even for non-Tauri features).
    - If any frontend type or service changed: `cd frontend && npm run build`.

11. **COMMIT THE WORK (HARD REQUIREMENT for success handoff).**
    - After all validators are green, stage your changes and create a Conventional Commit with co-author trailer.
    - Use types: `feat`, `fix`, `refactor`, `chore`, `perf`, `docs`, `test`, `build`, `ci`. `chore(deps)` for dep bumps; `refactor` for dedup / migration; `feat` for new modules/APIs.
    - Commit message body should briefly explain what and why (1-2 sentences).
    - ALWAYS include:
      ```
      Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>
      ```
    - Verify `git status --short` is empty after the commit and record the commit SHA in your handoff.
    - **A feature without a commit cannot be reported as `successState: "success"`.** If you cannot commit for some reason, return to orchestrator explaining why — do not leave the tree dirty and claim success.
    - If the working tree at session start already contains unexpected modified files, return to orchestrator immediately rather than committing or attempting to distinguish scope.

## Example Handoff

```json
{
  "salientSummary": "Introduced CsvAlignError (thiserror) with IntoResponse and Serialize impls. Migrated backend/validation.rs and api/handlers.rs from Result<T, String> to Result<T, CsvAlignError>. Added new test `error_variants_map_to_documented_http_status` in tests/response_contracts.rs covering 5 variants. Ran fmt/clippy/cargo test at repo root and in src-tauri — all green (76 → 77 tests, 3 tauri tests).",
  "whatWasImplemented": "Added src/backend/error.rs exposing CsvAlignError with variants NotFound, Validation, BadInput, Parse, Internal. Implemented `impl From<ValidationError> for CsvAlignError`, `impl IntoResponse for CsvAlignError`, and `impl Serialize for CsvAlignError`. Replaced Result<T, String> throughout src/backend/validation.rs, src/backend/workflow.rs, and src/api/handlers.rs. Updated the three existing validation error tests to assert on the new variant names.",
  "whatWasLeftUndone": "Pair-order and comparison_snapshot modules still return Result<T, String>; those migrate in the next feature (M3.2). The Tauri wrapper in src-tauri/src/main.rs uses `.map_err(|e| e.to_string())` at the command boundary for now — explicit Serialize-based propagation lands when the Tauri thin-adapter feature ships in M5.",
  "verification": {
    "commandsRun": [
      {"command": "cargo fmt --check", "exitCode": 0, "observation": "no diff"},
      {"command": "cargo clippy --all-targets -- -D warnings", "exitCode": 0, "observation": "no warnings; finished in 38s"},
      {"command": "cargo test", "exitCode": 0, "observation": "77 passed / 0 failed across 20 binaries"},
      {"command": "cd src-tauri && cargo clippy --all-targets -- -D warnings", "exitCode": 0, "observation": "no warnings"},
      {"command": "cd src-tauri && cargo test", "exitCode": 0, "observation": "3 passed / 0 failed"},
      {"command": "cd frontend && npm run build", "exitCode": 0, "observation": "tsc clean, vite build produced dist/, 248 kB JS"}
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "tests/response_contracts.rs",
        "cases": [
          {"name": "error_variants_map_to_documented_http_status", "verifies": "Each CsvAlignError variant serializes to the correct HTTP status code (NotFound -> 404, Validation -> 400, BadInput -> 400, Parse -> 400, Internal -> 500) and JSON body shape { error: String, code: String }"}
        ]
      }
    ]
  },
  "discoveredIssues": [
    {
      "severity": "low",
      "description": "`src/backend/comparison_snapshot.rs` still has a local `fn validate_mappings` that duplicates checks already present in validation.rs::audit_selected_columns. Not in this feature's scope — should fold into the upcoming dedup feature.",
      "suggestedFix": "Replace validate_mappings calls with a call into the centralized validation::audit_selected_columns."
    }
  ]
}
```

## When to Return to Orchestrator

- A cargo dep bump produces hundreds of lines of unrelated lint fixups (signal that the migration warrants its own feature).
- A test failure reveals a preexisting bug that is not covered by this feature's scope.
- The feature requires cross-layer changes the orchestrator split into separate milestones.
- An Axum 0.8 migration uncovers that a route can no longer satisfy the old behavior without a wire change that wasn't in the plan.
- You identify duplicated logic that could be merged but lives in another feature's scope.
