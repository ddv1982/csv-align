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
  expect(html).toContain('left.csv vs right.csv comparison results');
  expect(html).toContain('"initialFilter":"duplicate"');
  expect(html).toContain('"label":"Duplicates","count":1');
  expect(html).toContain('"badgeLabel":"Mismatch"');
  expect(html).toContain('"description":"Multiple File A rows share this selected key."');
  expect(html).toContain('data-sort-column="details"');
  expect(html).toContain('data-expand-row=');
});
