import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { buildResultsHtmlDocument, normalizeHtmlExportTheme } from './htmlExport';
import type { MappingDto, ResultResponse, SummaryResponse } from '../../types/api';

const SUMMARY: SummaryResponse = {
  total_rows_a: 3,
  total_rows_b: 3,
  matches: 1,
  mismatches: 1,
  missing_left: 0,
  missing_right: 0,
  unkeyed_left: 0,
  unkeyed_right: 0,
  duplicates_a: 1,
  duplicates_b: 0,
};

const RESULTS: ResultResponse[] = [
  {
    result_type: 'match',
    key: ['1'],
    values_a: ['Alice'],
    values_b: ['Alice'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'mismatch',
    key: ['2'],
    values_a: ['Bob'],
    values_b: ['Robert'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [
      {
        column_a: 'name',
        column_b: 'display_name',
        value_a: 'Bob',
        value_b: 'Robert',
      },
    ],
  },
  {
    result_type: 'duplicate_file_a',
    key: ['3'],
    values_a: ['Carol'],
    values_b: ['Carol'],
    duplicate_values_a: [['Carol', 'Caroline']],
    duplicate_values_b: [],
    differences: [],
  },
];

const MAPPINGS: MappingDto[] = [
  { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
];

test('buildResultsHtmlDocument embeds the current comparison view state for standalone review', () => {
  const html = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: RESULTS,
    initialFilter: 'duplicate',
  });

  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('<html lang="en" class="dark" data-theme="dark">');
  expect(html).toContain('<title>left.csv vs right.csv comparison results</title>');
  expect(html).toContain('Step 3 · Results');
  expect(html).toContain('<span class="text-lg">Comparison Summary</span>');
  expect(html).toContain('left.csv vs right.csv comparison results');
  expect(html).toContain('aria-label="Compared files"');
  expect(html).toContain('<div class="hud-label">File A</div>');
  expect(html).toContain('class="app-muted file-name mt-1 max-w-[280px] truncate text-xs" title="left.csv"');
  expect(html).toContain('<div class="hud-label">File B</div>');
  expect(html).toContain('class="app-muted file-name mt-1 max-w-[280px] truncate text-xs" title="right.csv"');
  expect(html).toContain('Match rate of comparable rows');
  expect(html).toContain('How each comparable row was classified.');
  expect(html).toContain('Duplicate keys detected');
  expect(html).toContain('"initialFilter":"duplicate"');
  expect(html).toContain('"label":"Duplicates","count":1,"tone":"duplicate"');
  expect(html).toContain('"badgeLabel":"Mismatch"');
  expect(html).toContain('"fileAValues":[[{"column":"name","value":"Bob"}]]');
  expect(html).toContain('"fileBValues":[[{"column":"display_name","value":"Robert"}]]');
  expect(html).toContain('"expandableDetail":{"variant":"inspection","title":"Paired Values"');
  expect(html).toContain('"description":"Multiple File A rows share this selected key."');
  expect(html).toContain('data-sort-column="details"');
  expect(html).toContain('<table id="results-table" class="results-table w-full">');
  expect(html).toContain('data-expand-row=');
  expect(html).toContain('"title":"Value Differences"');
  expect(html).toContain('row.expandableDetail.title');
  expect(html).toContain('row.expandableDetail.summary');
  expect(html).toContain("row.expandableDetail.variant === 'differences' ? 'diff-grid lg:grid-cols-2' : 'detail-stack'");
  expect(html).toContain('option.tone || \'neutral\'');
  expect(html).not.toContain('getFilterDotStyle');
  expect(html).toContain('field.columnA');
  expect(html).toContain('class="icon-frame diff-arrow-box detail-value-arrow app-muted row-start-2 self-center h-7 w-7 shrink-0 text-[11px]">-></div>');
  expect(html).not.toContain('cell.column ? \'<span class="table-chip app-text">\' + escapeHtml(cell.column) + \'</span>\' : \'\'');
  expect(html).toContain('class="diff-value-label ' + "' + fileALabelClass + '" + ' meta-label text-[10px]">File A</p>');
  expect(html).toContain("formatDetailValue(field.valueB, 'app-surface-success-muted')");
  expect(html).toContain("const fileALabelClass = isMatch ? 'file-b text-app-success' : 'file-a text-app-danger';");
  expect(html).toContain("const fileAValueTone = isMatch ? 'app-surface-success-muted' : 'app-surface-danger';");
  expect(html).toContain('class="detail-field"');
  expect(html).toContain('class="detail-panel-label meta-label app-text mb-3 text-xs font-semibold"');
  expect(html).toContain('class="detail-card-fields grid gap-3"');
  expect(html).toContain('class="detail-cell-stack grid gap-2"');
  expect(html).toContain('row.description ? \'<span class="detail-description app-text text-sm">\' + escapeHtml(row.description) + \'</span>\' : \'\'');
  expect(html).toContain('.detail-cell-stack {');
  expect(html).toContain('justify-items: start;');
  expect(html).toContain('.detail-description {');
  expect(html).toContain('max-width: 14rem;');
  expect(html).toContain('color-scheme: dark;');
  expect(html).toContain('[data-theme="dark"] {');
  expect(html).toContain('--color-app-bg: #030712;');
  expect(html).toContain('--color-app-success: #34d399;');
  expect(html).toContain('background: var(--color-app-bg);');
  expect(html).not.toContain('radial-gradient(circle at top');
  expect(html).toContain('.summary-file-panel');
  expect(html).toContain('.diff-card');
  expect(html).toContain('.detail-stack');
  expect(html).toContain('.detail-card-fields');
  expect(html).toContain('.detail-header-arrow');
  expect(html).toContain('.detail-value-arrow');
  expect(html).toContain('.diff-values > .diff-value-label.file-a');
  expect(html).toContain('.diff-values > .diff-value-label.file-b');
  expect(html).toContain('.diff-values > .detail-value-arrow + .diff-value-column');
  expect(html).toContain('grid-column: 3;');
  expect(html).toContain('.section-card-header');
  expect(html).toContain('.status-strip');
});

test('standalone export includes visible match progress fill styling', () => {
  const html = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: RESULTS,
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const progress = parsed.querySelector<HTMLElement>('.summary-progress');
  const fill = progress?.querySelector<HTMLElement>('.app-progress-fill');
  const styles = Array.from(parsed.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');

  expect(progress).toBeTruthy();
  expect(progress?.classList.contains('app-frame')).toBe(true);
  expect(fill).toBeTruthy();
  expect(fill?.style.width).toBe('50%');
  expect(styles).toMatch(/\.app-progress-fill\s*\{[^}]*display:\s*block;[^}]*height:\s*100%;/s);
});

test('normalizes every exported theme input to the single dark report theme', () => {
  expect(normalizeHtmlExportTheme('cyan')).toBe('dark');
  expect(normalizeHtmlExportTheme('lime')).toBe('dark');
  expect(normalizeHtmlExportTheme('magenta')).toBe('dark');
  expect(normalizeHtmlExportTheme('amber')).toBe('dark');
  expect(normalizeHtmlExportTheme('dark')).toBe('dark');
  expect(normalizeHtmlExportTheme(undefined)).toBe('dark');

  const themedHtml = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: RESULTS,
    initialFilter: 'all',
    theme: 'magenta',
  });
  const fallbackHtml = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: RESULTS,
    initialFilter: 'all',
    theme: 'unsupported-theme',
  });

  expect(themedHtml).toContain('<html lang="en" class="dark" data-theme="dark">');
  expect(themedHtml).toContain('"theme":"dark"');
  expect(themedHtml).not.toContain('"theme":"magenta"');
  expect(fallbackHtml).toContain('<html lang="en" class="dark" data-theme="dark">');
  expect(fallbackHtml).toContain('"theme":"dark"');
  expect(fallbackHtml).not.toContain('"theme":"cyan"');
});

