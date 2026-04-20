import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import {
  RESULT_FILTER_OPTIONS,
  getResultBadge,
  getResultDescription,
  getResultFilterCounts,
} from './presentation';

type SortColumn = 'type' | 'key' | 'fileA' | 'fileB' | 'details';

type ExportRow = {
  id: string;
  resultType: ResultResponse['result_type'];
  filterBucket: Exclude<ResultFilter, 'all'> | 'duplicate';
  badgeLabel: string;
  badgeTone: 'match' | 'mismatch' | 'missing-left' | 'missing-right' | 'unkeyed-left' | 'unkeyed-right' | 'duplicate' | 'neutral';
  description: string | null;
  keyText: string;
  fileAValues: string[][];
  fileBValues: string[][];
  detailsCount: number;
  differences: ResultResponse['differences'];
  searchText: string;
  sortValues: Record<SortColumn, string | number>;
};

type HtmlExportDocument = {
  generatedAt: string;
  fileAName: string;
  fileBName: string;
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number }>;
  initialFilter: ResultFilter;
  rows: ExportRow[];
};

function getFilterBucket(result: ResultResponse): Exclude<ResultFilter, 'all'> | 'duplicate' {
  if (result.result_type.startsWith('duplicate')) {
    return 'duplicate';
  }

  return result.result_type as Exclude<ResultFilter, 'all' | 'duplicate'>;
}

function getBadgeTone(resultType: ResultResponse['result_type']): ExportRow['badgeTone'] {
  switch (resultType) {
    case 'match':
      return 'match';
    case 'mismatch':
      return 'mismatch';
    case 'missing_left':
      return 'missing-left';
    case 'missing_right':
      return 'missing-right';
    case 'unkeyed_left':
      return 'unkeyed-left';
    case 'unkeyed_right':
      return 'unkeyed-right';
    default:
      return resultType.startsWith('duplicate') ? 'duplicate' : 'neutral';
  }
}

function getDisplayRows(rows: string[][], fallback: string[]): string[][] {
  if (rows.length > 0) {
    return rows;
  }

  return fallback.length > 0 ? [fallback] : [];
}

function buildExportRows(results: ResultResponse[]): ExportRow[] {
  return results.map((result, index) => {
    const badge = getResultBadge(result.result_type);
    const fileAValues = getDisplayRows(result.duplicate_values_a, result.values_a);
    const fileBValues = getDisplayRows(result.duplicate_values_b, result.values_b);

    return {
      id: `${index}-${result.result_type}-${result.key.join('|')}`,
      resultType: result.result_type,
      filterBucket: getFilterBucket(result),
      badgeLabel: badge.label,
      badgeTone: getBadgeTone(result.result_type),
      description: getResultDescription(result.result_type),
      keyText: result.key.join(', '),
      fileAValues,
      fileBValues,
      detailsCount: result.differences.length,
      differences: result.differences,
      searchText: [
        badge.label,
        result.key.join(' '),
        result.values_a.join(' '),
        result.values_b.join(' '),
        result.duplicate_values_a.flat().join(' '),
        result.duplicate_values_b.flat().join(' '),
        result.differences.flatMap((diff) => [diff.column_a, diff.column_b, diff.value_a, diff.value_b]).join(' '),
      ]
        .join(' ')
        .toLowerCase(),
      sortValues: {
        type: badge.label,
        key: result.key.join(' '),
        fileA: [...result.values_a, ...result.duplicate_values_a.flat()].join(' '),
        fileB: [...result.values_b, ...result.duplicate_values_b.flat()].join(' '),
        details: result.differences.length,
      },
    };
  });
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlExportDocument(params: {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  results: ResultResponse[];
  initialFilter: ResultFilter;
}): HtmlExportDocument {
  const counts = getResultFilterCounts(params.results);

  return {
    generatedAt: new Date().toISOString(),
    fileAName: params.fileAName,
    fileBName: params.fileBName,
    summary: params.summary,
    filterOptions: RESULT_FILTER_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: counts[option.value],
    })),
    initialFilter: params.initialFilter,
    rows: buildExportRows(params.results),
  };
}

