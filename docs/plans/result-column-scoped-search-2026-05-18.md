# Result Column-Scoped Search: Plan

## Goal
Make results search more powerful by letting users search all result fields or constrain the query to a specific result column, with matching behavior in the exported standalone HTML report.

## Background
- The in-app results flow passes `state.filter`, full `state.results`, and hook-derived `filteredResults` from `frontend/src/App.tsx` into `ResultsStep`; `ResultsStep` renders `FilterBar` from full results and `ResultsTable` from already bucket-filtered results (`frontend/src/components/app/ResultsStep.tsx:85-95`).
- Result bucket filtering is separate from text search. `ResultFilter` stores bucket state (`frontend/src/types/api.ts:149-157`), workflow state initializes/resets it to `all` (`frontend/src/hooks/useComparisonWorkflow.reducer.ts:63`, `frontend/src/hooks/useComparisonWorkflow.reducer.ts:163`, `frontend/src/hooks/useComparisonWorkflow.reducer.ts:232`), and `useComparisonWorkflow` computes bucket-filtered results before the table (`frontend/src/hooks/useComparisonWorkflow.ts:150`).
- `ResultsTable` owns local text-search state. It builds row view models from already-filtered results, then calls `filterAndSortResultRows` with `filter: 'all'` and the deferred query (`frontend/src/components/ResultsTable.tsx:160-179`). The visible count and empty-state copy already account for search within the current result bucket (`frontend/src/components/ResultsTable.tsx:242-265`).
- Current search UX is a single labeled search input with placeholder `Search keys or values` and screen-reader label `Search result values` (`frontend/src/components/ResultsTable.tsx:248-258`). A prior M6 regression established that the controlled search input must update synchronously, with expensive filtering deferred (`.factory/validation/m6-frontend-dry/scrutiny/reviews/m6-fix-use-transition-input-urgency.json:1-15`).
- Search is currently broad because `ResultRowViewModel.searchText` concatenates badge label, key, File A values, File B values, duplicate values, mapped column names, and difference details (`frontend/src/features/results/presentation.ts:454-463`). `filterAndSortResultRows` normalizes the query and checks `row.searchText.includes(...)` (`frontend/src/features/results/presentation.ts:479-488`).
- The HTML export uses the same presentation data. `buildExportDocument` serializes `filterOptions`, `initialFilter`, and `rows` from `buildResultRows` (`frontend/src/features/results/htmlExport.ts:34-67`), and the standalone template initializes `state.filter`, `state.query`, sort state, and expansion from embedded JSON (`frontend/src/features/results/htmlExportTemplate.ts:234-246`).
- Exported HTML currently mirrors the same broad search using `row.searchText.includes(normalizedQuery)` in `getVisibleRows` (`frontend/src/features/results/htmlExportTemplate.ts:356-365`), with its own search input and count/empty-state updates (`frontend/src/features/results/htmlExportTemplate.ts:186-213`, `frontend/src/features/results/htmlExportTemplate.ts:409-425`, `frontend/src/features/results/htmlExportTemplate.ts:455-460`).
- Existing parity expectations matter: `docs/plans/html-export-app-visual-parity-2026-05-09.md:22-27` chose shared semantic result-surface behavior rather than a separate backend-rendered report, and current HTML export tests assert standalone filter/search/sort/detail seams (`frontend/src/features/results/htmlExport.test.ts:58-141`, `frontend/src/features/results/htmlExport.test.ts:320-386`).
- UX references support keeping a global quick search while exposing scoped filtering: MUI X documents quick filter as a row-data search with accessible labels/clear controls, AG Grid distinguishes column filters from quick filters and combines them conjunctively, MUI export defaults align with visible columns plus filtered/sorted rows, and WAI-ARIA cautions against adopting full grid roles unless the table is truly an interactive grid.

## Approach
Make the advanced version the primary UX: replace the fixed short scope dropdown with a compact **Search field combobox** paired with the existing query input. The combobox lets users choose **All fields**, high-level result scopes, or a specific mapped/source column without taking more horizontal space than a normal dropdown. This better matches the user goal: more powerful column-specific search, compact desktop layout, and mobile-friendly interaction.

The combobox is still a single active field selector, not a second text search or a full advanced-filter builder. Its typed input filters the list of searchable fields; the adjacent search box filters result rows within the selected field. Bucket filter, selected field, query, and sort combine as: active result bucket **AND** selected field/query match **AND** current sort. Sorting, bucket counts, export actions, and row expansion remain conceptually unchanged.

Represent searchable fields in the shared presentation layer so the React table and standalone HTML export consume the same scope metadata. Extend `ResultRowViewModel` with normalized text keyed by stable field IDs while keeping `searchText` as the all-fields compatibility alias. `filterAndSortResultRows` should accept an optional search field ID that defaults to `all`, preserving current broad search for existing call sites and tests.

