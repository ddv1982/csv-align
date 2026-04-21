import type { ResultFilter, SummaryResponse } from '../../types/api';
import { buildSummaryOverview, type ResultRowViewModel, type SummaryBannerViewModel, type SummaryStatViewModel } from './presentation';
import { RESULTS_EXPORT_STYLES } from './htmlExportTheme';

type HtmlExportDocument = {
  generatedAt: string;
  fileAName: string;
  fileBName: string;
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number }>;
  initialFilter: ResultFilter;
  rows: ResultRowViewModel[];
};

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummaryStats(stats: SummaryStatViewModel[]): string {
  return stats
    .map(
      (stat) => `<div class="kinetic-panel summary-stat kinetic-tone-${stat.tone}">
                <div class="summary-stat-head">
                  <div class="summary-stat-icon kinetic-tone-${stat.tone}-strong">${escapeHtmlText(stat.icon)}</div>
                  <span class="summary-stat-value kinetic-copy">${stat.value}</span>
                </div>
                <p class="summary-stat-label kinetic-copy">${escapeHtmlText(stat.label)}</p>
                <p class="summary-stat-description kinetic-muted">${escapeHtmlText(stat.description)}</p>
              </div>`,
    )
    .join('');
}

function renderSummaryBanners(banners: SummaryBannerViewModel[]): string {
  if (banners.length === 0) {
    return '';
  }

  return `<div class="summary-banners">${banners
    .map(
      (banner) => `<div class="kinetic-panel summary-banner kinetic-tone-${banner.tone}">
                <div class="summary-banner-icon kinetic-tone-${banner.tone}-strong">${escapeHtmlText(banner.icon)}</div>
                <div class="summary-banner-copy">
                  <p class="summary-banner-title kinetic-copy">${escapeHtmlText(banner.title)}</p>
                  <p class="summary-banner-summary kinetic-copy">${escapeHtmlText(banner.summary)}</p>
                  ${banner.details
                    .map((detail) => `<p class="summary-banner-detail kinetic-muted">${escapeHtmlText(detail)}</p>`)
                    .join('')}
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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentTitle}</title>
    <style>
