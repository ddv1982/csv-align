# Result Column-Scoped Search Plan Critique

## Context/Scope
Critique of `docs/plans/result-column-scoped-search-2026-05-18.md` against the original context-builder export `prompt-exports/oracle-plan-2026-05-18-230019-scoped-result-search-5dfa.md`. Scope is limited to implementer ambiguity, plan/export drift, contradictions/dependencies, over-planning, and ordering questions.

## Findings

### 1) Top 3 under-specified seams
1. **Details scope boundary is still guessy.** The plan says Details includes “Row description, diff/inspection column labels, panel labels, and detail values” (`docs/plans/result-column-scoped-search-2026-05-18.md:74`), but implementers still have to decide whether duplicated row values, mapped field labels, hidden/expanded-only content, and visible table “Details” summary text each belong there or in File A/B/All only.
2. **Type scope token contract is unclear.** Type includes “Badge label, stable result type token, and filter bucket” (`docs/plans/result-column-scoped-search-2026-05-18.md:70`), but does not name the stable tokens or whether bucket aliases should match user-facing filter chips, raw API result types, or both.
3. **Export compatibility fallback is specified mechanically but not semantically.** The plan requires `row.searchTextByScope[state.searchScope]` with `row.searchText` fallback (`docs/plans/result-column-scoped-search-2026-05-18.md:106`), but does not say how malformed/unknown scopes from embedded data should affect select state, empty states, or tests.

### 2) Specificity balance
- **Over-specific tactical choice:** The plan mandates native select placement in `SectionCard` action area and exact class ownership (`docs/plans/result-column-scoped-search-2026-05-18.md:39-40`, `92-98`). That may be too tactical; the implementation agent can choose markup/classes while preserving shared semantic styling and app/export parity.
- **Useful framing preserved:** It correctly keeps the export initialized to empty query + `All fields` instead of lifting transient app table state (`docs/plans/result-column-scoped-search-2026-05-18.md:45-48`), matching the export’s warning that preserving query/scope would require broader state plumbing (`prompt-exports/oracle-plan-2026-05-18-230019-scoped-result-search-5dfa.md:67-69`).
- **Dropped useful framing:** The export explicitly lists hooks that should remain stable (`results-search`, `filter-row`, `data-filter`, `data-sort-column`, `data-expand-row`) (`prompt-exports/oracle-plan-2026-05-18-230019-scoped-result-search-5dfa.md:257-264`). The final plan only names the new `results-search-scope` hook, so an implementer might accidentally churn existing test/standalone hooks.

### 3) Contradictions or missing dependencies
- **Item 3 dependency is awkward.** Styling depends on markup from Item 2 and is consumed by Item 4 (`docs/plans/result-column-scoped-search-2026-05-18.md:92-100`), but Item 2’s “done when” already includes rendering controls. If tests assert layout/classes in Item 2, Item 3 is not really independent; combine or make Item 2 depend on Item 3’s class contract.
- **Verification command may be brittle.** `npm test -- presentation.test.ts ResultsTable.test.tsx htmlExport.test.ts` (`docs/plans/result-column-scoped-search-2026-05-18.md:116`) assumes the test runner accepts those positional filters. If not already proven, specify “target equivalent test filters” rather than a strict command.

### 4) Risk of over-planning
- The Background is useful but long; implementation does not need all validation/reference bullets once the scope decision is made. Cut or collapse the UX reference paragraph and prior validation detail (`docs/plans/result-column-scoped-search-2026-05-18.md:14-19`).
- Item 5’s done-when list is broad enough to become a mini test plan (`docs/plans/result-column-scoped-search-2026-05-18.md:110`). Keep only behavior-critical assertions and let the implementer map them to existing tests.

### 5) Questions that would change implementation order
1. Should shared hook/class stability for existing export tests be treated as a prerequisite before touching export markup? If yes, add it to Item 4 before template edits.
2. Should `Details` include only expanded-detail searchable text, or all non-Type/Key/FileA/FileB visible/detail text? This changes Item 1 tests before UI work.
3. Are scope options part of serialized export data or can the template own static options? This changes whether `htmlExport.ts` must be edited before `htmlExportTemplate.ts`.

## Recommendations
Keep the plan, but tighten the three semantic contracts above and simplify Item 3/5. No scope expansion is needed.