Keep search query and selected field as local table/export UI state for this implementation. The exported HTML should include the same compact combobox + query behavior, but initialize to `initialFilter` as today, empty query, and **All fields** selected. Do not lift query/field into workflow state just to preserve the current table search at export time; users can reproduce scoped searches inside the standalone report.

### Decision update — 2026-05-19

The final implementation intentionally narrowed the picker to five general fields only: **All fields**, **Type**, **Key**, **File A values**, and **File B values**. Dynamic mapped/source-column fields, the separate **Details** scope, and picker-internal typeahead were removed after UX review because the fixed list is compact enough for desktop and mobile without an advanced combobox. Details text remains searchable through **All fields** for compatibility, while File A/File B scopes search only their side's visible and duplicate values.

### UX details
- Keep the feature lightweight: present this as choosing the field to search, not as “scoped search” or “advanced filters.”
- Default to **All fields** so the current simple behavior remains the normal path.
- Use one compact combobox-style field picker paired with the existing search input; do not add multi-select, chips, rule builders, separate apply/reset buttons, or a dedicated advanced panel.
- Closed state should look like a small scope pill/control that displays only the selected scope, for example `All fields ▾`, `Key ▾`, or `Email ↔ email_address ▾`. Do not render a persistent visible `Search in` label; keep that context in the control's accessible name and nearby search placeholder instead.
- Open state should provide typeahead filtering over searchable fields. This is where combobox earns its keep if the option list includes actual source/mapped columns; if only the General fields are available, the control should still feel like a small dropdown and not advertise itself as advanced.
- Desktop: keep combobox and search input visually grouped in the results table header/action area.
- Narrow/mobile: keep the same compact pair, stacking only when needed. The combobox remains compact because users can type a few letters instead of scrolling through many source columns.
- Combobox accessible label: `Search field`; this should be available to assistive technology without adding visible label text to the compact layout.
- Search input accessible label: `Search comparison results`.
- Query placeholder should change with selected field:
  - All fields: `Search all result fields`
  - Type: `Search result types`
  - Key: `Search keys`
  - File A values: `Search File A values`
  - File B values: `Search File B values`
  - Details: `Search details`
  - Source/mapped column: `Search <column label>`
- Combobox option grouping should be stable:
  - `General`: All fields, Type, Key, File A values, File B values, Details
  - `Mapped columns`: mapping pairs shown with their app labels, when mappings are available
  - `File A columns`: source columns from File A, when searchable
  - `File B columns`: source columns from File B, when searchable
- On query or selected field change, collapse any expanded row in both app and export so visible details do not linger after the visible row set changes.
- Preserve existing empty-state distinction: no rows in the bucket remains `No results match the selected filter`; query/field excluding available rows remains `No results match the current filter and search.`

### Search field mapping contract
- **All fields:** Concatenate all searchable text. This remains equivalent to today’s broad search.
- **Type:** Include the user-facing badge label, raw API result type, and bucket alias. Duplicate variants should be searchable via both their raw duplicate result type and the aggregate `duplicate` bucket.
- **Key:** Include joined key parts only.
- **File A values:** Include File A collapsed values and File A duplicate values. Do not duplicate these values into Details except through All fields.
- **File B values:** Include File B collapsed values and File B duplicate values. Do not duplicate these values into Details except through All fields.
- **Details:** Include all non-Type/Key/FileA/FileB explanatory result text: visible details-column description, difference/inspection column labels, mapped field labels when they explain a difference, panel labels, and expanded-detail values. This field intentionally covers text a user would inspect through the Details column or expanded detail panel, even if some of it is not visible until expansion.
- **Mapped column fields:** Match row text associated with that mapping pair. For mismatch details, include the values and labels for the mapped pair. For match/missing/duplicate rows, include the corresponding visible File A/File B values when the selected mapped column participates in those displayed values.
- **File A source column fields:** Match File A values for that source column where the result row carries or can derive a value for that column.
- **File B source column fields:** Match File B values for that source column where the result row carries or can derive a value for that column.

If raw result rows do not contain enough per-column value attribution for every source column, implement high-level fields first and expose only mapped/source column fields that can be matched accurately from existing `ResultResponse`, `mappings`, and `comparisonColumnsA/B`. Do not show a source-column option that would silently fall back to all File A/File B text.

For unknown or malformed field IDs in exported data, the report should normalize the active field back to `all`, keep the combobox on **All fields**, and continue using the broad `row.searchText` fallback. This is a compatibility guard, not a new user-facing state.

## Work Items

### Item 1 — Shared searchable-field model
**Goal:** Define searchable field IDs/options once in `presentation.ts` and make row view models carry normalized text per searchable field.

