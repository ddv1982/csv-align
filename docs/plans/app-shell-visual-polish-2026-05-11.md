# App Shell Visual Polish Plan

## Goal
Improve the CSV Align app shell so desktop startup feels less cramped, the header stays pinned with a more polished translucent glass treatment, and the progress-step labels use normal app typography instead of the current HUD/monospace feel.

Keep the work frontend-first and behavior-preserving: no CSV comparison workflow, transport contract, backend API, persistence, or data-model changes are expected.

## Background
- The React shell composes the sticky header, progress navigation, and active step body in `frontend/src/App.tsx:39-91`.
- `AppHeader` is already sticky and translucent-ish via `sticky top-0`, `bg-gray-950/80`, and `backdrop-blur-sm`, but its styling is hard-coded to gray Tailwind classes instead of the app theme/glass surface contract (`frontend/src/components/app/AppHeader.tsx:20-65`).
- `ProgressSteps` owns `Choose Files`, `Configure`, and `Results`; the number badge uses `font-mono`, and step metadata uses `.hud-label`, whose CSS is uppercase and letter-spaced (`frontend/src/components/app/ProgressSteps.tsx:3-49`, `frontend/src/features/results/resultsSurface.css:64-70`).
- The desktop main window and Tauri-created new windows both start at height `800` (`src-tauri/tauri.conf.json:13-22`, `frontend/src/services/appWindows.ts:4-15`). Browser `window.open` does not control viewport size and should stay unchanged (`frontend/src/services/appWindows.ts:24-28`).
- The app shell is document-height driven, so vertical scrollbars come from stacked content exceeding the viewport rather than an internal scroll container (`frontend/src/App.tsx:39-43`, `frontend/src/index.css:65-69`, `frontend/src/features/results/resultsSurface.css:81-87`).

## Approach
Make a narrow shell polish pass with three coordinated changes:

1. **Use one taller Tauri window target.** Increase the initial Tauri window and Tauri-created new windows from `800` to `880` height. Success means the desktop startup view feels less cramped and has reduced scroll pressure; it does not require eliminating vertical scrolling in every step or on every display. Leave width, centering, resizability, and browser `window.open` behavior unchanged.
2. **Move the header look into semantic CSS.** Add a token-based glass header class in the existing `resultsSurface.css` app-shell CSS bucket, then update `AppHeader` to use it while preserving `sticky top-0 z-30`, content structure, logo, actions, and error alert behavior. Prefer sticky over `position: fixed`; sticky already satisfies “stays on top” without introducing content-offset or overlap risk.
3. **Normalize progress-step typography locally.** Update `ProgressSteps` so the visible labels, `Step N` metadata, and number badges use normal app-font treatment rather than HUD typography. Do not change `.hud-label` globally, because other surfaces still use it intentionally. Preserve step data, navigation gating, `aria-current`, disabled state, stable `min-w-[11rem]`, and existing `app-surface-*` state classes.

## Work Items
1. **Apply consistent Tauri window sizing.**
   - Update `src-tauri/tauri.conf.json:13-22` from height `800` to `880`.
   - In `frontend/src/services/appWindows.ts:4-15`, introduce local `APP_WINDOW_WIDTH = 1200` and `APP_WINDOW_HEIGHT = 880` constants or otherwise remove the duplicate magic height.
   - Keep the browser fallback at `frontend/src/services/appWindows.ts:24-28` unchanged.
   - Update `frontend/src/services/appWindows.test.ts` to assert the Tauri `height` stays `880`.

2. **Add the glass header surface.**
   - Add an `.app-header-glass` class in `frontend/src/features/results/resultsSurface.css` near the other app-shell/surface primitives; despite the path name, this file already owns shared shell classes such as `.app-shell`, `.card`, and `.btn`.
   - Build it from existing theme tokens such as `--color-app-header`, `--color-app-border`, `--color-app-border-strong`, and `--color-app-overlay` (`frontend/src/index.css:7-28`).
   - Required traits: tokenized translucent background, `backdrop-filter` blur/saturation, and subtle bottom border. Shadow or inset highlight can be tuned during smoke testing but should not become a separate redesign.
   - Keep the visual treatment self-contained; do not redesign buttons, layout, logo framing, or action behavior in this pass.

3. **Wire the header to the semantic class.**
   - Replace the hard-coded header classes in `frontend/src/components/app/AppHeader.tsx:20` with `app-header-glass sticky top-0 z-30`.
   - Update `frontend/src/components/app/AppHeader.test.tsx` to assert sticky/top/z-index and `app-header-glass` instead of legacy gray implementation classes.

4. **Adjust progress-step typography.**
   - In `frontend/src/components/app/ProgressSteps.tsx:17-49`, remove `font-mono`, oversized tracking, and uppercase-style treatment from the number badge.
   - Replace `.hud-label` usage for `Step 1/2/3` metadata with visually secondary normal app text classes.
   - Replace uppercase/tracked styling on `Choose Files`, `Configure`, and `Results` with normal app font classes, while leaving the text labels unchanged.
   - Update `frontend/src/components/app/ProgressSteps.test.tsx` to guard the non-HUD typography without over-specifying exact pixels or colors.

5. **Validate the shell polish.**
   - Run focused tests first: `cd frontend && npm test -- AppHeader.test.tsx ProgressSteps.test.tsx appWindows.test.ts`.
   - Run frontend build validation: `cd frontend && npm run build`.
   - Require a desktop smoke check before completion, because frontend tests do not prove `src-tauri/tauri.conf.json` changed the initial window: launch the desktop app and confirm the startup window is taller, the header remains sticky with a translucent glass feel, progress labels read as normal app typography, and the initial file-selection view has reduced scroll pressure.
   - Treat `cd frontend && npm test` as optional broader confidence after the focused tests and build pass.

## Open Questions
None blocking. If visual smoke testing shows `880` is still too cramped or too tall, adjust the height within the same implementation pass and keep the Tauri config and `appWindows.ts` values in sync.

## References
- `frontend/src/App.tsx`
- `frontend/src/components/app/AppHeader.tsx`
- `frontend/src/components/app/AppHeader.test.tsx`
- `frontend/src/components/app/ProgressSteps.tsx`
- `frontend/src/components/app/ProgressSteps.test.tsx`
- `frontend/src/features/results/resultsSurface.css`
- `frontend/src/index.css`
- `frontend/src/services/appWindows.ts`
- `frontend/src/services/appWindows.test.ts`
- `src-tauri/tauri.conf.json`
