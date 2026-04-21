export const RESULTS_EXPORT_STYLES = String.raw`:root {
  color-scheme: dark;
  --font-sans: "Space Grotesk", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", monospace;
  --font-display: "Bebas Neue", Impact, sans-serif;
  --color-kinetic-bg: #050505;
  --color-kinetic-panel: #090909;
  --color-kinetic-panel-2: #111111;
  --color-kinetic-line: rgba(151, 177, 204, 0.18);
  --color-kinetic-line-strong: rgba(198, 220, 242, 0.36);
  --color-kinetic-copy: #f5f7fb;
  --color-kinetic-muted: #95a2b3;
  --color-kinetic-accent: #06b6d4;
  --color-kinetic-accent-2: #bef264;
  --color-kinetic-danger: #ff7a7a;
  --color-kinetic-success: #6cffbe;
  --color-kinetic-warning: #ffb86e;
  --color-kinetic-overlay: rgba(19, 22, 26, 0.92);
  --color-kinetic-overlay-strong: rgba(26, 31, 36, 0.96);
  --color-kinetic-grid: rgba(245, 247, 251, 0.18);
}

* {
  box-sizing: border-box;
  scrollbar-color: rgba(6, 182, 212, 0.45) var(--color-kinetic-overlay);
}

*:focus-visible {
  outline: 1px solid var(--color-kinetic-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.32);
}

::selection {
  background: rgba(6, 182, 212, 0.22);
  color: var(--color-kinetic-copy);
}

html {
  background: var(--color-kinetic-bg);
  font-family: var(--font-sans);
}

body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top, rgba(190, 242, 100, 0.07), transparent 34%),
    linear-gradient(180deg, rgba(6, 182, 212, 0.06), transparent 24%),
    var(--color-kinetic-bg);
  color: var(--color-kinetic-copy);
}

button,
input {
  border-radius: 0;
}

.kinetic-shell {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
}

.kinetic-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(245, 247, 251, 0.04);
  opacity: 0.14;
}

.shell {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
  padding: 24px;
}

.stack {
  display: grid;
  gap: 24px;
}

.kinetic-copy {
  color: var(--color-kinetic-copy);
}

.kinetic-muted {
  color: var(--color-kinetic-muted);
}

.hud-label,
.kinetic-mono-label,
.kinetic-table-head,
.status-strip,
.table-chip,
.btn,
.badge,
.chip,
.sort-button,
.filter-button,
.diff-toggle {
  font-family: var(--font-mono);
}

.hud-label {
  margin: 0;
  letter-spacing: 0.22em;
  font-size: 10px;
  text-transform: uppercase;
  color: var(--color-kinetic-muted);
}

.display-title {
  font-family: var(--font-display);
  letter-spacing: 0.08em;
  line-height: 0.92;
  text-transform: uppercase;
}

.kinetic-panel,
.card {
  position: relative;
  background: linear-gradient(180deg, rgba(17, 17, 17, 0.94) 0%, rgba(9, 9, 9, 0.98) 100%);
  border: 1px solid var(--color-kinetic-line);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
}

.kinetic-panel::after,
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-top: 1px solid rgba(245, 247, 251, 0.1);
  border-left: 1px solid rgba(245, 247, 251, 0.04);
}

.card {
  padding: 20px;
  overflow: hidden;
}

.section-card-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.section-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border: 1px solid transparent;
  letter-spacing: 0.18em;
  font-size: 11px;
  text-transform: uppercase;
}

.section-card-copy h1,
.section-card-copy h2,
.section-card-copy h3,
.section-card-copy p {
  margin: 0;
}

.section-card-copy h1,
.section-card-copy h2,
.section-card-copy h3 {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.section-card-copy p + p {
  margin-top: 4px;
}

.section-card-body {
  margin-top: 20px;
  display: grid;
  gap: 24px;
}

.section-card-action {
  display: grid;
  gap: 12px;
}

.kinetic-tone-accent-strong {
  border-color: rgba(6, 182, 212, 0.4);
  background: rgba(6, 182, 212, 0.08);
  color: var(--color-kinetic-accent);
}

.kinetic-tone-highlight-strong {
  border-color: rgba(190, 242, 100, 0.4);
  background: rgba(190, 242, 100, 0.08);
  color: var(--color-kinetic-accent-2);
}

.kinetic-tone-success {
  border-color: rgba(108, 255, 190, 0.35);
  background: rgba(108, 255, 190, 0.05);
}

.kinetic-tone-success-strong {
  border-color: rgba(108, 255, 190, 0.4);
  background: rgba(108, 255, 190, 0.08);
  color: var(--color-kinetic-success);
}

.kinetic-tone-warning {
  border-color: rgba(255, 184, 110, 0.35);
  background: rgba(255, 184, 110, 0.05);
}

.kinetic-tone-warning-strong {
  border-color: rgba(255, 184, 110, 0.4);
  background: rgba(255, 184, 110, 0.08);
  color: var(--color-kinetic-warning);
}

.kinetic-tone-accent {
  border-color: rgba(6, 182, 212, 0.35);
  background: rgba(6, 182, 212, 0.05);
}

.kinetic-tone-danger {
  border-color: rgba(255, 122, 122, 0.35);
  background: rgba(255, 122, 122, 0.05);
}

.kinetic-tone-danger-strong {
  border-color: rgba(255, 122, 122, 0.4);
  background: rgba(255, 122, 122, 0.08);
  color: var(--color-kinetic-danger);
}

.kinetic-surface-subtle {
  background: var(--color-kinetic-overlay);
}

.kinetic-surface-hover:hover td {
  background: var(--color-kinetic-overlay);
}

.kinetic-surface-accent-strong {
  background: rgba(6, 182, 212, 0.1);
}

.kinetic-surface-danger {
  border-color: rgba(255, 122, 122, 0.4);
  background: rgba(255, 122, 122, 0.06);
}

.kinetic-surface-success-muted {
  border-color: rgba(108, 255, 190, 0.4);
  background: rgba(108, 255, 190, 0.06);
}

.kinetic-glyph-box {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.kinetic-frame {
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
}

.kinetic-progress-fill {
  height: 100%;
  background: var(--color-kinetic-accent);
}

.summary-file-grid {
  display: grid;
  gap: 12px;
}

.summary-file-panel {
  padding: 12px 16px;
}

.summary-file-panel .file-name {
  margin-top: 4px;
  max-width: 280px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-main {
  display: grid;
  gap: 24px;
}

.summary-match-rate {
  padding: 20px;
}

.summary-match-rate-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-match-rate-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.summary-match-rate-value .display-title {
  font-size: clamp(2.5rem, 6vw, 4rem);
}

.summary-progress {
  margin-top: 16px;
  height: 12px;
  overflow: hidden;
}

.summary-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.summary-stat {
  padding: 16px;
}

.summary-stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.summary-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid transparent;
  letter-spacing: 0.18em;
  font-size: 11px;
  text-transform: uppercase;
}

.summary-stat-value {
  font-size: 30px;
  font-weight: 700;
}

.summary-stat-label,
.summary-banner-title,
.summary-banner-summary {
  margin: 0;
}

.summary-stat-description,
.summary-banner-detail {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

.summary-banners {
  display: grid;
  gap: 16px;
}

.summary-banner {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.summary-banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border: 1px solid transparent;
  letter-spacing: 0.18em;
  font-size: 11px;
  text-transform: uppercase;
}

.summary-banner-copy {
  min-width: 0;
}

.summary-banner-summary {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  color: var(--color-kinetic-muted);
  padding: 7px 14px;
  letter-spacing: 0.04em;
  font-size: 13px;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
  cursor: pointer;
}

.filter-button:hover {
  border-color: var(--color-kinetic-line-strong);
  color: var(--color-kinetic-copy);
}

.filter-button.active {
  border-color: var(--color-kinetic-accent);
  background: rgba(6, 182, 212, 0.1);
  color: var(--color-kinetic-copy);
}

.filter-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 1px solid currentColor;
}

.filter-count {
  background: var(--color-kinetic-overlay);
  color: var(--color-kinetic-muted);
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
}

.filter-button.active .filter-count {
  background: var(--color-kinetic-overlay-strong);
  color: var(--color-kinetic-copy);
}

.search-wrap {
  position: relative;
  width: 100%;
}

.search-wrap::before {
  content: "?";
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-kinetic-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  pointer-events: none;
}

.input {
  width: 100%;
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  color: var(--color-kinetic-copy);
  padding: 10px 12px 10px 36px;
  font-size: 14px;
}

.input::placeholder {
  color: var(--color-kinetic-muted);
}

.table-card {
  padding-bottom: 0;
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
  background: var(--color-kinetic-overlay);
  border-top: 1px solid var(--color-kinetic-line);
  border-bottom: 1px solid var(--color-kinetic-line);
}

th,
td {
  padding: 14px 16px;
  text-align: left;
  vertical-align: top;
}

.kinetic-table-head {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-kinetic-muted);
}

tbody {
  border-bottom: 1px solid var(--color-kinetic-line);
}

tbody tr + tr td {
  border-top: 1px solid var(--color-kinetic-line);
}

.sort-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
}

.sort-button.active {
  color: var(--color-kinetic-copy);
}

.sort-glyph {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.8;
  font-size: 8px;
}

.sort-glyph .active {
  color: var(--color-kinetic-accent);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  border: 1px solid currentColor;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
}

.tone-match {
  color: var(--color-kinetic-success);
  background: rgba(108, 255, 190, 0.08);
}

.tone-mismatch,
.tone-duplicate {
  color: var(--color-kinetic-warning);
  background: rgba(255, 184, 110, 0.08);
}

.tone-missing-left,
.tone-unkeyed-left {
  color: var(--color-kinetic-accent);
  background: rgba(6, 182, 212, 0.08);
}

.tone-missing-right,
.tone-unkeyed-right {
  color: var(--color-kinetic-danger);
  background: rgba(255, 122, 122, 0.08);
}

.tone-neutral {
  color: var(--color-kinetic-copy);
  background: var(--color-kinetic-overlay);
}

.chip,
.table-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  padding: 6px 10px;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.chip {
  font-weight: 600;
}

.value-stack {
  display: grid;
  gap: 8px;
}

.value-row {
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.kinetic-value-text {
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
}

.diff-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  color: var(--color-kinetic-muted);
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.diff-toggle:hover {
  border-color: var(--color-kinetic-line-strong);
  color: var(--color-kinetic-copy);
}

.diff-toggle[aria-expanded="true"] {
  border-color: var(--color-kinetic-accent);
  background: rgba(6, 182, 212, 0.1);
  color: var(--color-kinetic-copy);
}

.diff-toggle-glyph {
  display: inline-block;
  transition: transform 0.18s ease;
}

.diff-toggle[aria-expanded="true"] .diff-toggle-glyph {
  transform: rotate(90deg);
}

.details-row td {
  background: var(--color-kinetic-overlay);
}

.diff-panel {
  padding: 16px;
}

.diff-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.diff-panel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid rgba(6, 182, 212, 0.4);
  background: rgba(6, 182, 212, 0.08);
  color: var(--color-kinetic-accent);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.diff-panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.diff-panel-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-kinetic-muted);
}

.diff-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.detail-stack {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.diff-card {
  padding: 14px;
}

.diff-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

.diff-arrow-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  font-size: 11px;
}

.diff-values {
  display: grid;
  grid-template-columns: minmax(0, 1fr) min-content minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.diff-value-label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.diff-value-label.file-a {
  color: var(--color-kinetic-danger);
}

.diff-value-label.file-b {
  color: var(--color-kinetic-success);
}

.diff-value-box {
  display: block;
  min-height: 42px;
  padding: 10px;
  border: 1px solid var(--color-kinetic-line);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.diff-empty {
  font-style: italic;
  color: var(--color-kinetic-muted);
}

.result-description {
  color: var(--color-kinetic-muted);
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.kinetic-empty-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border: 1px solid var(--color-kinetic-line);
  letter-spacing: 0.22em;
  font-size: 18px;
  text-transform: uppercase;
}

.status-strip {
  border-top: 1px solid var(--color-kinetic-line);
  background: var(--color-kinetic-overlay);
  padding: 12px 16px;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-kinetic-muted);
}

@media (min-width: 860px) {
  .section-card-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .section-card-action {
    min-width: 280px;
    justify-items: end;
  }

  .summary-file-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-match-rate-head {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
  }
}

@media (max-width: 720px) {
  .shell {
    padding: 16px;
  }

  .card {
    padding: 16px;
  }

  .table-wrap {
    margin: 0 -16px;
  }

  .diff-grid {
    grid-template-columns: 1fr;
  }
}`;
