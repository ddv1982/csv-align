import { expect, test } from 'vitest';
import { buildResultRows, filterResults, getResultBadge, getResultDescription, getResultFilterCounts, RESULT_FILTER_OPTIONS } from './presentation';
import type { MappingDto, ResultResponse } from '../../types/api';

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

test('counts every duplicate variant in the duplicate bucket with a single summary shape', () => {
  expect(getResultFilterCounts([
    ...RESULTS,
    {
      result_type: 'duplicate_file_b',
      key: ['7'],
      values_a: ['Gail'],
      values_b: ['Gail'],
      duplicate_values_a: [],
      duplicate_values_b: [['Gail'], ['Gail']],
      differences: [],
    },
  ])).toEqual({
    all: 9,
    match: 1,
    mismatch: 1,
    missing_left: 1,
    missing_right: 1,
    unkeyed_left: 1,
    unkeyed_right: 1,
    duplicate: 3,
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

test('exposes shared semantic tones for filter chips', () => {
  expect(RESULT_FILTER_OPTIONS.map(({ value, tone }) => [value, tone])).toEqual([
    ['all', 'neutral'],
    ['match', 'match'],
    ['mismatch', 'mismatch'],
    ['missing_left', 'missing-left'],
    ['missing_right', 'missing-right'],
    ['unkeyed_left', 'unkeyed-left'],
    ['unkeyed_right', 'unkeyed-right'],
    ['duplicate', 'duplicate'],
  ]);
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

test('shapes result values with comparison column names for shared table and export rendering', () => {
  expect(buildResultRows(RESULTS, {
    fileA: ['full_name'],
    fileB: ['display_name'],
  })).toEqual(expect.arrayContaining([
    expect.objectContaining({
      fileAValues: [[{ column: 'full_name', value: 'Alice' }]],
      fileBValues: [[{ column: 'display_name', value: 'Alice' }]],
      expandableDetail: expect.objectContaining({
        title: 'Paired Values',
        toggleLabel: 'Inspect',
        panels: [
          {
            label: null,
            fields: [
              {
                columnA: 'full_name',
                columnB: 'display_name',
                valueA: 'Alice',
                valueB: 'Alice',
              },
            ],
          },
        ],
      }),
    }),
    expect.objectContaining({
      fileAValues: [[{ column: 'full_name', value: 'Evan' }], [{ column: 'full_name', value: 'Evan' }]],
      fileBValues: [[{ column: 'display_name', value: 'Evan' }]],
      expandableDetail: expect.objectContaining({
        title: 'Paired Values',
        panels: [
          {
            label: 'Row 1',
            fields: [
              {
                columnA: 'full_name',
                columnB: 'display_name',
                valueA: 'Evan',
                valueB: 'Evan',
              },
            ],
          },
          {
            label: 'Row 2',
            fields: [
              {
                columnA: 'full_name',
                columnB: null,
                valueA: 'Evan',
                valueB: '',
              },
            ],
          },
        ],
      }),
    }),
    expect.objectContaining({
      resultType: 'mismatch',
      expandableDetail: expect.objectContaining({
        title: 'Value Differences',
        toggleLabel: '1 diff',
        panels: [
          {
            label: null,
            fields: [
              {
                columnA: 'name',
                columnB: 'name',
                valueA: 'Bob',
                valueB: 'Robert',
              },
            ],
          },
        ],
      }),
    }),
  ]));
});

test('falls back to paired-value inspection for zero-diff mismatch rows', () => {
  const [row] = buildResultRows([
    {
      result_type: 'mismatch',
      key: ['zero-diff'],
      values_a: ['Same'],
      values_b: ['Same'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [],
    },
  ], {
    fileA: ['full_name'],
    fileB: ['display_name'],
  });

  expect(row.expandableDetail).toEqual({
    variant: 'inspection',
    title: 'Paired Values',
    summary: '1 row',
    toggleLabel: 'Inspect',
    panels: [
      {
        label: null,
        fields: [
          {
            columnA: 'full_name',
            columnB: 'display_name',
            valueA: 'Same',
            valueB: 'Same',
          },
        ],
      },
    ],
  });
});

test('uses explicit mappings to pair inspection labels when selected column order differs', () => {
  const mappings: MappingDto[] = [
    { file_a_column: 'first_name', file_b_column: 'full_name', mapping_type: 'manual' },
    { file_a_column: 'nickname', file_b_column: 'alias', mapping_type: 'manual' },
  ];

  const [row] = buildResultRows([
    {
      result_type: 'match',
      key: ['mapped-match'],
      values_a: ['Alice', ''],
      values_b: ['null', 'Alice'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [],
    },
  ], {
    fileA: ['first_name', 'nickname'],
    fileB: ['alias', 'full_name'],
    mappings,
  });

  expect(row.fileAValues).toEqual([[{ column: 'first_name', value: 'Alice' }, { column: 'nickname', value: '' }]]);
  expect(row.fileBValues).toEqual([[{ column: 'alias', value: 'null' }, { column: 'full_name', value: 'Alice' }]]);
  expect(row.expandableDetail).toEqual({
    variant: 'inspection',
    title: 'Paired Values',
    summary: '1 row',
    toggleLabel: 'Inspect',
    panels: [
      {
        label: null,
        fields: [
          {
            columnA: 'first_name',
            columnB: 'full_name',
            valueA: 'Alice',
            valueB: 'Alice',
          },
          {
            columnA: 'nickname',
            columnB: 'alias',
            valueA: '',
            valueB: 'null',
          },
        ],
      },
    ],
  });
});

test('keeps zero-diff mismatch inspection aligned to explicit mappings', () => {
  const [row] = buildResultRows([
    {
      result_type: 'mismatch',
      key: ['mapped-zero-diff'],
      values_a: ['Alice', ''],
      values_b: ['null', 'Alice'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [],
    },
  ], {
    fileA: ['first_name', 'nickname'],
    fileB: ['alias', 'full_name'],
    mappings: [
      { file_a_column: 'first_name', file_b_column: 'full_name', mapping_type: 'manual' },
      { file_a_column: 'nickname', file_b_column: 'alias', mapping_type: 'manual' },
    ],
  });

  expect(row.expandableDetail).toEqual({
    variant: 'inspection',
    title: 'Paired Values',
    summary: '1 row',
    toggleLabel: 'Inspect',
    panels: [
      {
        label: null,
        fields: [
          {
            columnA: 'first_name',
            columnB: 'full_name',
            valueA: 'Alice',
            valueB: 'Alice',
          },
          {
            columnA: 'nickname',
            columnB: 'alias',
            valueA: '',
            valueB: 'null',
          },
        ],
      },
    ],
  });
});
