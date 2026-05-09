# HTML Export App Visual Parity Plan

## Goal
Make exported HTML reports preserve the same look and feel as the in-app results experience, while reducing the chance that app and report styling drift again.

The implementation should keep the report standalone, keep browser/Tauri export delivery unchanged, and prefer shared style/presentation seams over another hand-maintained export-only theme.

## Background
- HTML export is frontend-owned: `buildResultsHtmlDocument` prepares document data and calls the template renderer (`frontend/src/features/results/htmlExport.ts:59-71`). Browser mode downloads a Blob; Tauri writes the generated HTML string (`frontend/src/services/tauri.ts:237-257`, `src-tauri/src/commands.rs:123-130`).
- The app and export already share result semantics through `buildResultRows`, `getResultFilterCounts`, and `buildSummaryOverview` (`frontend/src/features/results/htmlExport.ts:1-57`, `frontend/src/features/results/htmlExportTemplate.ts:1-66`, `frontend/src/features/results/presentation.ts:1-95`).
- The visual gap comes from duplicated rendering surfaces: app results render React components (`frontend/src/components/SummaryStats.tsx:12-120`, `frontend/src/components/ResultsTable.tsx:137-334`), while export reimplements markup, DOM scripting, and inline CSS (`frontend/src/features/results/htmlExportTemplate.ts:60-452`, `frontend/src/features/results/htmlExportTheme.ts:1-918`).
- The app styling source of truth is `frontend/src/index.css`, including theme variables, kinetic panels/cards, buttons, chips, inputs, and result table utilities (`frontend/src/index.css:1-220`). The report currently copies a separate subset in `RESULTS_EXPORT_STYLES` (`frontend/src/features/results/htmlExportTheme.ts:1-120`).
- Prior SectionCard work already showed that shared UI surfaces can regress visible parity when tone, icon, or spacing contracts are implicit (`.factory/validation/m6-frontend-dry/scrutiny/reviews/m6-section-card-extraction.json`, `.factory/validation/m6-frontend-dry/scrutiny/reviews/m6-fix-section-card-tone-and-icon-parity.json`).

## Decision
Use a shared plain-CSS semantic results surface, not React server rendering or backend HTML generation.

This keeps the exported report as one standalone HTML file with embedded CSS, JSON, and script, but makes both the app and export consume the same class/tone contract. React components keep owning in-app behavior; `htmlExportTemplate.ts` keeps owning standalone DOM behavior.

## Approach
1. **Capture the mismatch baseline only where it drives code.** Compare one representative app results state with one exported HTML report and record only actionable visual deltas.
2. **Create one shared CSS ownership boundary.** Add a plain CSS results surface such as `frontend/src/features/results/resultsSurface.css` for selectors used by both app and export. Keep app-only Tailwind/font/animation rules in `frontend/src/index.css`; keep export-only standalone/print/id rules in `frontend/src/features/results/htmlExportTheme.ts`.
3. **Move app/export toward a minimal semantic class contract.** Make these classes compatibility contract for parity tests and review: `section-card*`, `summary-*`, `filter-*`, `results-table`, `badge tone-*`, `kinetic-value-*`, `diff-*`, and `detail-*`. Other helper selectors remain implementation detail.
4. **Extend shared presentation metadata only where it removes duplication.** Keep `presentation.ts` as the semantic source for rows/summary/filter data; add filter tone metadata so `FilterBar` and export stop hard-coding separate tone switches.
5. **Preserve export runtime behavior.** Keep the existing JSON embedding, standalone filter/search/sort/expand script, browser Blob download, and Tauri save command. Only adjust markup/classes/data needed for visual parity.
6. **Propagate the current app theme through a small pure helper.** Normalize the theme in `htmlExport.ts` with a closed set (`cyan`, `lime`, `magenta`, `amber`) and a `cyan` default. The hook only reads `document.documentElement.dataset.theme` and passes the raw value into `buildResultsHtmlDocument`.

## Work Items
1. **Lock the mismatch baseline.**
   - Run the current targeted frontend tests: `htmlExport.test.ts`, `presentation.test.ts`, `SummaryStats.test.tsx`, `FilterBar.test.tsx`, `ResultsTable.test.tsx`, `useComparisonWorkflow.test.ts`, and `tauri.test.ts`.
   - Inspect one app results screen and one exported HTML report for the same fixture.
   - Record only deltas that will drive code changes. If the implementation needs an auditable artifact, use `docs/reviews/html-export-app-visual-parity-baseline-2026-05-09.md`; otherwise keep the evidence in the implementation PR/test notes.

2. **Introduce the shared CSS surface.**
   - Add `frontend/src/features/results/resultsSurface.css` as plain CSS with no Tailwind `@apply` and no runtime dependencies.
   - Seed it from the currently shared-looking kinetic/export rules, then organize it around semantic groups: base kinetic primitives, section cards, summary, filters, table, badges, details, and tones.
   - Import it from `frontend/src/index.css`; keep font imports, Tailwind setup, app-only animations, and unrelated app styles there.
   - Change `frontend/src/features/results/htmlExportTheme.ts` to raw-import `resultsSurface.css` and append only minimal export-only rules.
   - Add a `*.css?raw` declaration in `frontend/src/vite-env.d.ts` when introducing the raw import.

