# Professional UI refinement

## Assessment and direction

CSV Align already has a sensible dark slate/blue palette and a clear three-step workflow. Its professional polish is limited by competing nested panels, decorative glass and gradients, wrapping progress geometry, inconsistent form styling, and a tall results summary. Small uppercase status and table labels make detailed review harder than necessary.

Refine it as a quiet data workbench: restrained opaque surfaces, deliberate heading hierarchy, consistent controls, compact responsive navigation, and readable result rows. Preserve dark-only styling and all existing workflows, transports and exports. No new product features, UI libraries or release changes.

## Research applied

Research used Exa cross-source discovery and Ref documentation retrieval on 2026-10-12. Suggestions for new reconciliation features and a cream/orange palette were discarded because they do not describe this app or the authorized scope.

- [Carbon data tables](https://carbondesignsystem.com/components/data-table/usage/): coordinate table/toolbar density and use restrained row differentiation to support scanning. Ref retrieved the sizing and alternating-row guidance.
- [NN/g: Data Tables, Four Major User Tasks](https://www.nngroup.com/articles/data-tables/): prioritize finding records and comparing information, keeping actions from competing with data.
- [Carbon progress indicators](https://carbondesignsystem.com/components/progress-indicator/usage/): clearly distinguish current, completed and future steps in a linear workflow.
- [Carbon file upload](https://v10.carbondesignsystem.com/components/file-uploader/usage/): retain explicit upload controls and clear file validation alongside drag/drop.
- [Fluent accessibility](https://fluent2.microsoft.design/accessibility): predictable keyboard navigation and visible focus.
- [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), and [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): readable text, status labels as well as colors, and reflowing surrounding controls. This work does not claim a full accessibility conformance audit.
- [Tailwind interaction and media states](https://tailwindcss.com/docs/hover-focus-and-other-states): Ref confirmed focus-visible, disabled, responsive and reduced-motion styling mechanisms.

## Verified delivery checklist

- [x] Record equivalent desktop/mobile baseline views and confirm the current styling problems in the running app.
- [x] Refine shared surfaces, controls and workflow shell/intake/configuration; verify responsive layout and existing behavior.
- [x] Refine summary/results readability and standalone HTML export styling; verify retained information and interactions.
- [x] Run final frontend gate, exercise browser workflows/states at desktop/mobile widths, inspect screenshots, and prepare independent Flow review evidence.
- [x] Resolve professional-ui.R27-01 by exposing byte-identical visual evidence within the reviewer's workspace boundary.
- [x] Resolve professional-ui.R34-01 by constraining file overview cards and proving filename/card/expanded-inspection containment at 320px and 390px.

## Validation

Canonical gate, selected from AGENTS.md and CI for frontend changes:

```sh
npm --prefix frontend test && npm --prefix frontend run lint && npm --prefix frontend run build
```

Use temporary Playwright in `/tmp/opencode`, not a project dependency. Capture views at 1440 and 390 CSS pixels and check 320px reflow. Exercise real CSV intake/configuration/comparison, search/filter/sort/details, saved snapshots and the independently opened HTML export. Check long content, focus, disabled controls, reduced motion and affected empty/error/loading states. Record visual evidence and check output below. Browser checks do not establish native Tauri rendering.

## Evidence

Baseline: `node /tmp/opencode/ui-check.mjs baseline` exercised real sample uploads, row-key/column selection and comparison, captured all three steps at 1440/390px, and reported no page errors or mobile page overflow. Screenshots are in `/tmp/opencode/ui-baseline/`. Inspection confirmed the wrapping mobile stepper, repeated framing, small table labels and tall summary. The first attempt used an incorrect manual-advance assumption; it was corrected and the identical command passed. Final capture waits for entry animation to settle.

Foundation batch: `node /tmp/opencode/ui-check.mjs foundation` passed real intake/configuration/comparison and reported zero page errors and 390px scroll width at 390px viewport. Screenshots in `/tmp/opencode/ui-foundation/` were inspected for desktop/mobile hierarchy and configuration controls. The frontend gate passed: 236 tests, one existing opt-in measurement skipped, lint clean and production build successful. Four obsolete presentation assertions were aligned with the approved opaque header and responsive stepper; navigation behavior assertions remain intact.

Results batch: `node /tmp/opencode/ui-check.mjs final` passed real search/filter/sort/detail actions, independent HTML export, saved snapshot/read-only restoration, long filenames/values and duplicate/unkeyed cases. Desktop sample summary height: 316px. All six captured workflow states passed the original 320px document-width checks, but review found those checks insufficient: overflow hiding masked long-filename overview clipping. Keyboard focus was visibly outlined, reduced-motion loading animation was disabled, invalid file feedback and disabled comparison controls remained usable, and no page errors occurred. Screenshots in `/tmp/opencode/ui-final/` were inspected. Initial QA attempts were corrected for the actual empty-state text, React sort completion and asynchronous session creation after reset. No lifecycle code changed.

Visual inspection also found that standalone mobile export cells lacked source labels. A browser regression check failed with zero labeled cells before the repair; the template now emits five labels matching the app, and the export interaction test checks the rendered labels. Regenerated export passed the same five-label browser check, and the corrected mobile screenshot was inspected. Independent review is a required Flow lifecycle gate after this checklist's evidence preparation, recorded in the Flow session rather than pre-claimed here.

Previous gate passed with 236 tests, one existing opt-in measurement skipped, lint clean and production build successful. Browser QA reported zero page errors. Diff checks found no deletions, renames or executable-mode changes; only frontend source/tests and this plan changed. Review packet includes `/tmp/opencode/ui-baseline/`, `/tmp/opencode/ui-final/`, the generated report and the exact check commands. professional-ui.R34-01 requires corrected containment verification before completion.

Review retry: `professional-ui.R27-01` identified that workspace-only review cannot read `/tmp/opencode`. Preserve the original captures and expose exact copies under `frontend/node_modules/.cache/ui-review-evidence/`, an existing ignored workspace cache surface. Verify each copy with SHA-256 and provide the QA script and standalone report alongside the screenshots. This changes evidence accessibility only, with no product-code changes or new dependency.

`node /tmp/opencode/copy-ui-evidence.mjs` verified byte-identical copies of six baseline images, eighteen final images, the generated HTML and snapshot, plus the QA script. The retry packet uses workspace paths and the copy-validation hashes, preserving their binding to the original browser run.

Authorized containment retry: the new element-bound check failed before the repair, showing a long-filename card right edge of 1260.58px in a 390px viewport. `ConfigurationStep.tsx` now uses an explicit shrinkable single-column grid, shrinkable overview cards and a flexible filename area; the full filename remains available in its title. The same check passed after repair: cards occupy x=36..354 at 390px and x=36..284 at 320px, with filename bounds inside each card. Expanded column inspection was exercised and its controls/chips stayed contained. The new 320px screenshot also exposed a native-width text input overflowing its fieldset. A form-bound check failed before adding `max-width: 100%` to shared inputs, then passed with the complete browser workflow.

Fresh 390px and 320px configuration screenshots were inspected, including `long-configure-mobile.png` and `long-configure-320.png`. The successful live QA and copy command is `node /tmp/opencode/ui-check.mjs final && node /tmp/opencode/copy-ui-evidence.mjs`; it now exposes twenty final images in the workspace cache, including both new 320px configuration views. All checklist items are checked. Final gate and independent Flow review determine completion; the former document-width checks alone are not claimed as containment proof.
