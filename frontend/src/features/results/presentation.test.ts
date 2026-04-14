import { expect, test } from 'vitest';
import { filterResults, getResultBadge, getResultFilterCounts } from './presentation';
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
    result_type: 'duplicate_filea',
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
    RESULTS[4],
    RESULTS[5],
  ]);
  expect(filterResults(RESULTS, 'missing_right')).toEqual([RESULTS[3]]);
  expect(getResultFilterCounts(RESULTS)).toEqual({
    all: 6,
    match: 1,
    mismatch: 1,
    missing_left: 1,
    missing_right: 1,
    duplicate: 2,
  });
});

test('returns the expected badges for standard and duplicate result types', () => {
  expect(getResultBadge('match')).toMatchObject({
    label: 'Match',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  });
  expect(getResultBadge('duplicate_filea')).toMatchObject({
    label: 'Duplicate',
    dot: 'bg-orange-500 dark:bg-orange-400',
  });
  expect(getResultBadge('duplicate_both')).toMatchObject({
    label: 'Duplicate',
    bg: 'border border-orange-200 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/25',
  });
});
