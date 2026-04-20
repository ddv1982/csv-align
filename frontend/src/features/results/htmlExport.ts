import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import {
  RESULT_FILTER_OPTIONS,
  getResultBadge,
  getResultDescription,
  getResultFilterCounts,
  getResultLabel,
} from './presentation';

type SortColumn = 'type' | 'key' | 'fileA' | 'fileB' | 'details';

type ExportRow = {
  id: string;
  resultType: ResultResponse['result_type'];
  filterBucket: Exclude<ResultFilter, 'all'> | 'duplicate';
  badgeLabel: string;
  badgeTone:
    | 'match'
    | 'mismatch'
    | 'missing-left'
    | 'missing-right'
    | 'unkeyed-left'
    | 'unkeyed-right'
    | 'duplicate'
    | 'neutral';
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

type SummaryStatTone = 'success' | 'warning' | 'accent' | 'danger';

type SummaryStat = {
  label: string;
  value: number;
  description: string;
  tone: SummaryStatTone;
  icon: string;
};

type SummaryBanner = {
  title: string;
  summary: string;
  details: string[];
  tone: 'accent' | 'warning';
  icon: string;
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

function getComparableTotal(summary: SummaryResponse): number {
  return summary.matches + summary.mismatches + summary.missing_left + summary.missing_right;
}

function describeComparableShare(value: number, comparableTotal: number): string {
  return comparableTotal > 0
    ? `${Math.round((value / comparableTotal) * 100)}% of comparable rows`
    : 'No comparable rows';
}

function buildSummaryStats(summary: SummaryResponse): SummaryStat[] {
  const comparableTotal = getComparableTotal(summary);

  return [
    {
      label: 'Matches',
      value: summary.matches,
      description: describeComparableShare(summary.matches, comparableTotal),
      tone: 'success',
      icon: 'OK',
    },
    {
      label: 'Mismatches',
      value: summary.mismatches,
      description: describeComparableShare(summary.mismatches, comparableTotal),
      tone: 'warning',
      icon: '!!',
    },
    {
      label: getResultLabel('missing_left'),
      value: summary.missing_left,
      description: describeComparableShare(summary.missing_left, comparableTotal),
      tone: 'accent',
      icon: 'A',
    },
    {
      label: getResultLabel('missing_right'),
      value: summary.missing_right,
      description: describeComparableShare(summary.missing_right, comparableTotal),
      tone: 'danger',
      icon: 'B',
    },
  ];
}

function buildSummaryBanners(summary: SummaryResponse): SummaryBanner[] {
  const ignoredTotal = summary.unkeyed_left + summary.unkeyed_right;
  const banners: SummaryBanner[] = [];

  if (ignoredTotal > 0) {
    banners.push({
      title: 'Ignored rows',
      summary: `${summary.unkeyed_right} in File A, ${summary.unkeyed_left} in File B`,
      details: [
        'Ignored rows were not compared because the selected key was empty or matched a missing-value token after cleanup settings.',
        'Ignored rows may correspond to one-sided results on the other file, but they could not be matched confidently by key.',
      ],
      tone: 'accent',
      icon: 'i',
    });
  }

  if (summary.duplicates_a > 0 || summary.duplicates_b > 0) {
    banners.push({
      title: 'Duplicate keys detected',
      summary: `Duplicates found: ${summary.duplicates_a} in File A, ${summary.duplicates_b} in File B`,
      details: ['Rows with duplicate selected keys can produce repeated matches or one-sided results and are worth reviewing before export.'],
      tone: 'warning',
      icon: '!!',
    });
  }

  return banners;
}

function renderSummaryStats(summary: SummaryResponse): string {
  return buildSummaryStats(summary)
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

function renderSummaryBanners(summary: SummaryResponse): string {
  const banners = buildSummaryBanners(summary);

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
  const comparableTotal = getComparableTotal(params.summary);
  const matchPercent = comparableTotal > 0 ? Math.round((params.summary.matches / comparableTotal) * 100) : 0;
  const summaryStatsMarkup = renderSummaryStats(params.summary);
  const summaryBannersMarkup = renderSummaryBanners(params.summary);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${documentTitle}</title>
    <style>
      :root {
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
      }
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
                <p class="kinetic-muted"><span class="kinetic-copy">${params.summary.total_rows_a}</span> rows</p>
                <p class="kinetic-muted file-name" title="${fileAName}">${fileAName}</p>
              </div>
              <div class="kinetic-panel summary-file-panel">
                <p class="hud-label">File B</p>
                <p class="kinetic-muted"><span class="kinetic-copy">${params.summary.total_rows_b}</span> rows</p>
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
                  <span class="kinetic-muted" style="font-size: 12px;">${params.summary.matches} of ${comparableTotal} rows</span>
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
              <div class="summary-stat-grid">${summaryStatsMarkup}</div>
            </div>

            ${summaryBannersMarkup}
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

        return '<div class="value-stack">' + rows.map((row) => (
          '<div class="value-row">' + escapeHtml(row.length > 0 ? row.join(', ') : '-') + '</div>'
        )).join('') + '</div>';
      }

      function renderDifferences(row) {
        if (row.differences.length === 0 || state.expandedRow !== row.id) {
          return '';
        }

        return '<tr class="details-row"><td colspan="5"><div class="kinetic-panel diff-panel"><div class="diff-panel-header"><span class="diff-panel-icon">+</span><span class="diff-panel-title kinetic-copy">Value Differences</span><span class="diff-panel-count">' + row.differences.length + ' field' + (row.differences.length === 1 ? '' : 's') + '</span></div><div class="diff-grid">' + row.differences.map((diff) => (
          '<article class="kinetic-panel diff-card">'
            + '<header class="diff-card-header kinetic-muted"><span class="table-chip kinetic-copy">' + escapeHtml(diff.column_a) + '</span>'
            + (diff.column_a === diff.column_b ? '' : '<span class="kinetic-glyph-box diff-arrow-box kinetic-muted">-&gt;</span><span class="table-chip kinetic-copy">' + escapeHtml(diff.column_b) + '</span>')
            + '</header>'
            + '<div class="diff-values">'
            + '<div><span class="diff-value-label file-a">File A</span><span class="diff-value-box kinetic-copy kinetic-surface-danger" title="' + escapeHtml(diff.value_a) + '">' + (diff.value_a === '' ? '<span class="diff-empty">-</span>' : escapeHtml(diff.value_a)) + '</span></div>'
            + '<div class="kinetic-glyph-box diff-arrow-box kinetic-muted">-&gt;</div>'
            + '<div><span class="diff-value-label file-b">File B</span><span class="diff-value-box kinetic-copy kinetic-surface-success-muted" title="' + escapeHtml(diff.value_b) + '">' + (diff.value_b === '' ? '<span class="diff-empty">-</span>' : escapeHtml(diff.value_b)) + '</span></div>'
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
          const detailCell = row.detailsCount > 0
            ? '<button type="button" class="diff-toggle" data-expand-row="' + row.id + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' + row.detailsCount + ' diff' + (row.detailsCount === 1 ? '' : 's') + '<span class="diff-toggle-glyph">&gt;</span></button>'
            : '<span class="result-description">' + escapeHtml(row.description || '-') + '</span>';

          return '<tr class="' + (isExpanded ? 'kinetic-surface-accent-strong' : 'kinetic-surface-hover') + '">'
            + '<td><span class="badge tone-' + row.badgeTone + '"><span class="badge-dot"></span>' + escapeHtml(row.badgeLabel) + '</span></td>'
            + '<td><span class="chip kinetic-copy" title="' + escapeHtml(row.keyText) + '">' + escapeHtml(row.keyText) + '</span></td>'
            + '<td>' + formatValueStack(row.fileAValues) + '</td>'
            + '<td>' + formatValueStack(row.fileBValues) + '</td>'
            + '<td>' + detailCell + '</td>'
            + '</tr>'
            + renderDifferences(row);
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
