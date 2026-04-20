import { expect, test } from 'vitest';
import { buildResultsHtmlDocument } from './htmlExport';
import type { ResultResponse, SummaryResponse } from '../../types/api';

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

test('buildResultsHtmlDocument embeds the current comparison view state for standalone review', () => {
  const html = buildResultsHtmlDocument({
    summary: SUMMARY,
    fileAName: 'left.csv',
    fileBName: 'right.csv',
    results: RESULTS,
    initialFilter: 'duplicate',
  });

  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('<title>left.csv vs right.csv comparison results</title>');
  expect(html).toContain('<h1>Comparison results</h1>');
  expect(html).toContain('left.csv vs right.csv comparison results');
  expect(html).toContain('aria-label="Compared files"');
  expect(html).toContain('class="hero-file-label">File A</span><span class="hero-file-name">left.csv</span>');
  expect(html).toContain('class="hero-file-label">File B</span><span class="hero-file-name">right.csv</span>');
  expect(html).toContain('"initialFilter":"duplicate"');
  expect(html).toContain('"label":"Duplicates","count":1');
  expect(html).toContain('"badgeLabel":"Mismatch"');
  expect(html).toContain('"description":"Multiple File A rows share this selected key."');
  expect(html).toContain('data-sort-column="details"');
  expect(html).toContain('data-expand-row=');
  expect(html).toContain('diff-panel-title">Value Differences</span>');
  expect(html).toContain('diff-panel-count">\' + row.differences.length + \'' );
  expect(html).toContain('class="diff-column-chip">\' + escapeHtml(diff.column_a) + \'' );
  expect(html).toContain('class="diff-arrow-box">-&gt;</span><span class="diff-column-chip">\' + escapeHtml(diff.column_b) + \'' );
  expect(html).toContain('class="diff-value-label file-a">File A</span>');
  expect(html).toContain('class="diff-value-box file-b"');
  expect(html).toContain('color-scheme: dark;');
  expect(html).toContain('--bg: #050505;');
  expect(html).toContain('--success: #6cffbe;');
  expect(html).toContain('.hero-file-name');
  expect(html).toContain('.diff-card');
  expect(html).toContain('kinetic dark review surface as the app');
});
