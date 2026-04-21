import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { buildResultsHtmlDocument } from './htmlExport';
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
  expect(html).toContain('<title>left.csv vs right.csv comparison results</title>');
  expect(html).toContain('Step 3 · Results');
  expect(html).toContain('<h1><span class="kinetic-copy">Comparison Summary</span></h1>');
  expect(html).toContain('left.csv vs right.csv comparison results');
  expect(html).toContain('aria-label="Compared files"');
  expect(html).toContain('<p class="hud-label">File A</p>');
  expect(html).toContain('<p class="kinetic-muted file-name" title="left.csv">left.csv</p>');
  expect(html).toContain('<p class="hud-label">File B</p>');
  expect(html).toContain('<p class="kinetic-muted file-name" title="right.csv">right.csv</p>');
  expect(html).toContain('Match rate of comparable rows');
  expect(html).toContain('How each comparable row was classified.');
  expect(html).toContain('Duplicate keys detected');
  expect(html).toContain('"initialFilter":"duplicate"');
  expect(html).toContain('"label":"Duplicates","count":1');
  expect(html).toContain('"badgeLabel":"Mismatch"');
  expect(html).toContain('"fileAValues":[[{"column":"name","value":"Bob"}]]');
  expect(html).toContain('"fileBValues":[[{"column":"display_name","value":"Robert"}]]');
  expect(html).toContain('"expandableDetail":{"variant":"inspection","title":"Paired Values"');
  expect(html).toContain('"description":"Multiple File A rows share this selected key."');
  expect(html).toContain('data-sort-column="details"');
  expect(html).toContain('data-expand-row=');
  expect(html).toContain('"title":"Value Differences"');
  expect(html).toContain('row.expandableDetail.title');
  expect(html).toContain('row.expandableDetail.summary');
  expect(html).toContain("row.expandableDetail.variant === 'differences' ? 'diff-grid' : 'detail-stack'");
  expect(html).toContain('field.columnA');
  expect(html).toContain('class="kinetic-glyph-box diff-arrow-box kinetic-muted">-&gt;</div>');
  expect(html).not.toContain('cell.column ? \'<span class="table-chip kinetic-copy">\' + escapeHtml(cell.column) + \'</span>\' : \'\'');
  expect(html).toContain('class="diff-value-label file-a">File A</span>');
  expect(html).toContain("formatDetailValue(field.valueB, 'kinetic-surface-success-muted')");
  expect(html).toContain('row.description ? \'<span class="result-description">\' + escapeHtml(row.description) + \'</span>\' : \'\'');
  expect(html).toContain('color-scheme: dark;');
  expect(html).toContain('--color-kinetic-bg: #050505;');
  expect(html).toContain('--color-kinetic-success: #6cffbe;');
  expect(html).toContain('.summary-file-panel');
  expect(html).toContain('.diff-card');
  expect(html).toContain('.detail-stack');
  expect(html).toContain('.section-card-header');
  expect(html).toContain('.status-strip');
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

  const duplicateFilter = (Array.from(document.querySelectorAll('[data-filter]')) as HTMLButtonElement[]).find(
    (button) => button.getAttribute('data-filter') === 'duplicate',
  );

  expect(duplicateFilter).toBeTruthy();
  duplicateFilter?.click();

  expect(resultsCount?.textContent).toBe('1 of 1 rows shown');

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