3. **Make shared classes explicit in app components.**
   - Add section-card semantic classes in `frontend/src/components/ui/SectionCard.tsx` while preserving props, tone behavior, and empty-body suppression.
   - Add summary semantic classes in `frontend/src/components/SummaryStats.tsx`, keeping `buildSummaryOverview` as the only summary data source.
   - Update `frontend/src/components/FilterBar.tsx` to render filter chips/dots with semantic filter tone classes while keeping export button callbacks unchanged.
   - Update `frontend/src/components/ResultsTable.tsx` to align table, badge, value-stack, sort, and detail-panel classes with the export contract while preserving React-local search/sort/expanded state.

4. **Add shared tone metadata.**
   - In `frontend/src/features/results/presentation.ts`, add a `ResultFilterTone` union and a `tone` field to `RESULT_FILTER_OPTIONS`.
   - Use existing `ResultRowViewModel.badgeTone` as the shared row badge visual key.
   - Update `frontend/src/features/results/presentation.test.ts` and any affected component tests to assert semantic tones rather than export/app-specific color classes.

5. **Align the export document and template.**
   - Extend `frontend/src/features/results/htmlExport.ts` so filter options serialize `tone`, and so `buildResultsHtmlDocument` accepts an optional raw theme value that is normalized inside this module.
   - Add `data-theme` to the generated `<html>` in `frontend/src/features/results/htmlExportTemplate.ts`.
   - Update template markup to use the same semantic class contract as the app.
   - Preserve these script hooks: `filter-row`, `results-count`, `results-search`, `table-empty-state`, `table-empty-glyph`, `table-empty-copy`, `results-table`, `results-body`, `generated-at`, `data-filter`, `data-sort-column`, and `data-expand-row`.
   - Remove duplicate style switch logic from the inline script when serialized tone data can drive the class name.

6. **Capture the active theme at export time.**
   - In `frontend/src/hooks/useWorkflowPersistenceActions.ts`, read `document.documentElement.dataset.theme` before calling `buildResultsHtmlDocument`.
   - Keep the stale-token guard, loading state, `exportResultsHtml`, and `downloadBlob` flow unchanged.
   - Do not change `frontend/src/services/tauri.ts`, `frontend/src/services/tauriCommands.ts`, `frontend/src/services/browserDownload.ts`, or `src-tauri/src/commands.rs` unless tests expose an existing transport bug.

7. **Deduplicate styles after parity is proven.**
   - Remove migrated duplicate rules from `frontend/src/index.css` and `frontend/src/features/results/htmlExportTheme.ts` only after targeted tests and the visual smoke check pass.
   - Keep export-only print/layout/id rules in `htmlExportTheme.ts` only when they do not belong in the live app.
   - Avoid inlining font binaries in this pass; preserve font-family stacks and fallbacks.

## Verification Plan
- Targeted frontend tests:
  - `cd frontend && npm test -- htmlExport.test.ts presentation.test.ts SummaryStats.test.tsx FilterBar.test.tsx ResultsTable.test.tsx useComparisonWorkflow.test.ts tauri.test.ts`
- Full frontend validation:
  - `cd frontend && npm test`
  - `cd frontend && npm run build`
- Smoke-check one exported report against the matching app results state:
  - cards, summary, filters, table, badges, details, empty states, and active theme match closely enough to be recognized as the same UI system
  - exported report remains standalone after download/save
  - filter buttons, search, sorting, and expandable details still work
- No Rust validation is required unless implementation touches shared Rust/Tauri command code; this plan intentionally avoids that surface.

## Open Questions
None blocking. If implementation discovers that the semantic CSS contract cannot close the gap without duplicating markup again, revisit React-rendered/export-specific markup as a follow-up design decision rather than mixing it into the first pass.

## Implementation Progress
- [x] Work Item 1 baseline: targeted frontend tests passed before implementation (`7` files / `74` tests); key deltas are duplicated export theme, separate filter/table/value classes, fixed cyan export theme, and existing FilterBar primary export buttons.
- [x] Work Items 2-4 shared CSS/app semantic contract: implemented by shared `resultsSurface.css`, app semantic classes, filter tone metadata, raw CSS import seam, and targeted/build validation.
- [x] Work Items 5-6 export/template/theme capture alignment.
- [x] Work Item 7 verification and cleanup: full frontend tests and production build pass after review-driven cascade fix; no remaining review must-fix issues.

## References
- `frontend/src/features/results/htmlExport.ts`
- `frontend/src/features/results/htmlExportTemplate.ts`
- `frontend/src/features/results/htmlExportTheme.ts`
- `frontend/src/features/results/presentation.ts`
- `frontend/src/index.css`
- `frontend/src/components/ui/SectionCard.tsx`
- `frontend/src/components/SummaryStats.tsx`
- `frontend/src/components/FilterBar.tsx`
- `frontend/src/components/ResultsTable.tsx`
- `frontend/src/hooks/useWorkflowPersistenceActions.ts`
- `frontend/src/features/results/htmlExport.test.ts`
- `frontend/src/features/results/presentation.test.ts`