**Done when:** `ResultRowViewModel` exposes field-specific text; `searchText` still equals the all-fields text; `filterAndSortResultRows` accepts an optional field ID and defaults to `all`; the General and accurately-attributable mapped/source field boundaries above are covered by focused tests; existing broad-search behavior still passes unchanged.

**Key files:** `frontend/src/features/results/presentation.ts:454-488`, `frontend/src/features/results/presentation.test.ts`.

**Dependencies:** None.

**Size:** Medium.

### Item 2 — In-app advanced field-picker UX
**Goal:** Add a compact searchable field combobox to the in-app results table without changing workflow-level bucket filtering.

**Done when:** `ResultsTable` renders an accessible combobox-style field picker paired with the search input; the closed picker displays only the selected scope label, not a persistent visible `Search in` label; the picker filters its option list by typed field text; placeholder text follows the selected field; row filtering uses the selected field; query input updates remain synchronous; expanded rows collapse on query or field change; app-side styling uses semantic result-surface classes that can also be used by the export.

**Key files:** `frontend/src/components/ResultsTable.tsx:160-265`, `frontend/src/components/ResultsTable.test.tsx`, `frontend/src/features/results/resultsSurface.css`.

**Dependencies:** Item 1.

**Size:** Medium.

### Item 3 — Standalone HTML export parity
**Goal:** Give exported reports the same compact field-picker and matching behavior as the in-app table while keeping reports fully standalone.

**Done when:** The export document serializes searchable-field metadata needed by the template; rows include field-specific search text from the shared presentation layer; the template renders a `results-search-field` combobox/control without churning existing stable hooks (`results-search`, `filter-row`, `data-filter`, `data-sort-column`, `data-expand-row`); standalone filtering uses the selected field text with `row.searchText` fallback; unknown fields normalize to `all`; field changes reset expansion and rerender counts/empty states.

**Key files:** `frontend/src/features/results/htmlExport.ts:34-67`, `frontend/src/features/results/htmlExportTemplate.ts:186-246`, `frontend/src/features/results/htmlExportTemplate.ts:356-365`, `frontend/src/features/results/htmlExportTemplate.ts:409-460`, `frontend/src/features/results/htmlExport.test.ts`, `frontend/src/features/results/resultsSurface.css`.

**Dependencies:** Items 1 and 2.

**Size:** Medium.

### Item 4 — Verification and parity pass
**Goal:** Lock behavior with targeted app, presentation, and export tests before running standard frontend validation.

**Done when:** Tests prove all-fields search remains unchanged, field-scoped searches include/exclude the intended text, field/query combines with bucket filters, the combobox and query input have accessible labels/keyboard behavior, the controlled query input remains responsive, export serialization/runtime field switching works, unknown export field IDs fall back to all-fields, and existing sort/expand/escaping behavior remains intact.

**Key files:** `frontend/src/features/results/presentation.test.ts`, `frontend/src/components/ResultsTable.test.tsx`, `frontend/src/features/results/htmlExport.test.ts`.

**Dependencies:** Items 1–3.

**Size:** Small.

## Verification
- Targeted tests: run the equivalent frontend test filters for `presentation.test.ts`, `ResultsTable.test.tsx`, and `htmlExport.test.ts`.
- Broader frontend confidence: `cd frontend && npm test` and `cd frontend && npm run build`.
- Manual smoke if available: compare in-app table and exported HTML on the same result set for `All fields`, `Key`, `File A values`, `File B values`, `Details`, and at least one accurately-attributable mapped/source column; confirm counts, empty states, sorting, field-picker behavior, and expansion behave consistently.

## Open Questions
None blocking. The plan intentionally chooses a compact single active searchable field rather than multi-select scopes or an advanced filter builder. The user-facing concept should be “which field am I searching?” rather than “scoped search.” A combobox is justified only because mapped/source column options can grow beyond a short fixed list; if the available choices remain limited to General fields, it should behave visually like a simple compact dropdown. The plan intentionally does not preserve in-app query/field in exported reports for the first implementation.

## References
- `frontend/src/components/ResultsTable.tsx`
- `frontend/src/features/results/presentation.ts`
- `frontend/src/features/results/htmlExport.ts`
- `frontend/src/features/results/htmlExportTemplate.ts`
- `frontend/src/features/results/htmlExport.test.ts`
- `frontend/src/features/results/resultsSurface.css`
- `docs/plans/html-export-app-visual-parity-2026-05-09.md`
- `docs/reviews/result-column-scoped-search-plan-critique-2026-05-18.md`
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- https://learn.microsoft.com/en-us/windows/apps/design/controls/combo-box
- https://mui.com/x/react-data-grid/components/quick-filter/
- https://mui.com/x/react-data-grid/export/
- https://www.ag-grid.com/javascript-data-grid/filtering/
- https://www.w3.org/WAI/ARIA/apg/patterns/grid/
