import { expect, test } from 'vitest';
import { filterResults, getResultBadge, getResultDescription, getResultFilterCounts, RESULT_FILTER_OPTIONS } from './presentation';
import type { ResultResponse } from '../../types/api';

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
    differences: [{ column_a: 'name', column_b: 'name', value_a: 'Bob', value_b: 'Robert' }],
  },
  {
    result_type: 'missing_left',
    key: ['3'],
    values_a: [],
    values_b: ['Charlie'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'missing_right',
    key: ['4'],
    values_a: ['Dana'],
    values_b: [],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'unkeyed_left',
    key: ['NULL'],
    values_a: [],
    values_b: ['Erin'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'unkeyed_right',
    key: [''],
    values_a: ['Finn'],
    values_b: [],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'duplicate_file_a',
    key: ['5'],
    values_a: ['Evan'],
    values_b: ['Evan'],
    duplicate_values_a: [['Evan'], ['Evan']],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'duplicate_both',
    key: ['6'],
    values_a: ['Fran'],
    values_b: ['Fran'],
    duplicate_values_a: [['Fran']],
    duplicate_values_b: [['Fran']],
    differences: [],
  },
];

test('filters duplicate-prefixed results together and counts each badge bucket', () => {
  expect(filterResults(RESULTS, 'duplicate')).toEqual([
    RESULTS[6],
    RESULTS[7],
  ]);
  expect(filterResults(RESULTS, 'missing_right')).toEqual([RESULTS[3]]);
  expect(filterResults(RESULTS, 'unkeyed_left')).toEqual([RESULTS[4]]);
  expect(filterResults(RESULTS, 'unkeyed_right')).toEqual([RESULTS[5]]);
  expect(getResultFilterCounts(RESULTS)).toEqual({
    all: 8,
    match: 1,
    mismatch: 1,
    missing_left: 1,
    missing_right: 1,
    unkeyed_left: 1,
    unkeyed_right: 1,
    duplicate: 2,
  });
});

test('returns the expected badges for standard and duplicate result types', () => {
  expect(getResultBadge('match')).toMatchObject({
    label: 'Match',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  });
  expect(getResultBadge('duplicate_file_a')).toMatchObject({
    label: 'Duplicate',
    dot: 'bg-orange-500 dark:bg-orange-400',
  });
  expect(getResultBadge('duplicate_both')).toMatchObject({
    label: 'Duplicate',
    bg: 'border border-orange-200 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/25',
  });
  expect(getResultBadge('unkeyed_left')).toMatchObject({
    label: 'Ignored in File B',
    dot: 'bg-rose-500 dark:bg-rose-400',
  });
  expect(getResultBadge('unkeyed_right')).toMatchObject({
    label: 'Ignored in File A',
    dot: 'bg-fuchsia-500 dark:bg-fuchsia-400',
  });
});

test('uses clearer labels and descriptions for one-sided and ignored results', () => {
  expect(RESULT_FILTER_OPTIONS.find((option) => option.value === 'missing_left')).toMatchObject({
    label: 'Only in File B',
  });
  expect(RESULT_FILTER_OPTIONS.find((option) => option.value === 'missing_right')).toMatchObject({
    label: 'Only in File A',
  });
  expect(RESULT_FILTER_OPTIONS.find((option) => option.value === 'unkeyed_left')).toMatchObject({
    label: 'Ignored in File B',
  });
  expect(RESULT_FILTER_OPTIONS.find((option) => option.value === 'unkeyed_right')).toMatchObject({
    label: 'Ignored in File A',
  });
  expect(getResultDescription('missing_left')).toBe('Present only in File B for the selected key.');
  expect(getResultDescription('missing_right')).toBe('Present only in File A for the selected key.');
  expect(getResultDescription('unkeyed_left')).toBe('Skipped because File B has an unusable selected key for this row.');
  expect(getResultDescription('unkeyed_right')).toBe('Skipped because File A has an unusable selected key for this row.');
});
