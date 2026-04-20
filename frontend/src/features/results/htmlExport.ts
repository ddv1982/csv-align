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
  const title = escapeHtmlText(`${params.fileAName} vs ${params.fileBName} comparison results`);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: #ffffff;
        --panel-strong: #eef2ff;
        --text: #172033;
        --muted: #5c6b88;
        --line: #d9e0ee;
        --accent: #405cf5;
        --accent-soft: #eef2ff;
        --match: #067647;
        --match-bg: #ecfdf3;
        --mismatch: #b54708;
        --mismatch-bg: #fff7ed;
        --missing-left: #155eef;
        --missing-left-bg: #eff8ff;
        --missing-right: #6938ef;
        --missing-right-bg: #f5f3ff;
        --unkeyed-left: #c01048;
        --unkeyed-left-bg: #fff1f3;
        --unkeyed-right: #a1127f;
        --unkeyed-right-bg: #fdf2fa;
        --duplicate: #b54708;
        --duplicate-bg: #fff7ed;
        --shadow: 0 18px 40px rgba(23, 32, 51, 0.08);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
      }

      .shell {
        max-width: 1320px;
        margin: 0 auto;
        padding: 24px;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: var(--shadow);
      }

      .hero {
        padding: 24px;
        margin-bottom: 20px;
      }

      .eyebrow {
        display: inline-block;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 12px;
      }

      h1, h2, h3, p { margin: 0; }
      h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); }
      .hero p { color: var(--muted); margin-top: 8px; }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-top: 20px;
      }

      .summary-item {
        background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px;
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
        background: #fff;
        color: var(--text);
        border-radius: 999px;
        padding: 9px 14px;
      }

      .filter-button.active {
        border-color: var(--accent);
        background: var(--accent-soft);
      }

      .filter-count {
        background: rgba(64, 92, 245, 0.12);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 12px;
        font-weight: 600;
      }

      .search {
        width: min(100%, 320px);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        font: inherit;
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
        background: #f9fbff;
        border-top: none;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .sort-button {
        background: transparent;
        border: none;
        color: inherit;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid currentColor;
        font-size: 12px;
        letter-spacing: 0.08em;
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
      .tone-neutral { color: var(--text); background: #eef2f7; }

      .chip {
        display: inline-block;
        border: 1px solid var(--line);
        background: #f9fbff;
        border-radius: 10px;
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
        background: #fbfcff;
        border-radius: 10px;
        padding: 8px 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        font-size: 13px;
      }

      .diff-toggle {
        border: 1px solid var(--line);
        background: #f9fbff;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .details-row td {
        background: #fcfdff;
      }

      .diff-panel {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #fff;
        padding: 16px;
      }

      .diff-panel h3 {
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 12px;
      }

      .diff-grid {
        display: grid;
        gap: 12px;
      }

      .diff-item {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
        background: #fbfcff;
      }

      .diff-item header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 10px;
      }

      .diff-values {
        display: grid;
        grid-template-columns: minmax(0, 1fr) min-content minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .diff-values strong {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .diff-values span {
        display: block;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px;
        font-family: "JetBrains Mono", "SFMono-Regular", monospace;
        background: #fff;
        overflow-wrap: anywhere;
      }

      .empty-state {
        padding: 48px 24px;
        text-align: center;
        color: var(--muted);
      }

      .empty-glyph {
        font-size: 28px;
        letter-spacing: 0.16em;
        margin-bottom: 8px;
      }

      @media (max-width: 720px) {
        .shell { padding: 16px; }
        .hero, .controls { padding: 16px; }
        .controls-head, .table-header { flex-direction: column; }
        .search { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="shell stack">
      <section class="card hero">
        <span class="eyebrow">Saved comparison review</span>
        <h1>${title}</h1>
        <p>Standalone HTML export of the current comparison results with the same result buckets and sortable review table.</p>
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

        return '<tr class="details-row"><td colspan="5"><div class="diff-panel"><h3>Value Differences</h3><div class="diff-grid">' + row.differences.map((diff) => (
          '<article class="diff-item">'
            + '<header><span class="chip">' + escapeHtml(diff.column_a) + '</span>'
            + (diff.column_a === diff.column_b ? '' : '<span style="align-self:center;">-&gt;</span><span class="chip">' + escapeHtml(diff.column_b) + '</span>')
            + '</header>'
            + '<div class="diff-values">'
            + '<div><strong>File A</strong><span>' + escapeHtml(diff.value_a) + '</span></div>'
            + '<div style="align-self:center;">-&gt;</div>'
            + '<div><strong>File B</strong><span>' + escapeHtml(diff.value_b) + '</span></div>'
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
            : '<span>' + escapeHtml(row.description || '-') + '</span>';

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