export function buildResultsHtmlDocument(params: {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  results: ResultResponse[];
  initialFilter: ResultFilter;
}): string {
  const exportDocument = buildHtmlExportDocument(params);
  const serializedData = escapeJsonForHtml(exportDocument);
  const documentTitle = escapeHtmlText(`${params.fileAName} vs ${params.fileBName} comparison results`);
  const fileAName = escapeHtmlText(params.fileAName);
  const fileBName = escapeHtmlText(params.fileBName);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentTitle}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050505;
        --panel: #090909;
        --panel-2: #111111;
        --overlay: rgba(19, 22, 26, 0.92);
        --overlay-strong: rgba(26, 31, 36, 0.96);
        --text: #f5f7fb;
        --muted: #95a2b3;
        --line: rgba(151, 177, 204, 0.18);
        --line-strong: rgba(198, 220, 242, 0.36);
        --accent: #06b6d4;
        --accent-2: #bef264;
        --success: #6cffbe;
        --success-bg: rgba(108, 255, 190, 0.1);
        --danger: #ff8a8a;
        --danger-bg: rgba(255, 138, 138, 0.1);
        --match: #6cffbe;
        --match-bg: rgba(108, 255, 190, 0.08);
        --mismatch: #ffb86e;
        --mismatch-bg: rgba(255, 184, 110, 0.08);
        --missing-left: #06b6d4;
        --missing-left-bg: rgba(6, 182, 212, 0.1);
        --missing-right: #ff7a7a;
        --missing-right-bg: rgba(255, 122, 122, 0.08);
        --unkeyed-left: #06b6d4;
        --unkeyed-left-bg: rgba(6, 182, 212, 0.08);
        --unkeyed-right: #fbbf24;
        --unkeyed-right-bg: rgba(251, 191, 36, 0.08);
        --duplicate: #ffb86e;
        --duplicate-bg: rgba(255, 184, 110, 0.08);
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
      }

      * { box-sizing: border-box; }
      html {
        background: var(--bg);
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
        position: relative;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(6, 182, 212, 0.06), transparent 26%),
          radial-gradient(circle at top, rgba(190, 242, 100, 0.07), transparent 36%),
          rgba(255, 255, 255, 0.01);
        border: 1px solid rgba(255, 255, 255, 0.02);
        opacity: 0.8;
      }

      .shell {
        max-width: 1320px;
        margin: 0 auto;
        padding: 24px;
        position: relative;
        z-index: 1;
      }

      .card {
        background: linear-gradient(180deg, rgba(17, 17, 17, 0.94) 0%, rgba(9, 9, 9, 0.98) 100%);
        border: 1px solid var(--line);
        position: relative;
        overflow: hidden;
        border-radius: 0;
        box-shadow: var(--shadow);
      }

      .card::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-top: 1px solid rgba(245, 247, 251, 0.1);
        border-left: 1px solid rgba(245, 247, 251, 0.04);
      }

      .hero {
        padding: 24px;
        margin-bottom: 20px;
      }

      .eyebrow {
        display: inline-block;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent);
        margin-bottom: 12px;
      }

      h1, h2, h3, p { margin: 0; }
      h1 {
        font-family: "Bebas Neue", Impact, sans-serif;
        font-size: clamp(2.8rem, 8vw, 5rem);
        letter-spacing: 0.08em;
        line-height: 0.92;
        text-transform: uppercase;
      }

      h2 {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .hero p { color: var(--muted); margin-top: 8px; }

      .hero-copy {
        max-width: 60rem;
      }

      .hero-context {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .hero-files {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .hero-file {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        border: 1px solid var(--line);
        background: var(--overlay);
        padding: 8px 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 12px;
      }

      .hero-file-label {
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        flex: 0 0 auto;
      }

      .hero-file-name {
        overflow-wrap: anywhere;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-top: 20px;
      }

      .summary-item {
        background: var(--overlay);
        border: 1px solid var(--line);
        min-height: 100%;
        padding: 14px;
      }

      .summary-item span {
        display: block;
        color: var(--muted);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .summary-item strong {
        display: block;
        font-size: 1.5rem;
        margin-top: 6px;
      }

      .stack { display: grid; gap: 20px; }

      .controls {
        padding: 20px;
      }

      .controls-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .controls-head p { color: var(--muted); margin-top: 6px; }

      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .filter-button,
      .sort-button,
      .diff-toggle {
        font: inherit;
        cursor: pointer;
      }

      .filter-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        background: var(--overlay);
        color: var(--text);
        padding: 9px 14px;
        transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
      }

      .filter-button:hover {
        border-color: var(--line-strong);
        background: var(--overlay-strong);
      }

      .filter-button.active {
        border-color: var(--accent);
        background: rgba(6, 182, 212, 0.1);
      }

      .filter-count {
        background: rgba(19, 22, 26, 0.92);
        padding: 2px 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }

      .filter-button.active .filter-count {
        background: rgba(26, 31, 36, 0.96);
        color: var(--text);
      }

      .search {
        width: min(100%, 320px);
        border: 1px solid var(--line);
        background: var(--overlay);
        color: var(--text);
        padding: 10px 12px;
        font: inherit;
      }

      .search::placeholder {
        color: var(--muted);
      }

      .table-card { overflow: hidden; }

      .table-header {
        padding: 20px 20px 0;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }

      .table-header p { color: var(--muted); margin-top: 6px; }

      .table-wrap { overflow-x: auto; padding: 0 20px 20px; }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
      }

      th, td {
        padding: 14px 12px;
        text-align: left;
        vertical-align: top;
        border-top: 1px solid var(--line);
      }

      thead th {
        background: rgba(19, 22, 26, 0.92);
        border-top: none;
        color: var(--muted);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      tbody tr:hover td {
        background: rgba(19, 22, 26, 0.48);
      }

      .sort-button {
        background: transparent;
        border: none;
        color: inherit;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        letter-spacing: inherit;
        text-transform: inherit;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px solid currentColor;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-weight: 700;
        white-space: nowrap;
      }

      .badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: currentColor;
      }

      .tone-match { color: var(--match); background: var(--match-bg); }
      .tone-mismatch { color: var(--mismatch); background: var(--mismatch-bg); }
      .tone-missing-left { color: var(--missing-left); background: var(--missing-left-bg); }
      .tone-missing-right { color: var(--missing-right); background: var(--missing-right-bg); }
      .tone-unkeyed-left { color: var(--unkeyed-left); background: var(--unkeyed-left-bg); }
      .tone-unkeyed-right { color: var(--unkeyed-right); background: var(--unkeyed-right-bg); }
      .tone-duplicate { color: var(--duplicate); background: var(--duplicate-bg); }
      .tone-neutral { color: var(--text); background: var(--overlay); }

      .chip {
        display: inline-block;
        border: 1px solid var(--line);
        background: var(--overlay);
        padding: 6px 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 13px;
        max-width: 100%;
        overflow-wrap: anywhere;
      }

      .value-stack {
        display: grid;
        gap: 8px;
      }

      .value-row {
        border: 1px solid var(--line);
        background: var(--overlay);
        padding: 8px 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 13px;
      }

      .diff-toggle {
        border: 1px solid var(--line);
        background: var(--overlay);
        padding: 7px 10px;
        color: var(--text);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        transition: border-color 0.18s ease, background 0.18s ease;
      }

      .diff-toggle:hover {
        border-color: var(--line-strong);
        background: var(--overlay-strong);
      }

      .details-row td {
        background: rgba(14, 16, 19, 0.98);
      }

      .diff-panel {
        border: 1px solid var(--line);
        background: rgba(19, 22, 26, 0.92);
        padding: 16px;
      }

      .diff-panel-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .diff-panel-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 1px solid var(--accent);
        background: rgba(6, 182, 212, 0.14);
        color: var(--text);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .diff-panel-title {
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--text);
      }

      .diff-panel-count {
        margin-left: auto;
        color: var(--muted);
        font-size: 12px;
      }

      .diff-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .diff-card {
        border: 1px solid var(--line);
        padding: 14px;
        background: rgba(26, 31, 36, 0.82);
      }

      .diff-card-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: flex-start;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 10px;
      }

      .diff-column-chip {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        border: 1px solid var(--line);
        background: var(--overlay);
        padding: 6px 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .diff-arrow-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--line);
        background: rgba(9, 9, 9, 0.92);
        color: var(--muted);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 11px;
        flex: 0 0 auto;
      }

      .diff-values {
        display: grid;
        grid-template-columns: minmax(0, 1fr) min-content minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      .diff-value-label {
        display: block;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .diff-value-label.file-a {
        color: var(--danger);
      }

      .diff-value-label.file-b {
        color: var(--success);
      }

      .diff-value-box {
        display: block;
        border: 1px solid var(--line);
        padding: 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 13px;
        background: rgba(9, 9, 9, 0.92);
        overflow-wrap: anywhere;
        min-height: 42px;
      }

      .diff-value-box.file-a {
        border-color: rgba(255, 138, 138, 0.28);
        background: var(--danger-bg);
      }

      .diff-value-box.file-b {
        border-color: rgba(108, 255, 190, 0.28);
        background: var(--success-bg);
      }

      .diff-values-arrow {
        align-self: center;
      }

      .diff-empty {
        color: var(--muted);
        font-style: italic;
      }

      .result-description {
        color: var(--muted);
      }

      .diff-values-arrow {
        color: var(--muted);
      }

      .diff-values strong {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .empty-state {
        padding: 48px 24px;
        text-align: center;
        color: var(--muted);
      }

      .empty-glyph {
        border: 1px solid var(--line);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        margin: 0 auto 12px;
        background: var(--overlay);
        color: var(--text);
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 28px;
        letter-spacing: 0.18em;
      }

      @media (max-width: 720px) {
        .shell { padding: 16px; }
        .hero, .controls { padding: 16px; }
        .controls-head, .table-header { flex-direction: column; }
        .search { width: 100%; }
        .diff-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell stack">
      <section class="card hero">
        <span class="eyebrow">Saved comparison review</span>
        <h1>Comparison results</h1>
        <p class="hero-copy">Standalone HTML export of the current comparison results with the same result buckets, sortable review table, and kinetic dark review surface as the app.</p>
        <div class="hero-context">
          <div class="hero-files" aria-label="Compared files">
            <span class="hero-file"><span class="hero-file-label">File A</span><span class="hero-file-name">${fileAName}</span></span>
            <span class="hero-file"><span class="hero-file-label">File B</span><span class="hero-file-name">${fileBName}</span></span>
          </div>
        </div>
        <div class="summary-grid">
          <div class="summary-item"><span>File A rows</span><strong id="summary-total-a"></strong></div>
          <div class="summary-item"><span>File B rows</span><strong id="summary-total-b"></strong></div>
          <div class="summary-item"><span>Matches</span><strong id="summary-matches"></strong></div>
          <div class="summary-item"><span>Mismatches</span><strong id="summary-mismatches"></strong></div>
          <div class="summary-item"><span>Only in File B</span><strong id="summary-missing-left"></strong></div>
          <div class="summary-item"><span>Only in File A</span><strong id="summary-missing-right"></strong></div>
          <div class="summary-item"><span>Ignored in File B</span><strong id="summary-unkeyed-left"></strong></div>
          <div class="summary-item"><span>Ignored in File A</span><strong id="summary-unkeyed-right"></strong></div>
          <div class="summary-item"><span>Duplicates in File A</span><strong id="summary-duplicates-a"></strong></div>
          <div class="summary-item"><span>Duplicates in File B</span><strong id="summary-duplicates-b"></strong></div>
        </div>
      </section>

      <section class="card controls">
        <div class="controls-head">
          <div>
            <span class="eyebrow">Results filter</span>
            <h2>Focus on the rows you care about</h2>
            <p>Switch between result buckets while reviewing the exported comparison.</p>
          </div>
          <input id="results-search" class="search" type="search" placeholder="Search keys or values" aria-label="Search keys or values" />
        </div>
        <div id="filter-row" class="filter-row" role="group" aria-label="Result buckets"></div>
      </section>

      <section class="card table-card">
        <div class="table-header">
          <div>
            <span class="eyebrow">Detailed results</span>
            <h2>Comparison results</h2>
            <p id="results-count"></p>
          </div>
          <p id="generated-at"></p>
        </div>
        <div class="table-wrap">
          <div id="table-empty-state" class="empty-state" hidden>
            <div id="table-empty-glyph" class="empty-glyph"></div>
            <p id="table-empty-copy"></p>
          </div>
          <table id="results-table">
            <thead>
              <tr>
                <th><button type="button" class="sort-button" data-sort-column="type">Type</button></th>
                <th><button type="button" class="sort-button" data-sort-column="key">Key</button></th>
                <th><button type="button" class="sort-button" data-sort-column="fileA">File A Values</button></th>
                <th><button type="button" class="sort-button" data-sort-column="fileB">File B Values</button></th>
                <th><button type="button" class="sort-button" data-sort-column="details">Details</button></th>
              </tr>
            </thead>
            <tbody id="results-body"></tbody>
          </table>
        </div>
      </section>
    </div>

    <script id="csv-align-export-data" type="application/json">${serializedData}</script>
    <script>
      const data = JSON.parse(document.getElementById('csv-align-export-data').textContent);
      const state = {
        filter: data.initialFilter,
        query: '',
        sortColumn: null,
        sortDirection: 'asc',
        expandedRow: null,
      };

      const summaryMap = {
        'summary-total-a': data.summary.total_rows_a,
        'summary-total-b': data.summary.total_rows_b,
        'summary-matches': data.summary.matches,
        'summary-mismatches': data.summary.mismatches,
        'summary-missing-left': data.summary.missing_left,
        'summary-missing-right': data.summary.missing_right,
        'summary-unkeyed-left': data.summary.unkeyed_left,
        'summary-unkeyed-right': data.summary.unkeyed_right,
        'summary-duplicates-a': data.summary.duplicates_a,
        'summary-duplicates-b': data.summary.duplicates_b,
      };

      Object.entries(summaryMap).forEach(([id, value]) => {
        document.getElementById(id).textContent = String(value);
      });

      document.getElementById('generated-at').textContent = 'Generated ' + new Date(data.generatedAt).toLocaleString();

      const filterRow = document.getElementById('filter-row');
      const resultsCount = document.getElementById('results-count');
      const resultsBody = document.getElementById('results-body');
      const resultsTable = document.getElementById('results-table');
      const emptyState = document.getElementById('table-empty-state');
      const emptyGlyph = document.getElementById('table-empty-glyph');
      const emptyCopy = document.getElementById('table-empty-copy');
      const searchInput = document.getElementById('results-search');

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function compareValues(left, right) {
        if (typeof left === 'number' && typeof right === 'number') {
          return left - right;
        }

        return String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      function formatValueStack(rows) {
        if (rows.length === 0) {
          return '<span style="color: var(--muted); font-style: italic;">-</span>';
        }

        return '<div class="value-stack">' + rows.map((row) => (
          '<div class="value-row">' + escapeHtml(row.length > 0 ? row.join(', ') : '-') + '</div>'
        )).join('') + '</div>';
      }

      function renderDifferences(row) {
        if (row.differences.length === 0 || state.expandedRow !== row.id) {
          return '';
        }

        return '<tr class="details-row"><td colspan="5"><div class="diff-panel"><div class="diff-panel-header"><span class="diff-panel-icon">+</span><span class="diff-panel-title">Value Differences</span><span class="diff-panel-count">' + row.differences.length + ' field' + (row.differences.length === 1 ? '' : 's') + '</span></div><div class="diff-grid">' + row.differences.map((diff) => (
          '<article class="diff-card">'
            + '<header class="diff-card-header"><span class="diff-column-chip">' + escapeHtml(diff.column_a) + '</span>'
            + (diff.column_a === diff.column_b ? '' : '<span class="diff-arrow-box">-&gt;</span><span class="diff-column-chip">' + escapeHtml(diff.column_b) + '</span>')
            + '</header>'
            + '<div class="diff-values">'
            + '<div><span class="diff-value-label file-a">File A</span><span class="diff-value-box file-a" title="' + escapeHtml(diff.value_a) + '">' + (diff.value_a === '' ? '<span class="diff-empty">-</span>' : escapeHtml(diff.value_a)) + '</span></div>'
            + '<div class="diff-values-arrow"><span class="diff-arrow-box">-&gt;</span></div>'
            + '<div><span class="diff-value-label file-b">File B</span><span class="diff-value-box file-b" title="' + escapeHtml(diff.value_b) + '">' + (diff.value_b === '' ? '<span class="diff-empty">-</span>' : escapeHtml(diff.value_b)) + '</span></div>'
            + '</div>'
            + '</article>'
        )).join('') + '</div></div></td></tr>';
      }

      function getVisibleRows() {
        const normalizedQuery = state.query.trim().toLowerCase();
        const filtered = data.rows.filter((row) => {
          const matchesBucket = state.filter === 'all' ? true : row.filterBucket === state.filter;
          const matchesSearch = normalizedQuery.length === 0 ? true : row.searchText.includes(normalizedQuery);
          return matchesBucket && matchesSearch;
        });

        if (!state.sortColumn) {
          return filtered;
        }

        const direction = state.sortDirection === 'asc' ? 1 : -1;
        return [...filtered].sort((left, right) => compareValues(left.sortValues[state.sortColumn], right.sortValues[state.sortColumn]) * direction);
      }

      function renderFilters() {
        filterRow.innerHTML = data.filterOptions.map((option) => (
          '<button type="button" class="filter-button' + (state.filter === option.value ? ' active' : '') + '" data-filter="' + option.value + '" aria-pressed="' + (state.filter === option.value ? 'true' : 'false') + '">' + escapeHtml(option.label) + '<span class="filter-count">' + option.count + '</span></button>'
        )).join('');
      }

      function renderTable() {
        const visibleRows = getVisibleRows();
        const filterOnlyRows = data.rows.filter((row) => state.filter === 'all' || row.filterBucket === state.filter);

        resultsCount.textContent = visibleRows.length + ' of ' + filterOnlyRows.length + ' rows shown';

        if (filterOnlyRows.length === 0) {
          emptyGlyph.textContent = '0X';
          emptyCopy.textContent = 'No results match the selected filter';
          emptyState.hidden = false;
          resultsTable.hidden = true;
          return;
        }

        if (visibleRows.length === 0) {
          emptyGlyph.textContent = 'NS';
          emptyCopy.textContent = 'No results match the current filter and search.';
          emptyState.hidden = false;
          resultsTable.hidden = true;
          return;
        }

        emptyState.hidden = true;
        resultsTable.hidden = false;

        resultsBody.innerHTML = visibleRows.map((row) => {
          const detailCell = row.detailsCount > 0
            ? '<button type="button" class="diff-toggle" data-expand-row="' + row.id + '" aria-expanded="' + (state.expandedRow === row.id ? 'true' : 'false') + '">' + row.detailsCount + ' diff' + (row.detailsCount === 1 ? '' : 's') + '</button>'
            : '<span class="result-description">' + escapeHtml(row.description || '-') + '</span>';

          return '<tr>'
            + '<td><span class="badge tone-' + row.badgeTone + '"><span class="badge-dot"></span>' + escapeHtml(row.badgeLabel) + '</span></td>'
            + '<td><span class="chip">' + escapeHtml(row.keyText) + '</span></td>'
            + '<td>' + formatValueStack(row.fileAValues) + '</td>'
            + '<td>' + formatValueStack(row.fileBValues) + '</td>'
            + '<td>' + detailCell + '</td>'
            + '</tr>'
            + renderDifferences(row);
        }).join('');
      }

      filterRow.addEventListener('click', (event) => {
        const target = event.target.closest('[data-filter]');
        if (!target) {
          return;
        }

        state.filter = target.getAttribute('data-filter');
        state.expandedRow = null;
        renderFilters();
        renderTable();
      });

      searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        state.expandedRow = null;
        renderTable();
      });

      document.querySelectorAll('[data-sort-column]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextColumn = button.getAttribute('data-sort-column');
          if (state.sortColumn === nextColumn) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortColumn = nextColumn;
            state.sortDirection = 'asc';
          }

          renderTable();
        });
      });

      resultsBody.addEventListener('click', (event) => {
        const target = event.target.closest('[data-expand-row]');
        if (!target) {
          return;
        }

        const rowId = target.getAttribute('data-expand-row');
        state.expandedRow = state.expandedRow === rowId ? null : rowId;
        renderTable();
      });

      renderFilters();
      renderTable();
    </script>
  </body>
</html>`;
}
