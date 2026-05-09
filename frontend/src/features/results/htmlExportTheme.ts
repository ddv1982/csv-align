import resultsSurfaceCss from './resultsSurface.css?raw';

const EXPORT_THEME_TOKENS = String.raw`:root,
[data-theme="dark"] {
  color-scheme: dark;
  --font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", ui-monospace, monospace;
  --font-display: var(--font-sans);

  --color-app-bg: #030712;
  --color-app-panel: #111827;
  --color-app-panel-muted: #0f172a;
  --color-app-border: rgba(55, 65, 81, 0.9);
  --color-app-border-strong: rgba(107, 114, 128, 0.95);
  --color-app-text: #f3f4f6;
  --color-app-muted: #9ca3af;
  --color-app-accent: #3b82f6;
  --color-app-highlight: #60a5fa;
  --color-app-danger: #f87171;
  --color-app-success: #34d399;
  --color-app-warning: #fbbf24;
  --color-app-header: rgba(3, 7, 18, 0.82);
  --color-app-overlay: rgba(17, 24, 39, 0.72);
  --color-app-overlay-strong: rgba(31, 41, 55, 0.78);
  --color-app-grid: transparent;

  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-success-dark: #059669;

  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-warning-dark: #d97706;

  --color-danger: #ef4444;
  --color-danger-light: #fee2e2;
  --color-danger-dark: #dc2626;

  --color-info: #3b82f6;
  --color-info-light: #dbeafe;
  --color-info-dark: #2563eb;
}`;

const EXPORT_ONLY_STYLES = String.raw`* {
  box-sizing: border-box;
  scrollbar-color: rgba(107, 114, 128, 0.72) rgba(17, 24, 39, 0.72);
}

*:focus-visible {
  outline: 2px solid var(--color-app-accent);
  outline-offset: 2px;
}

::selection {
  background: rgba(59, 130, 246, 0.32);
  color: var(--color-app-text);
}

html {
  background: var(--color-app-bg);
  font-family: var(--font-sans);
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-app-bg);
  color: var(--color-app-text);
  font-family: var(--font-sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

svg {
  display: block;
}

[hidden] {
  display: none !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.app-shell {
  min-height: 100vh;
  overflow-x: hidden;
}

.report-main {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 16px;
}

.space-y-6 > * + * {
  margin-top: 24px;
}

.card.section-card {
  padding: 20px;
  overflow: hidden;
}

.section-card-body {
  margin-top: 20px;
}

.section-card-action {
  min-width: 0;
}

.section-card-icon svg,
.summary-stat-icon svg,
.summary-banner-icon svg {
  width: 20px;
  height: 20px;
}

.summary-main,
.summary-banners {
  display: grid;
  gap: 24px;
}

.summary-banners {
  gap: 16px;
}

.summary-file-grid {
  display: grid;
  gap: 12px;
}

.summary-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.summary-match-rate-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-match-rate-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.summary-match-rate-value .display-title {
  font-size: 36px;
  font-variant-numeric: tabular-nums;
}

.search-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  pointer-events: none;
}

.input {
  width: 100%;
  min-width: 240px;
  border: 1px solid var(--color-app-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.86);
  color: var(--color-app-text);
  padding: 9px 12px 9px 36px;
  font-size: 14px;
}

.input::placeholder {
  color: var(--color-app-muted);
}

.table-wrap {
  overflow-x: auto;
  margin: 0 -20px;
}

table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
}

thead {
  background: rgba(31, 41, 55, 0.52);
  border-bottom: 1px solid var(--color-app-border);
}

th,
td {
  padding: 14px 16px;
  text-align: left;
  vertical-align: top;
}

tbody tr + tr td {
  border-top: 1px solid var(--color-app-border);
}

.sort-button {
  padding: 0;
}

.sort-glyph .active {
  color: var(--color-app-accent);
}

.empty-state,
.p-12.text-center {
  padding: 48px;
  text-align: center;
}

.status-strip {
  margin: 0 -20px -20px;
}

@media (min-width: 640px) {
  .report-main {
    padding-left: 24px;
    padding-right: 24px;
  }
}

@media (min-width: 860px) {
  .section-card-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .section-card-action {
    justify-items: end;
  }

  .summary-file-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-match-rate-head {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }
}

@media (min-width: 1024px) {
  .report-main {
    padding-left: 32px;
    padding-right: 32px;
  }

  .summary-stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .card.section-card {
    padding: 16px;
  }

  .table-wrap,
  .status-strip {
    margin-left: -16px;
    margin-right: -16px;
  }

  .status-strip {
    margin-bottom: -16px;
  }
}

@media print {
  body {
    background: #ffffff;
    color: #111827;
  }

  .report-main {
    max-width: none;
    padding: 0;
  }
}`;

export const RESULTS_EXPORT_STYLES = `${EXPORT_THEME_TOKENS}\n${resultsSurfaceCss}\n${EXPORT_ONLY_STYLES}`;
