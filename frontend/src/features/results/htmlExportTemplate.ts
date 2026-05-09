import type { ResultFilter, SummaryResponse } from '../../types/api';
import { buildSummaryOverview, type ResultFilterTone, type ResultRowViewModel, type SummaryBannerViewModel, type SummaryStatViewModel } from './presentation';
import { RESULTS_EXPORT_STYLES } from './htmlExportTheme';

type HtmlExportTheme = 'dark';

type HtmlExportDocument = {
  generatedAt: string;
  theme: HtmlExportTheme;
  fileAName: string;
  fileBName: string;
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number; tone: ResultFilterTone }>;
  initialFilter: ResultFilter;
  rows: ResultRowViewModel[];
};

type ExportIconName = 'chart' | 'funnel' | 'stack' | 'check' | 'warning' | 'info' | 'chevron' | 'plus' | 'search';

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + '#39;');
}

function renderIcon(name: ExportIconName, className: string): string {
  const paths: Record<ExportIconName, string> = {
    chart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
    funnel: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M6 8h12M9 12h6M11 16h2" />',
    stack: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />',
    check: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 6a9 9 0 110 18 9 9 0 010-18z" />',
    chevron: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />',
    plus: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />',
    search: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />',
  };

  return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function renderStatIcon(stat: SummaryStatViewModel): string {
  if (stat.tone === 'success') {
    return renderIcon('check', 'h-5 w-5');
  }

  if (stat.tone === 'warning') {
    return renderIcon('warning', 'h-5 w-5');
  }

  return escapeHtmlText(stat.icon);
}

function renderSummaryStats(stats: SummaryStatViewModel[]): string {
  return stats
    .map(
      (stat) => `<div class="surface-panel summary-stat p-4 tone-${stat.tone}">
                <div class="summary-stat-head mb-3 flex items-center justify-between gap-3">
                  <div class="summary-stat-icon tone-${stat.tone}-strong flex h-10 w-10 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em]">${renderStatIcon(stat)}</div>
                  <span class="app-text summary-stat-value text-2xl font-bold tabular-nums">${stat.value}</span>
                </div>
                <p class="app-text summary-stat-label text-sm font-semibold">${escapeHtmlText(stat.label)}</p>
                <p class="app-muted summary-stat-description mt-0.5 text-xs">${escapeHtmlText(stat.description)}</p>
              </div>`,
    )
    .join('');
}

function renderSummaryBanners(banners: SummaryBannerViewModel[]): string {
  if (banners.length === 0) {
    return '';
  }

  return `<div class="summary-banners space-y-4">${banners
    .map(
      (banner) => `<div class="surface-panel summary-banner p-4 tone-${banner.tone}">
                <div class="flex items-start gap-3">
                  <div class="summary-banner-icon tone-${banner.tone}-strong mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em]">${banner.tone === 'accent' ? renderIcon('info', 'h-5 w-5') : renderIcon('warning', 'h-5 w-5')}</div>
                  <div class="summary-banner-copy space-y-1.5">
                    <p class="app-text summary-banner-title text-sm font-semibold">${escapeHtmlText(banner.title)}</p>
                    <p class="app-text summary-banner-summary text-sm font-medium">${escapeHtmlText(banner.summary)}</p>
                    ${banner.details
                      .map((detail) => `<p class="app-muted summary-banner-detail text-sm leading-6">${escapeHtmlText(detail)}</p>`)
                      .join('')}
                  </div>
                </div>
              </div>`,
    )
    .join('')}</div>`;
}

export function renderResultsHtmlDocument(data: HtmlExportDocument, serializedData: string): string {
  const documentTitle = escapeHtmlText(`${data.fileAName} vs ${data.fileBName} comparison results`);
  const fileAName = escapeHtmlText(data.fileAName);
  const fileBName = escapeHtmlText(data.fileBName);
  const { comparableTotal, matchPercent, comparableStats, infoBanners } = buildSummaryOverview(data.summary);

  return `<!DOCTYPE html>
<html lang="en" class="dark" data-theme="${data.theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentTitle}</title>
    <style>
${RESULTS_EXPORT_STYLES}
    </style>
  </head>
  <body>
    <div class="app-shell flex min-h-screen flex-col bg-app-bg text-app-text">
      <main class="report-main mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div class="animate-fade-in space-y-6">
          <section class="card section-card p-5 overflow-hidden">
            <div class="section-card-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="section-card-heading flex items-start gap-3">
                <div class="section-card-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-sm uppercase tracking-[0.18em] tone-accent-strong">${renderIcon('chart', 'h-5 w-5')}</div>
                <div class="section-card-copy">
                  <p class="hud-label text-app-accent">Step 3 · Results</p>
                  <h3 class="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-app-text"><span class="text-lg">Comparison Summary</span></h3>
                  <p class="mt-1 text-sm leading-6 text-app-muted">Review the overall match quality before drilling into filtered result rows.</p>
                </div>
              </div>
              <div class="section-card-action shrink-0 summary-file-grid grid gap-3 sm:grid-cols-2" aria-label="Compared files">
                <div class="surface-panel summary-file-panel px-4 py-3">
                  <div class="hud-label">File A</div>
                  <div class="app-muted mt-1 text-sm"><span class="app-text font-semibold">${data.summary.total_rows_a}</span> rows</div>
                  <div class="app-muted file-name mt-1 max-w-[280px] truncate text-xs" title="${fileAName}">${fileAName}</div>
                </div>
                <div class="surface-panel summary-file-panel px-4 py-3">
                  <div class="hud-label">File B</div>
                  <div class="app-muted mt-1 text-sm"><span class="app-text font-semibold">${data.summary.total_rows_b}</span> rows</div>
                  <div class="app-muted file-name mt-1 max-w-[280px] truncate text-xs" title="${fileBName}">${fileBName}</div>
                </div>
              </div>
            </div>
            <div class="section-card-body mt-5">
              <div class="summary-main space-y-6">
                <div class="surface-panel summary-match-rate p-5">
                  <div class="summary-match-rate-head flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <p class="hud-label">Match rate</p>
                      <p class="app-text mt-0.5 text-sm font-medium">Match rate of comparable rows</p>
                    </div>
                    <div class="summary-match-rate-value flex items-baseline gap-2">
                      <span class="display-title app-text text-4xl">${matchPercent}%</span>
                      <span class="app-muted text-xs">${data.summary.matches} of ${comparableTotal} rows</span>
                    </div>
                  </div>
                  <div class="app-frame summary-progress mt-4 h-3 w-full overflow-hidden">
                    <div class="app-progress-fill h-full transition-all duration-500" style="width: ${matchPercent}%;"></div>
                  </div>
                </div>

                <div>
                  <div class="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <p class="hud-label">Outcome breakdown</p>
                      <p class="app-muted mt-0.5 text-sm">How each comparable row was classified.</p>
                    </div>
                  </div>
                  <div class="summary-stat-grid grid grid-cols-2 gap-4 md:grid-cols-4">${renderSummaryStats(comparableStats)}</div>
                </div>

                ${renderSummaryBanners(infoBanners)}
              </div>
            </div>
          </section>

          <section class="card section-card p-5 overflow-hidden">
            <div class="section-card-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="section-card-heading flex items-start gap-3">
                <div class="section-card-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-sm uppercase tracking-[0.18em] tone-accent-strong">${renderIcon('funnel', 'h-5 w-5')}</div>
                <div class="section-card-copy">
                  <p class="hud-label text-app-accent">Results filter</p>
                  <h3 class="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-app-text">Focus on the rows you care about</h3>
                  <p class="mt-1 text-sm leading-6 text-app-muted">Switch between result buckets or export the full comparison as HTML or CSV.</p>
                </div>
              </div>
            </div>
            <div class="section-card-body mt-5">
              <div id="filter-row" class="filter-row flex flex-wrap gap-2" role="group" aria-label="Result buckets"></div>
            </div>
          </section>

          <section class="card section-card p-5 overflow-hidden">
            <div class="section-card-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="section-card-heading flex items-start gap-3">
                <div class="section-card-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-sm uppercase tracking-[0.18em] tone-accent-strong">${renderIcon('stack', 'h-5 w-5')}</div>
                <div class="section-card-copy">
                  <p class="hud-label text-app-accent">Detailed results</p>
                  <h3 class="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-app-text">Comparison results</h3>
                  <p id="results-count" class="mt-1 text-sm leading-6 text-app-muted"></p>
                </div>
              </div>
              <div class="section-card-action shrink-0">
                <label class="search-wrap relative block w-full sm:max-w-xs" for="results-search">
                  <span class="sr-only">Search result values</span>
                  ${renderIcon('search', 'search-icon app-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2')}
                  <input id="results-search" class="input pl-9 pr-3 text-sm" type="search" placeholder="Search keys or values" aria-label="Search keys or values" />
                </label>
              </div>
            </div>

            <div class="section-card-body mt-5">
              <div>
                <div id="table-empty-state" class="p-12 text-center" hidden>
                  <div id="table-empty-glyph" class="empty-state-icon app-muted"></div>
                  <p id="table-empty-copy" class="app-muted"></p>
                </div>

                <div class="table-wrap overflow-x-auto">
                  <table id="results-table" class="results-table w-full">
                    <thead class="app-surface-subtle border-b border-app-border">
                      <tr>
                        <th class="table-head w-40 min-w-[11rem] px-4 py-3 text-left" aria-sort="none"><button type="button" class="sort-button group inline-flex items-center text-left transition-colors app-muted hover:text-app-text" data-sort-column="type">Type <span class="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true"><span class="block leading-none text-[8px]" data-sort-dir="asc">▲</span><span class="block leading-none text-[8px]" data-sort-dir="desc">▼</span></span></button></th>
                        <th class="table-head px-4 py-3 text-left" aria-sort="none"><button type="button" class="sort-button group inline-flex items-center text-left transition-colors app-muted hover:text-app-text" data-sort-column="key">Key <span class="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true"><span class="block leading-none text-[8px]" data-sort-dir="asc">▲</span><span class="block leading-none text-[8px]" data-sort-dir="desc">▼</span></span></button></th>
                        <th class="table-head px-4 py-3 text-left" aria-sort="none"><button type="button" class="sort-button group inline-flex items-center text-left transition-colors app-muted hover:text-app-text" data-sort-column="fileA">File A Values <span class="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true"><span class="block leading-none text-[8px]" data-sort-dir="asc">▲</span><span class="block leading-none text-[8px]" data-sort-dir="desc">▼</span></span></button></th>
                        <th class="table-head px-4 py-3 text-left" aria-sort="none"><button type="button" class="sort-button group inline-flex items-center text-left transition-colors app-muted hover:text-app-text" data-sort-column="fileB">File B Values <span class="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true"><span class="block leading-none text-[8px]" data-sort-dir="asc">▲</span><span class="block leading-none text-[8px]" data-sort-dir="desc">▼</span></span></button></th>
                        <th class="table-head w-32 px-4 py-3 text-left" aria-sort="none"><button type="button" class="sort-button group inline-flex items-center text-left transition-colors app-muted hover:text-app-text" data-sort-column="details">Details <span class="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true"><span class="block leading-none text-[8px]" data-sort-dir="asc">▲</span><span class="block leading-none text-[8px]" data-sort-dir="desc">▼</span></span></button></th>
                      </tr>
                    </thead>
                    <tbody id="results-body" class="divide-y divide-app-border"></tbody>
                  </table>
                </div>

                <div class="status-strip">
                  <span id="generated-at"></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
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

      const filterRow = document.getElementById('filter-row');
      const resultsCount = document.getElementById('results-count');
      const resultsBody = document.getElementById('results-body');
      const resultsTable = document.getElementById('results-table');
      const emptyState = document.getElementById('table-empty-state');
      const emptyGlyph = document.getElementById('table-empty-glyph');
      const emptyCopy = document.getElementById('table-empty-copy');
      const searchInput = document.getElementById('results-search');

      document.getElementById('generated-at').textContent = 'Generated ' + new Date(data.generatedAt).toLocaleString();

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&' + 'amp;')
          .replace(/</g, '&' + 'lt;')
          .replace(/>/g, '&' + 'gt;')
          .replace(/"/g, '&' + 'quot;')
          .replace(/'/g, '&' + '#39;');
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
          return '<span class="app-muted italic">—</span>';
        }

        function formatCollapsedRow(row) {
          if (row.length === 0) {
            return '—';
          }

          return row.map((cell) => cell.value === '' ? '—' : String(cell.value)).join(', ');
        }

        return '<div class="result-value-stack value-stack app-text">' + rows.map((row) => (
          '<div class="result-value-row value-row text-[13px]">' + (row.length > 0
            ? '<span class="result-value-text" title="' + escapeHtml(formatCollapsedRow(row)) + '">' + escapeHtml(formatCollapsedRow(row)) + '</span>'
            : '—') + '</div>'
        )).join('') + '</div>';
      }

      function renderKeyChip(row) {
        const keyParts = Array.isArray(row.keyParts) && row.keyParts.length > 0
          ? row.keyParts
          : (row.result && Array.isArray(row.result.key) && row.result.key.length > 0 ? row.result.key : ['—']);
        const title = row.keyText || '—';

        return '<span class="key-chip chip app-text app-surface-subtle max-w-full border border-app-border px-2.5 py-1 font-mono text-sm font-semibold" title="' + escapeHtml(title) + '">' + keyParts.map((part) => (
          '<span class="key-chip-part">' + escapeHtml(part === '' ? '—' : part) + '</span>'
        )).join('') + '</span>';
      }

      function formatDetailValue(value, toneClass) {
        return '<span class="diff-value-box app-text ' + toneClass + ' block truncate border px-2.5 py-1.5 font-mono text-sm" title="' + escapeHtml(value) + '">' + (value === '' ? '<span class="diff-empty">—</span>' : escapeHtml(value)) + '</span>';
      }

      function renderDetailField(field, isMatch) {
        const hasColumnA = Boolean(field.columnA);
        const hasColumnB = Boolean(field.columnB);
        const sameColumn = field.columnA === field.columnB;
        const fileALabelClass = isMatch ? 'file-b text-app-success' : 'file-a text-app-danger';
        const fileAValueTone = isMatch ? 'app-surface-success-muted' : 'app-surface-danger';

        return '<div class="detail-field">'
          + ((hasColumnA || hasColumnB)
            ? '<div class="diff-card-header app-muted mb-2.5 flex flex-wrap items-start gap-2 text-xs font-medium">'
              + (hasColumnA ? '<span class="table-chip app-text max-w-full break-all">' + escapeHtml(field.columnA) + '</span>' : '')
              + (!sameColumn && hasColumnA && hasColumnB ? '<span class="icon-frame diff-arrow-box detail-header-arrow app-muted h-8 w-8 shrink-0 text-[11px]">-></span>' : '')
              + (!sameColumn && hasColumnB ? '<span class="table-chip app-text max-w-full break-all">' + escapeHtml(field.columnB) + '</span>' : '')
              + '</div>'
            : '')
          + '<div class="diff-values grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">'
          + '<p class="diff-value-label ' + fileALabelClass + ' meta-label text-[10px]">File A</p>'
          + '<div class="diff-value-column min-w-0 row-start-2">' + formatDetailValue(field.valueA, fileAValueTone) + '</div>'
          + '<p class="diff-value-label file-b meta-label col-start-3 text-[10px] text-app-success">File B</p>'
          + '<div class="icon-frame diff-arrow-box detail-value-arrow app-muted row-start-2 self-center h-7 w-7 shrink-0 text-[11px]">-></div>'
          + '<div class="diff-value-column min-w-0 col-start-3 row-start-2">' + formatDetailValue(field.valueB, 'app-surface-success-muted') + '</div>'
          + '</div>'
          + '</div>';
      }

      function renderExpandedDetail(row) {
        if (!row.expandableDetail || state.expandedRow !== row.id) {
          return '';
        }

        const detailGridClass = row.expandableDetail.variant === 'differences' ? 'diff-grid lg:grid-cols-2' : 'detail-stack';

        return '<tr class="details-row app-surface-subtle"><td colspan="5" class="px-4 py-4"><div class="surface-panel diff-panel p-4"><div class="diff-panel-header mb-3 flex items-center gap-2"><span class="diff-panel-icon app-surface-accent flex h-6 w-6 items-center justify-center border font-mono text-[11px] uppercase">+</span><p class="diff-panel-title meta-label app-text text-xs font-semibold">' + escapeHtml(row.expandableDetail.title) + '</p><span class="diff-panel-count app-muted ml-auto text-xs">' + escapeHtml(row.expandableDetail.summary) + '</span></div><div class="grid gap-3 sm:grid-cols-1 ' + detailGridClass + '">' + row.expandableDetail.panels.map((panel) => (
          '<article class="surface-panel diff-card p-3.5">'
            + (panel.label ? '<p class="detail-panel-label meta-label app-text mb-3 text-xs font-semibold">' + escapeHtml(panel.label) + '</p>' : '')
            + '<div class="detail-card-fields grid gap-3">' + panel.fields.map((field) => renderDetailField(field, row.resultType === 'match')).join('') + '</div>'
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

      function updateSortButtons() {
        document.querySelectorAll('[data-sort-column]').forEach((button) => {
          const column = button.getAttribute('data-sort-column');
          const isActive = state.sortColumn === column;
          button.classList.toggle('active', isActive);
          button.classList.toggle('app-text', isActive);
          button.classList.toggle('app-muted', !isActive);

          const th = button.closest('th');
          if (th) {
            th.setAttribute('aria-sort', isActive ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
          }

          button.querySelectorAll('[data-sort-dir]').forEach((glyph) => {
            const glyphDirection = glyph.getAttribute('data-sort-dir');
            glyph.classList.toggle('active', isActive && glyphDirection === state.sortDirection);
          });
        });
      }

      function renderFilters() {
        filterRow.innerHTML = data.filterOptions.map((option) => {
          const active = state.filter === option.value;
          return '<button type="button" class="filter-button inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium transition-colors ' + (active ? 'active filter-chip-active' : 'filter-chip') + '" data-filter="' + option.value + '" aria-pressed="' + (active ? 'true' : 'false') + '"><span class="filter-dot h-2 w-2 border tone-' + escapeHtml(option.tone || 'neutral') + '" aria-hidden="true"></span>' + escapeHtml(option.label) + '<span class="filter-count px-2 py-0.5 text-xs font-semibold tabular-nums ' + (active ? 'filter-count-active' : 'filter-count') + '">' + option.count + '</span></button>';
        }).join('');
      }

      function renderTable() {
        const visibleRows = getVisibleRows();
        const filterOnlyRows = data.rows.filter((row) => state.filter === 'all' || row.filterBucket === state.filter);

        resultsCount.textContent = visibleRows.length + ' of ' + filterOnlyRows.length + ' rows shown';

        if (filterOnlyRows.length === 0) {
          emptyGlyph.textContent = '0X';
          emptyCopy.textContent = 'No results match the selected filter.';
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
          const isExpanded = state.expandedRow === row.id;
          const detailCell = row.expandableDetail
            ? '<div class="grid gap-2">'
              + '<button type="button" class="diff-toggle inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ' + (isExpanded ? 'border-app-accent app-surface-accent-strong text-app-text' : 'app-surface-subtle border-app-border text-app-muted hover:border-app-border-strong hover:text-app-text') + '" data-expand-row="' + row.id + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' + escapeHtml(row.expandableDetail.toggleLabel) + '<span class="diff-toggle-glyph">></span></button>'
              + (row.description ? '<span class="app-text text-sm">' + escapeHtml(row.description) + '</span>' : '')
              + '</div>'
            : '<span class="text-sm ' + (row.description ? 'app-text' : 'app-muted') + '">' + escapeHtml(row.description || '—') + '</span>';

          return '<tr class="transition-colors ' + (isExpanded ? 'app-surface-accent-strong' : 'bg-transparent app-surface-hover') + '" data-result-tone="' + escapeHtml(row.badgeTone) + '">'
            + '<td class="px-4 py-3.5 align-top"><span class="badge tone-' + row.badgeTone + ' inline-flex w-fit items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]"><span class="badge-dot h-1.5 w-1.5 shrink-0" aria-hidden="true"></span>' + escapeHtml(row.badge.label) + '</span></td>'
            + '<td class="px-4 py-3.5 align-top">' + renderKeyChip(row) + '</td>'
            + '<td class="px-4 py-3.5 align-top">' + formatValueStack(row.fileAValues) + '</td>'
            + '<td class="px-4 py-3.5 align-top">' + formatValueStack(row.fileBValues) + '</td>'
            + '<td class="px-4 py-3.5 align-top">' + detailCell + '</td>'
            + '</tr>'
            + renderExpandedDetail(row);
        }).join('');

        updateSortButtons();
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
      updateSortButtons();
    </script>
  </body>
</html>`;
}