${RESULTS_EXPORT_STYLES}
    </style>
  </head>
  <body>
    <div class="kinetic-shell">
      <div class="shell stack">
        <section class="card">
          <div class="section-card-header">
            <div class="section-card-heading">
              <div class="section-card-icon kinetic-tone-accent-strong">SUM</div>
              <div class="section-card-copy">
                <p class="hud-label" style="color: var(--color-kinetic-accent);">Step 3 · Results</p>
                <h1><span class="kinetic-copy">Comparison Summary</span></h1>
                <p class="kinetic-muted">Review the overall match quality before drilling into filtered result rows.</p>
              </div>
            </div>
            <div class="section-card-action summary-file-grid" aria-label="Compared files">
              <div class="kinetic-panel summary-file-panel">
                <p class="hud-label">File A</p>
                <p class="kinetic-muted"><span class="kinetic-copy">${data.summary.total_rows_a}</span> rows</p>
                <p class="kinetic-muted file-name" title="${fileAName}">${fileAName}</p>
              </div>
              <div class="kinetic-panel summary-file-panel">
                <p class="hud-label">File B</p>
                <p class="kinetic-muted"><span class="kinetic-copy">${data.summary.total_rows_b}</span> rows</p>
                <p class="kinetic-muted file-name" title="${fileBName}">${fileBName}</p>
              </div>
            </div>
          </div>
          <div class="section-card-body summary-main">
            <div class="kinetic-panel summary-match-rate">
              <div class="summary-match-rate-head">
                <div>
                  <p class="hud-label">Match rate</p>
                  <p class="kinetic-copy" style="margin-top: 4px; font-size: 14px; font-weight: 500;">Match rate of comparable rows</p>
                </div>
                <div class="summary-match-rate-value">
                  <span class="display-title kinetic-copy">${matchPercent}%</span>
                  <span class="kinetic-muted" style="font-size: 12px;">${data.summary.matches} of ${comparableTotal} rows</span>
                </div>
              </div>
              <div class="kinetic-frame summary-progress">
                <div class="kinetic-progress-fill" style="width: ${matchPercent}%;"></div>
              </div>
            </div>

            <div>
              <div style="margin-bottom: 12px;">
                <p class="hud-label">Outcome breakdown</p>
                <p class="kinetic-muted" style="margin-top: 4px; font-size: 14px;">How each comparable row was classified.</p>
              </div>
              <div class="summary-stat-grid">${renderSummaryStats(comparableStats)}</div>
            </div>

            ${renderSummaryBanners(infoBanners)}
          </div>
        </section>

        <section class="card">
          <div class="section-card-header">
            <div class="section-card-heading">
              <div class="section-card-icon kinetic-tone-accent-strong">FLT</div>
              <div class="section-card-copy">
                <p class="hud-label" style="color: var(--color-kinetic-accent);">Results filter</p>
                <h2><span class="kinetic-copy">Focus on the rows you care about</span></h2>
                <p class="kinetic-muted">Switch between result buckets while reviewing the exported comparison.</p>
              </div>
            </div>
          </div>
          <div class="section-card-body">
            <div id="filter-row" class="filter-row" role="group" aria-label="Result buckets"></div>
          </div>
        </section>

        <section class="card table-card">
          <div class="section-card-header">
            <div class="section-card-heading">
              <div class="section-card-icon kinetic-tone-accent-strong">RES</div>
              <div class="section-card-copy">
                <p class="hud-label" style="color: var(--color-kinetic-accent);">Detailed results</p>
                <h2><span class="kinetic-copy">Comparison results</span></h2>
                <p id="results-count" class="kinetic-muted"></p>
              </div>
            </div>
            <div class="section-card-action">
              <label class="search-wrap" for="results-search">
                <span style="position:absolute;left:-9999px;">Search result values</span>
                <input id="results-search" class="input" type="search" placeholder="Search keys or values" aria-label="Search keys or values" />
              </label>
            </div>
          </div>

          <div class="section-card-body" style="gap: 0; margin-top: 16px;">
            <div id="table-empty-state" class="empty-state" hidden>
              <div id="table-empty-glyph" class="kinetic-empty-glyph kinetic-muted"></div>
              <p id="table-empty-copy" class="kinetic-muted"></p>
            </div>

            <div class="table-wrap">
              <table id="results-table">
                <thead>
                  <tr>
                    <th class="kinetic-table-head" aria-sort="none"><button type="button" class="sort-button" data-sort-column="type">Type <span class="sort-glyph" aria-hidden="true"><span data-sort-dir="asc">▲</span><span data-sort-dir="desc">▼</span></span></button></th>
                    <th class="kinetic-table-head" aria-sort="none"><button type="button" class="sort-button" data-sort-column="key">Key <span class="sort-glyph" aria-hidden="true"><span data-sort-dir="asc">▲</span><span data-sort-dir="desc">▼</span></span></button></th>
                    <th class="kinetic-table-head" aria-sort="none"><button type="button" class="sort-button" data-sort-column="fileA">File A Values <span class="sort-glyph" aria-hidden="true"><span data-sort-dir="asc">▲</span><span data-sort-dir="desc">▼</span></span></button></th>
                    <th class="kinetic-table-head" aria-sort="none"><button type="button" class="sort-button" data-sort-column="fileB">File B Values <span class="sort-glyph" aria-hidden="true"><span data-sort-dir="asc">▲</span><span data-sort-dir="desc">▼</span></span></button></th>
                    <th class="kinetic-table-head" aria-sort="none"><button type="button" class="sort-button" data-sort-column="details">Details <span class="sort-glyph" aria-hidden="true"><span data-sort-dir="asc">▲</span><span data-sort-dir="desc">▼</span></span></button></th>
                  </tr>
                </thead>
                <tbody id="results-body"></tbody>
              </table>
            </div>

            <div class="status-strip">
              <span id="generated-at"></span>
            </div>
          </div>
        </section>
      </div>
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

      function getFilterDotStyle(filterValue) {
        switch (filterValue) {
          case 'match':
            return 'style="color: var(--color-kinetic-success);"';
          case 'mismatch':
          case 'duplicate':
            return 'style="color: var(--color-kinetic-warning);"';
          case 'missing_left':
          case 'unkeyed_left':
            return 'style="color: var(--color-kinetic-accent);"';
          case 'missing_right':
          case 'unkeyed_right':
            return 'style="color: var(--color-kinetic-danger);"';
          default:
            return 'style="color: var(--color-kinetic-muted);"';
        }
      }

      function formatValueStack(rows) {
        if (rows.length === 0) {
          return '<span class="kinetic-muted" style="font-style: italic;">-</span>';
        }

        function formatCollapsedRow(row) {
          if (row.length === 0) {
            return '-';
          }

          return row.map((cell) => cell.value === '' ? '-' : String(cell.value)).join(', ');
        }

        return '<div class="value-stack">' + rows.map((row) => (
          '<div class="value-row">' + (row.length > 0
            ? '<span class="kinetic-copy kinetic-value-text" title="' + escapeHtml(formatCollapsedRow(row)) + '">' + escapeHtml(formatCollapsedRow(row)) + '</span>'
            : '-') + '</div>'
        )).join('') + '</div>';
      }

      function formatDetailValue(value, toneClass) {
        return '<span class="diff-value-box kinetic-copy ' + toneClass + '" title="' + escapeHtml(value) + '">' + (value === '' ? '<span class="diff-empty">-</span>' : escapeHtml(value)) + '</span>';
      }

      function renderDetailField(field) {
        const hasColumnA = Boolean(field.columnA);
        const hasColumnB = Boolean(field.columnB);
        const sameColumn = field.columnA === field.columnB;

        return '<div>'
          + ((hasColumnA || hasColumnB)
            ? '<header class="diff-card-header kinetic-muted">'
              + (hasColumnA ? '<span class="table-chip kinetic-copy">' + escapeHtml(field.columnA) + '</span>' : '')
              + (!sameColumn && hasColumnA && hasColumnB ? '<span class="kinetic-glyph-box diff-arrow-box kinetic-muted">-&gt;</span>' : '')
              + (!sameColumn && hasColumnB ? '<span class="table-chip kinetic-copy">' + escapeHtml(field.columnB) + '</span>' : '')
              + '</header>'
            : '')
          + '<div class="diff-values">'
          + '<div><span class="diff-value-label file-a">File A</span>' + formatDetailValue(field.valueA, 'kinetic-surface-danger') + '</div>'
          + '<div class="kinetic-glyph-box diff-arrow-box kinetic-muted">-&gt;</div>'
          + '<div><span class="diff-value-label file-b">File B</span>' + formatDetailValue(field.valueB, 'kinetic-surface-success-muted') + '</div>'
          + '</div>'
          + '</div>';
      }

      function renderExpandedDetail(row) {
        if (!row.expandableDetail || state.expandedRow !== row.id) {
          return '';
        }

        const detailGridClass = row.expandableDetail.variant === 'differences' ? 'diff-grid' : 'detail-stack';

        return '<tr class="details-row"><td colspan="5"><div class="kinetic-panel diff-panel"><div class="diff-panel-header"><span class="diff-panel-icon">+</span><span class="diff-panel-title kinetic-copy">' + escapeHtml(row.expandableDetail.title) + '</span><span class="diff-panel-count">' + escapeHtml(row.expandableDetail.summary) + '</span></div><div class="' + detailGridClass + '">' + row.expandableDetail.panels.map((panel) => (
          '<article class="kinetic-panel diff-card">'
            + (panel.label ? '<p class="kinetic-copy" style="margin:0 0 12px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;">' + escapeHtml(panel.label) + '</p>' : '')
            + panel.fields.map((field) => renderDetailField(field)).join('')
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
        filterRow.innerHTML = data.filterOptions.map((option) => (
          '<button type="button" class="filter-button' + (state.filter === option.value ? ' active' : '') + '" data-filter="' + option.value + '" aria-pressed="' + (state.filter === option.value ? 'true' : 'false') + '"><span class="filter-dot" ' + getFilterDotStyle(option.value) + '></span>' + escapeHtml(option.label) + '<span class="filter-count">' + option.count + '</span></button>'
        )).join('');
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
            ? '<div style="display:grid;gap:8px;">'
              + '<button type="button" class="diff-toggle" data-expand-row="' + row.id + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' + escapeHtml(row.expandableDetail.toggleLabel) + '<span class="diff-toggle-glyph">&gt;</span></button>'
              + (row.description ? '<span class="result-description">' + escapeHtml(row.description) + '</span>' : '')
              + '</div>'
            : '<span class="result-description">' + escapeHtml(row.description || '-') + '</span>';

          return '<tr class="' + (isExpanded ? 'kinetic-surface-accent-strong' : 'kinetic-surface-hover') + '">'
            + '<td><span class="badge tone-' + row.badgeTone + '"><span class="badge-dot"></span>' + escapeHtml(row.badge.label) + '</span></td>'
            + '<td><span class="chip kinetic-copy" title="' + escapeHtml(row.keyText) + '">' + escapeHtml(row.keyText) + '</span></td>'
             + '<td>' + formatValueStack(row.fileAValues) + '</td>'
             + '<td>' + formatValueStack(row.fileBValues) + '</td>'
             + '<td>' + detailCell + '</td>'
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
