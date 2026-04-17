---
name: frontend-worker
description: Implements React/TypeScript frontend changes — React 19 migration, Tailwind CSS work, component extraction, state refactors, accessibility fixes, test hoisting, Vitest, and oxlint setup. Verifies via npm run build, npm test, npm run lint, plus agent-browser UI checks for visible changes.
---

# Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features touching:
- `frontend/package.json` deps (React 19, TypeScript, Vite, Vitest, Tailwind, @tauri-apps/*).
- `frontend/src/**` components, hooks, features, services, types.
- `frontend/src/test/` fixtures and Vitest setup.
- `frontend/vite.config.ts` / `tsconfig*.json`.
- Adding/modifying Vitest tests.
- oxlint configuration + `npm run lint` wiring.

Do NOT use for: backend-only changes (use `rust-worker`), release tagging (use `release-worker`).

## Required Skills

- `agent-browser` — REQUIRED for features whose `fulfills` includes any VAL-FILE / VAL-MAP / VAL-RESULTS / VAL-PERSIST / VAL-SHELL / VAL-CROSS assertion, or any feature that changes user-visible behavior. Invoke via Skill tool BEFORE reporting handoff. Use the running Axum server (see `.factory/services.yaml`).

## Work Procedure

1. **Read the feature's preconditions, expectedBehavior, verificationSteps, and `fulfills`.** Open `.factory/library/architecture.md` and `.factory/library/user-testing.md`.
2. **Read existing components before editing** — pattern-match the project's Tailwind/TSX style and the `isTauri` transport branch convention.
3. **Red → Green TDD:**
   - Write the failing Vitest test first in the colocated `*.test.tsx` / `*.test.ts` (or in a new file).
   - `cd frontend && npm test -- --run <pattern>` confirms red.
   - Implement minimally to green.
   - Run the targeted test, then the full suite.
4. **Quality gates after each non-trivial change:**
   - `cd frontend && npm run build` (tsc + vite — this is the CI gate).
   - `cd frontend && npm test -- --run`.
   - `cd frontend && npm run lint` (oxlint, post-M1; if the feature IS the oxlint setup, this step lands within the feature).
5. **UI verification for user-visible changes:**
   - Start the Axum server per `.factory/services.yaml`: `cargo run &` at repo root (after the frontend is built). Confirm health at `http://127.0.0.1:{3000|3001}/api/health`.
   - Invoke the `agent-browser` skill. For each assertion in `fulfills` with Tool=agent-browser:
     - Open the app, drive the relevant flow, take a screenshot, capture console-errors, and confirm the behavioral pass/fail condition.
     - Each assertion verified = one `interactiveChecks` entry with the full sequence and end-to-end outcome.
   - Stop the Axum server by PID before reporting handoff (see cleanup).
6. **Drop old imports and dead code aggressively** — `import React` where unused post-React-19, unused props, stale comments. oxlint catches most; cross-check manually.
7. **For wire-contract changes (MappingDto, v2 snapshot, port 3001):** coordinate with rust-worker handoff. If the backend has already shipped the new wire and the frontend still mirrors old types, update `frontend/src/types/api.ts` + `services/tauri.ts` in lockstep and add Vitest coverage for both transports (HTTP + invoke branches).
8. **No `: any` types. No `@ts-ignore` / `@ts-expect-error` without an inline justification comment.**
9. **Cleanup before handoff:**
   - `lsof -ti :3001 | xargs kill 2>/dev/null; lsof -ti :3000 | xargs kill 2>/dev/null` — no dangling Axum server.
   - Kill any agent-browser chromium processes you spawned (the skill handles this when closed properly).
10. **Final verification:**
    - `cd frontend && npm run build && npm test -- --run && npm run lint` — all exit 0.
    - For user-visible features: ≥1 agent-browser `interactiveChecks` entry per fulfilled assertion.

## Example Handoff

```json
{
  "salientSummary": "Extracted SectionCard into components/ui/SectionCard.tsx and migrated 6 call sites (ConfigurationStep, two ResultsStep blocks, FilterBar, SummaryStats, ResultsTable). Net line delta: -142. Ran npm run build + npm test (63 → 64 passing) + npm run lint (0 warnings). Verified via agent-browser that Configure, Results, and Filter areas render identically pre/post.",
  "whatWasImplemented": "Created frontend/src/components/ui/SectionCard.tsx exposing props { title?, eyebrow?, icon?, tone?, children, className? } with Tailwind v4 tokens matching the existing card aesthetic. Replaced the inlined eyebrow-card markup in MappingConfig.tsx (1x), ConfigurationStep.tsx (1x), ResultsStep.tsx (2x — summary + table wrappers), FilterBar.tsx (1x), SummaryStats.tsx (1x), and ResultsTable.tsx header block (1x). Added Vitest test components/ui/SectionCard.test.tsx with 3 cases covering default render, icon variant, and tone variants. Updated App.file-selection-navigation.test.tsx snapshot to accommodate the extracted component.",
  "whatWasLeftUndone": "NavButton and LoadResultButton extractions were not attempted — that is the next feature in the DRY track.",
  "verification": {
    "commandsRun": [
      {"command": "cd frontend && npm test -- --run", "exitCode": 0, "observation": "Tests  64 passed (64). 2.4s."},
      {"command": "cd frontend && npm run build", "exitCode": 0, "observation": "tsc clean, vite build 254.11 kB JS in 112ms."},
      {"command": "cd frontend && npm run lint", "exitCode": 0, "observation": "oxlint: Found 0 warnings."}
    ],
    "interactiveChecks": [
      {"action": "cargo run & (frontend/dist already built); navigate to http://127.0.0.1:3001; upload samples/file_a.csv as A and samples/file_b.csv as B; advance to Configure; inspect SectionCard wrappers.", "observed": "Configure step renders with identical eyebrow/icon/title layout to pre-refactor baseline screenshot. No console errors. All chip selectors functional."},
      {"action": "Advance to Results; apply Mismatches filter; expand a diff row; take screenshots before & after refactor", "observed": "Visual parity. Filter bar, SummaryStats, ResultsTable header each render the extracted SectionCard with no layout drift. agent-browser accessibility tree shows unchanged roles/labels."}
    ]
  },
  "tests": {
    "added": [
      {
        "file": "frontend/src/components/ui/SectionCard.test.tsx",
        "cases": [
          {"name": "renders children inside a titled card", "verifies": "Basic render path with title + eyebrow + children"},
          {"name": "renders icon slot when provided", "verifies": "Optional icon prop mounts the SVG wrapper"},
          {"name": "applies tone variants correctly", "verifies": "tone='danger' applies the rose ring + icon color set"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A refactor reveals that a component's props are passed `any` values from an outdated parent type — cascading fix could exceed feature scope.
- React 19 codemod fails in an unexpected file pattern that wasn't anticipated.
- A UI test fails in agent-browser that the Vitest suite passes — could indicate missing Vitest coverage, flaky jsdom behavior, or a real browser-only bug. Report with detailed repro.
- oxlint uncovers a category of dead code large enough to warrant its own feature.
- A Vitest test cannot be written to cover a new behavior without introducing heavy mocking — consider whether behavior should be moved to a pure helper.
