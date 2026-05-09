import resultsSurfaceCss from './resultsSurface.css?raw';

const EXPORT_ONLY_STYLES = String.raw`* {
  box-sizing: border-box;
  scrollbar-color: color-mix(in srgb, var(--color-kinetic-accent) 45%, transparent) var(--color-kinetic-overlay);
}

*:focus-visible {
  outline: 1px solid var(--color-kinetic-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-kinetic-accent) 32%, transparent);
}

::selection {
  background: color-mix(in srgb, var(--color-kinetic-accent) 22%, transparent);
  color: var(--color-kinetic-copy);
}

html {
  background: var(--color-kinetic-bg);
  font-family: var(--font-sans);
}

body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top, color-mix(in srgb, var(--color-kinetic-accent-2) 7%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-kinetic-accent) 6%, transparent), transparent 24%),
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
  border: 1px solid color-mix(in srgb, var(--color-kinetic-grid) 18%, transparent);
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

.card {
  padding: 20px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
}

.section-card-body {
  display: grid;
  gap: 24px;
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
  font-family: var(--font-sans);
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

tbody {
  border-bottom: 1px solid var(--color-kinetic-line);
}

tbody tr + tr td {
  border-top: 1px solid var(--color-kinetic-line);
}

.sort-button {
  padding: 0;
}

.sort-glyph .active {
  color: var(--color-kinetic-accent);
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.result-description {
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
}`;

export const RESULTS_EXPORT_STYLES = `${resultsSurfaceCss}\n${EXPORT_ONLY_STYLES}`;