test('standalone export stacks multi-part keys inside the compact key chip after the embedded script runs', () => {
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 1,
      mismatches: 0,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: [
      {
        result_type: 'match',
        key: ['71', '7'],
        values_a: ['Alice'],
        values_b: ['Alice'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  expect(html).toContain('"keyParts":["71","7"]');
  expect(html).toContain('results-key-column');
  expect(html).toContain('results-key-cell');
  expect(html).toContain('.results-table {');
  expect(html).toContain('min-width: 960px;');
  expect(html).toContain('.results-key-column,');
  expect(html).toContain('width: clamp(14rem, 22vw, 18rem);');
  expect(html).toContain('.key-chip {');
  expect(html).toContain('.key-chip-part {');
  expect(html).toContain('overflow-wrap: break-word;');
  expect(html).toContain('word-break: normal;');

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const resultsBody = document.getElementById('results-body');
  const keyChip = resultsBody?.querySelector('.key-chip');
  expect(keyChip).toBeTruthy();
  expect(keyChip).toHaveClass('chip');
  expect(keyChip).not.toHaveClass('truncate');
  expect(keyChip).toHaveAttribute('title', '71, 7');

  const parts = Array.from(keyChip?.querySelectorAll('.key-chip-part') ?? []);
  expect(parts).toHaveLength(2);
  expect(parts.map((part) => part.textContent)).toEqual(['71', '7']);

  document.body.innerHTML = '';
});

test('standalone export escapes key-chip parts before inserting table HTML', () => {
  const unsafeKeyPart = '<img src=x onerror=alert(1)>';
  const unsafeAttributePart = '" onclick="alert(1)';
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 1,
      mismatches: 0,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: [
      {
        result_type: 'match',
        key: [unsafeKeyPart, unsafeAttributePart],
        values_a: ['Alice'],
        values_b: ['Alice'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const keyChip = document.querySelector('.key-chip');
  const parts = Array.from(keyChip?.querySelectorAll('.key-chip-part') ?? []);
  expect(parts.map((part) => part.textContent)).toEqual([unsafeKeyPart, unsafeAttributePart]);
  expect(keyChip).toHaveAttribute('title', `${unsafeKeyPart}, ${unsafeAttributePart}`);
  expect(keyChip?.querySelector('img')).toBeNull();
  expect(keyChip?.querySelector('[onerror]')).toBeNull();
  expect(keyChip?.querySelector('[onclick]')).toBeNull();

  document.body.innerHTML = '';
});

test('standalone export table count matches the active filter bucket after the embedded script runs', () => {
  const html = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: RESULTS,
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  expect(script?.textContent).toBeTruthy();

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const resultsCount = document.getElementById('results-count');
  const resultsBody = document.getElementById('results-body');
  expect(resultsCount?.textContent).toBe('3 of 3 rows shown');
  expect(resultsBody?.textContent).not.toContain('display_name');
  expect(resultsBody?.textContent).toContain('Carol, Caroline');

  const inspectToggle = (Array.from(document.querySelectorAll('[data-expand-row]')) as HTMLButtonElement[]).find(
    (button) => button.textContent?.includes('Inspect'),
  );

  expect(inspectToggle).toBeTruthy();
  inspectToggle?.click();

  expect(document.body.textContent).toContain('Paired Values');
  expect(document.body.textContent).toContain('Alice');
  expect(resultsBody?.textContent).toContain('name');
  expect(resultsBody?.textContent).toContain('display_name');
  expect(resultsBody?.textContent).toContain('Carol, Caroline');
  expect(resultsBody?.querySelector('.detail-card-fields')).toBeTruthy();
  expect(resultsBody?.querySelector('.detail-header-arrow')).toBeTruthy();
  expect(resultsBody?.querySelector('.detail-value-arrow')).toBeTruthy();

  const duplicateFilter = (Array.from(document.querySelectorAll('[data-filter]')) as HTMLButtonElement[]).find(
    (button) => button.getAttribute('data-filter') === 'duplicate',
  );

  expect(duplicateFilter).toBeTruthy();
  expect(duplicateFilter?.querySelector('.filter-dot')).toHaveClass('tone-duplicate');
  duplicateFilter?.click();

  expect(resultsCount?.textContent).toBe('1 of 1 rows shown');

  document.body.innerHTML = '';
});

test('standalone export stacks inspect actions above one-sided detail text', () => {
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 0,
      matches: 0,
      mismatches: 0,
      missing_left: 0,
      missing_right: 1,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: [
      {
        result_type: 'missing_right',
        key: ['only-left'],
        values_a: ['Only Left'],
        values_b: [],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');
  const styles = Array.from(parsed.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');

  expect(styles).toMatch(/\.detail-cell-stack\s*\{[^}]*display:\s*grid;[^}]*gap:\s*8px;/s);
  expect(styles).toMatch(/\.detail-description\s*\{[^}]*display:\s*block;[^}]*max-width:\s*14rem;/s);

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const detailStack = document.querySelector('.detail-cell-stack');
  const inspectToggle = detailStack?.querySelector('button[data-expand-row]');
  const description = detailStack?.querySelector('.detail-description');

  expect(detailStack).toBeTruthy();
  expect(inspectToggle?.textContent).toContain('Inspect');
  expect(description?.textContent).toBe('Present only in File A for the selected key.');
  expect(inspectToggle?.nextElementSibling).toBe(description);

  document.body.innerHTML = '';
});

test('standalone export uses the shared inspect panel for zero-diff mismatch rows', () => {
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 0,
      mismatches: 1,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: [
      {
        result_type: 'mismatch',
        key: ['zero-diff'],
        values_a: ['Same'],
        values_b: ['Same'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const inspectToggle = screen.getByRole('button', { name: /inspect/i });
  fireEvent.click(inspectToggle);

  expect(document.body.textContent).toContain('Paired Values');
  expect(document.body.textContent).toContain('Same');

  document.body.innerHTML = '';
});

test('standalone export keeps paired-value labels aligned to explicit mappings for null-equal rows', () => {
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 1,
      mismatches: 0,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['first_name', 'nickname'],
    comparisonColumnsB: ['alias', 'full_name'],
    mappings: [
      { file_a_column: 'first_name', file_b_column: 'full_name', mapping_type: 'manual' },
      { file_a_column: 'nickname', file_b_column: 'alias', mapping_type: 'manual' },
    ],
    results: [
      {
        result_type: 'match',
        key: ['mapped-match'],
        values_a: ['Alice', ''],
        values_b: ['null', 'Alice'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  expect(html).toContain('"columnA":"first_name","columnB":"full_name","valueA":"Alice","valueB":"Alice"');
  expect(html).toContain('"columnA":"nickname","columnB":"alias","valueA":"","valueB":"null"');
  expect(html).toContain('"fileBValues":[[{"column":"alias","value":"null"},{"column":"full_name","value":"Alice"}]]');
});

test('standalone export uses green-green inspection tones for match rows and split tones for mismatches', () => {
  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 2,
      total_rows_b: 2,
      matches: 1,
      mismatches: 1,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
    mappings: MAPPINGS,
    results: [
      {
        result_type: 'match',
        key: ['match-tone'],
        values_a: ['Match Left'],
        values_b: ['Match Right'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
      {
        result_type: 'mismatch',
        key: ['mismatch-tone'],
        values_a: ['Mismatch Left'],
        values_b: ['Mismatch Right'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  let toggles = Array.from(document.querySelectorAll('[data-expand-row]')) as HTMLButtonElement[];
  toggles[0]?.click();

  let valueBoxes = Array.from(document.querySelectorAll('.diff-value-box'));
  expect(valueBoxes[0]).toHaveClass('app-surface-success-muted');
  expect(valueBoxes[1]).toHaveClass('app-surface-success-muted');

  toggles = Array.from(document.querySelectorAll('[data-expand-row]')) as HTMLButtonElement[];
  toggles[1]?.click();

  valueBoxes = Array.from(document.querySelectorAll('.diff-value-box'));
  expect(valueBoxes[0]).toHaveClass('app-surface-danger');
  expect(valueBoxes[1]).toHaveClass('app-surface-success-muted');

  document.body.innerHTML = '';
});

test('standalone export wraps long collapsed result values instead of forcing a single truncated line', () => {
  const longFileA = 'AlphaSegmentOne,AlphaSegmentTwo,AlphaSegmentThree,AlphaSegmentFour';
  const longFileB = 'BravoSegmentOne,BravoSegmentTwo,BravoSegmentThree,BravoSegmentFour';

  const html = buildResultsHtmlDocument({
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 1,
      mismatches: 0,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    comparisonColumnsA: ['name', 'nickname'],
    comparisonColumnsB: ['display_name', 'alias'],
    mappings: [
      { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
      { file_a_column: 'nickname', file_b_column: 'alias', mapping_type: 'manual' },
    ],
    results: [
      {
        result_type: 'match',
        key: ['wrapped-values'],
        values_a: [longFileA, 'Bravo'],
        values_b: [longFileB, 'Delta'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    initialFilter: 'all',
  });

  expect(html).toContain('.result-value-text {');
  expect(html).toContain('white-space: normal;');
  expect(html).toContain('overflow-wrap: anywhere;');

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const script = parsed.querySelector('script:not([type="application/json"])');

  document.body.innerHTML = parsed.body.innerHTML;
  // eslint-disable-next-line no-new-func
  Function(script?.textContent ?? '')();

  const wrappedValue = document.querySelector(`[title="${CSS.escape(`${longFileA}, Bravo`)}"]`);
  expect(wrappedValue).toHaveClass('result-value-text');
  expect(wrappedValue?.textContent).toBe(`${longFileA}, Bravo`);

  document.body.innerHTML = '';
});
