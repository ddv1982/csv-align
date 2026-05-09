import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ResultsTable } from './ResultsTable';
import type { ResultResponse } from '../types/api';

const RESULTS: ResultResponse[] = [
  {
    result_type: 'missing_right',
    key: ['A-1'],
    values_a: ['Only A'],
    values_b: [],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'unkeyed_left',
    key: ['NULL'],
    values_a: [],
    values_b: ['Ignored B'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'match',
    key: ['B-2'],
    values_a: ['Alpha'],
    values_b: ['Bravo'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
  {
    result_type: 'mismatch',
    key: ['C-3'],
    values_a: ['Zulu'],
    values_b: ['Gamma'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [
      {
        column_a: 'name',
        column_b: 'name',
        value_a: 'Zulu',
        value_b: 'Gamma',
      },
    ],
  },
];

const COMPARISON_COLUMNS_A = ['name'];
const COMPARISON_COLUMNS_B = ['display_name'];

test('shows clearer labels and explanations for one-sided and ignored rows', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  expect(screen.getByText('Only in File A')).toBeInTheDocument();
  expect(screen.getByText('Ignored in File B')).toBeInTheDocument();
  expect(screen.getByText('Present only in File A for the selected key.')).toBeInTheDocument();
  expect(screen.getByText('Skipped because File B has an unusable selected key for this row.')).toBeInTheDocument();
  expect(screen.queryByText('Missing Right')).not.toBeInTheDocument();
  expect(screen.queryByText('Unkeyed Left')).not.toBeInTheDocument();

  const fileAOnlyBadge = screen.getByText('Only in File A').closest('span');
  expect(fileAOnlyBadge).toHaveClass('badge');
  expect(fileAOnlyBadge).toHaveClass('tone-missing-right');
  expect(fileAOnlyBadge).toHaveClass('whitespace-nowrap');
  expect(fileAOnlyBadge).toHaveClass('w-fit');
  expect(fileAOnlyBadge?.querySelector('.badge-dot')).toBeTruthy();
  expect(screen.getByRole('table')).toHaveClass('results-table');
});

test('uses shared theme surface classes for table states instead of hardcoded dark overlays', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  expect(screen.getByText('A-1')).toHaveClass('kinetic-surface-subtle');

  const diffToggle = screen.getByRole('button', { name: /1 diff/i });
  expect(diffToggle).toHaveClass('kinetic-surface-subtle');

  fireEvent.click(diffToggle);

  expect(screen.getByText('Value Differences').previousElementSibling).toHaveClass('kinetic-surface-accent');
});

test('lets matching rows expand paired file values for inspection', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  const matchRow = screen.getByText('B-2').closest('tr');
  expect(within(matchRow as HTMLElement).getByRole('button', { name: /inspect/i })).toBeInTheDocument();

  fireEvent.click(within(matchRow as HTMLElement).getByRole('button', { name: /inspect/i }));

  expect(screen.getByText('Paired Values')).toBeInTheDocument();
  expect(screen.getAllByText('File A').length).toBeGreaterThan(0);
  expect(screen.getAllByText('File B').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Bravo').length).toBeGreaterThan(0);
  expect(screen.getAllByText('display_name').length).toBeGreaterThan(0);
});

test('uses success styling on both sides for matched inspection rows', () => {
  render(
    <ResultsTable
      results={[
        {
          result_type: 'match',
          key: ['match-tone'],
          values_a: ['Match Left'],
          values_b: ['Match Right'],
          duplicate_values_a: [],
          duplicate_values_b: [],
          differences: [],
        },
      ]}
      comparisonColumnsA={['name']}
      comparisonColumnsB={['display_name']}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /inspect/i }));

  const fileALabel = screen.getByText('File A');
  const fileAValue = screen.getAllByTitle('Match Left').find((element) => element.classList.contains('kinetic-surface-success-muted'));
  const fileBValue = screen.getAllByTitle('Match Right').find((element) => element.classList.contains('kinetic-surface-success-muted'));

  expect(fileALabel).toHaveClass('text-[color:var(--color-kinetic-success)]');
  expect(fileAValue).toBeTruthy();
  expect(fileBValue).toBeTruthy();
});

test('keeps split danger and success styling for mismatched inspection rows', () => {
  render(
    <ResultsTable
      results={[
        {
          result_type: 'mismatch',
          key: ['zero-diff-tone'],
          values_a: ['Mismatch Left'],
          values_b: ['Mismatch Right'],
          duplicate_values_a: [],
          duplicate_values_b: [],
          differences: [],
        },
      ]}
      comparisonColumnsA={['name']}
      comparisonColumnsB={['display_name']}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /inspect/i }));

  const fileALabel = screen.getByText('File A');
  const fileAValue = screen.getAllByTitle('Mismatch Left').find((element) => element.classList.contains('kinetic-surface-danger'));
  const fileBValue = screen.getAllByTitle('Mismatch Right').find((element) => element.classList.contains('kinetic-surface-success-muted'));

  expect(fileALabel).toHaveClass('text-[color:var(--color-kinetic-danger)]');
  expect(fileAValue).toBeTruthy();
  expect(fileBValue).toBeTruthy();
});

test('wraps long collapsed result values instead of truncating them', () => {
  const longFileA = 'AlphaSegmentOne,AlphaSegmentTwo,AlphaSegmentThree,AlphaSegmentFour';
  const longFileB = 'BravoSegmentOne,BravoSegmentTwo,BravoSegmentThree,BravoSegmentFour';

  render(
    <ResultsTable
      results={[
        {
          result_type: 'match',
          key: ['joined-values'],
          values_a: [longFileA, 'Bravo'],
          values_b: [longFileB, 'Delta'],
          duplicate_values_a: [],
          duplicate_values_b: [],
          differences: [],
        },
      ]}
      comparisonColumnsA={['first_name', 'nickname']}
      comparisonColumnsB={['display_name', 'alias']}
      mappings={[
        { file_a_column: 'first_name', file_b_column: 'display_name', mapping_type: 'manual' },
        { file_a_column: 'nickname', file_b_column: 'alias', mapping_type: 'manual' },
      ]}
    />,
  );

  const row = screen.getByText('joined-values').closest('tr');
  const collapsedFileA = within(row as HTMLElement).getByTitle(`${longFileA}, Bravo`);
  const collapsedFileB = within(row as HTMLElement).getByTitle(`${longFileB}, Delta`);

  expect(collapsedFileA).toHaveClass('kinetic-value-text');
  expect(collapsedFileA).not.toHaveClass('truncate');
  expect(collapsedFileB).toHaveClass('kinetic-value-text');
  expect(row).toHaveTextContent(`${longFileA}, Bravo`);
  expect(row).toHaveTextContent(`${longFileB}, Delta`);

  fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /inspect/i }));

  expect(screen.getByText('Paired Values')).toBeInTheDocument();
  expect(screen.getAllByText('Bravo').length).toBeGreaterThan(0);
});

test('shows overlapping key and comparison pairs in expanded matched results', () => {
  render(
    <ResultsTable
      results={[
        {
          result_type: 'match',
          key: ['42'],
          values_a: ['42', 'Alice'],
          values_b: ['42', 'Alice'],
          duplicate_values_a: [],
          duplicate_values_b: [],
          differences: [],
        },
      ]}
      comparisonColumnsA={['id', 'name']}
      comparisonColumnsB={['record_id', 'display_name']}
      mappings={[
        { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'manual' },
        { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
      ]}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /inspect/i }));

  expect(screen.getAllByText('id').length).toBeGreaterThan(0);
  expect(screen.getAllByText('record_id').length).toBeGreaterThan(0);
  expect(screen.getAllByText('name').length).toBeGreaterThan(0);
  expect(screen.getAllByText('display_name').length).toBeGreaterThan(0);
  expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
});

test('filters visible rows by search query across keys and values', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  const search = screen.getByPlaceholderText('Search keys or values');
  fireEvent.change(search, { target: { value: 'gamma' } });

  expect(screen.getByText('C-3')).toBeInTheDocument();
  expect(screen.queryByText('A-1')).not.toBeInTheDocument();
  expect(screen.queryByText('B-2')).not.toBeInTheDocument();
  expect(screen.getByText('1 of 4 rows shown')).toBeInTheDocument();
});

test('sorts rows by key when the header is clicked', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  fireEvent.click(screen.getByRole('button', { name: /key/i }));

  const bodyRows = screen.getAllByRole('row').slice(1);
  expect(within(bodyRows[0]).getByText('A-1')).toBeInTheDocument();
  expect(within(bodyRows[1]).getByText('B-2')).toBeInTheDocument();
  expect(within(bodyRows[2]).getByText('C-3')).toBeInTheDocument();
  expect(within(bodyRows[3]).getByText('NULL')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /key/i }));

  const descendingRows = screen.getAllByRole('row').slice(1);
  expect(within(descendingRows[0]).getByText('NULL')).toBeInTheDocument();
  expect(within(descendingRows[3]).getByText('A-1')).toBeInTheDocument();
});

test('sorts rows by diff count ascending when the details header is clicked', () => {
  const resultsWithDiffCounts: ResultResponse[] = [
    {
      result_type: 'mismatch',
      key: ['THREE'],
      values_a: ['A'],
      values_b: ['B'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [
        {
          column_a: 'col1',
          column_b: 'col1',
          value_a: 'A1',
          value_b: 'B1',
        },
        {
          column_a: 'col2',
          column_b: 'col2',
          value_a: 'A2',
          value_b: 'B2',
        },
        {
          column_a: 'col3',
          column_b: 'col3',
          value_a: 'A3',
          value_b: 'B3',
        },
      ],
    },
    {
      result_type: 'mismatch',
      key: ['ZERO'],
      values_a: ['A'],
      values_b: ['A'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [],
    },
    {
      result_type: 'mismatch',
      key: ['ONE'],
      values_a: ['A'],
      values_b: ['B'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [
        {
          column_a: 'col1',
          column_b: 'col1',
          value_a: 'A1',
          value_b: 'B1',
        },
      ],
    },
  ];

  render(<ResultsTable results={resultsWithDiffCounts} />);

  fireEvent.click(screen.getByRole('button', { name: /details/i }));

  const bodyRows = screen.getAllByRole('row').slice(1);
  expect(within(bodyRows[0]).getByText('ZERO')).toBeInTheDocument();
  expect(within(bodyRows[1]).getByText('ONE')).toBeInTheDocument();
  expect(within(bodyRows[2]).getByText('THREE')).toBeInTheDocument();
});

test('sorts rows by diff count descending when the details header is clicked twice', () => {
  const resultsWithDiffCounts: ResultResponse[] = [
    {
      result_type: 'mismatch',
      key: ['THREE'],
      values_a: ['A'],
      values_b: ['B'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [
        {
          column_a: 'col1',
          column_b: 'col1',
          value_a: 'A1',
          value_b: 'B1',
        },
        {
          column_a: 'col2',
          column_b: 'col2',
          value_a: 'A2',
          value_b: 'B2',
        },
        {
          column_a: 'col3',
          column_b: 'col3',
          value_a: 'A3',
          value_b: 'B3',
        },
      ],
    },
    {
      result_type: 'mismatch',
      key: ['ZERO'],
      values_a: ['A'],
      values_b: ['A'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [],
    },
    {
      result_type: 'mismatch',
      key: ['ONE'],
      values_a: ['A'],
      values_b: ['B'],
      duplicate_values_a: [],
      duplicate_values_b: [],
      differences: [
        {
          column_a: 'col1',
          column_b: 'col1',
          value_a: 'A1',
          value_b: 'B1',
        },
      ],
    },
  ];

  render(<ResultsTable results={resultsWithDiffCounts} />);

  const detailsSort = screen.getByRole('button', { name: /details/i });
  fireEvent.click(detailsSort);
  fireEvent.click(detailsSort);

  const bodyRows = screen.getAllByRole('row').slice(1);
  expect(within(bodyRows[0]).getByText('THREE')).toBeInTheDocument();
  expect(within(bodyRows[1]).getByText('ONE')).toBeInTheDocument();
  expect(within(bodyRows[2]).getByText('ZERO')).toBeInTheDocument();
});

test('updates the controlled search input value synchronously on each keystroke', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  const search = screen.getByPlaceholderText('Search keys or values');

  fireEvent.change(search, { target: { value: 'g' } });
  expect(search).toHaveValue('g');

  fireEvent.change(search, { target: { value: 'ga' } });
  expect(search).toHaveValue('ga');

  fireEvent.change(search, { target: { value: 'gamma' } });
  expect(search).toHaveValue('gamma');
  expect(screen.getByText('1 of 4 rows shown')).toBeInTheDocument();
});

test('updates sort state from the transition-driven header action', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  const keySort = screen.getByRole('button', { name: /key/i });
  const keyHeader = keySort.closest('th');

  expect(keyHeader).toHaveAttribute('aria-sort', 'none');

  fireEvent.click(keySort);

  expect(keyHeader).toHaveAttribute('aria-sort', 'ascending');
});

test('renders long diff column names with the larger wrapped header treatment', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  fireEvent.click(screen.getByRole('button', { name: /1 diff/i }));

  const columnHeader = screen.getAllByText('name').find((element) => element.classList.contains('break-all'));
  expect(columnHeader).toBeTruthy();
  expect(columnHeader).toHaveClass('break-all');
  expect(columnHeader).toHaveClass('table-chip');
});

test('positions the mismatch diff arrow on the same row as the value boxes', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  fireEvent.click(screen.getByRole('button', { name: /1 diff/i }));

  const valueArrow = screen.getByText('->');
  expect(valueArrow).toHaveClass('row-start-2');
  expect(valueArrow).toHaveClass('self-center');
});

test('shows the selected-filter empty-state copy when there are zero total results', () => {
  render(<ResultsTable results={[]} totalResultsCount={0} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  expect(screen.getByText('No results match the selected filter')).toBeInTheDocument();
  expect(screen.queryByText('No results match the current filter and search.')).not.toBeInTheDocument();
});

test('shows the current-filter-and-search empty-state copy when rows exist but none survive filtering', () => {
  render(<ResultsTable results={[]} totalResultsCount={RESULTS.length} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  expect(screen.getByText('No results match the current filter and search.')).toBeInTheDocument();
  expect(screen.queryByText('No results match the selected filter')).not.toBeInTheDocument();
});

test('keeps comparison column names out of the collapsed value cells', () => {
  render(<ResultsTable results={RESULTS} comparisonColumnsA={COMPARISON_COLUMNS_A} comparisonColumnsB={COMPARISON_COLUMNS_B} />);

  const row = screen.getByText('Alpha').closest('tr');
  expect(within(row as HTMLElement).queryByText('name')).not.toBeInTheDocument();
  expect(within(row as HTMLElement).queryByText('display_name')).not.toBeInTheDocument();

  fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /inspect/i }));

  expect(screen.getByText('name')).toBeInTheDocument();
  expect(screen.getByText('display_name')).toBeInTheDocument();
});

test('lets zero-diff mismatch rows fall back to the shared inspect panel', () => {
  render(
    <ResultsTable
      results={[
        {
          result_type: 'mismatch',
          key: ['ZERO-DIFF'],
          values_a: ['Same'],
          values_b: ['Same'],
          duplicate_values_a: [],
          duplicate_values_b: [],
          differences: [],
        },
      ]}
      comparisonColumnsA={COMPARISON_COLUMNS_A}
      comparisonColumnsB={COMPARISON_COLUMNS_B}
    />,
  );

  const inspectToggle = screen.getByRole('button', { name: /inspect/i });
  fireEvent.click(inspectToggle);

  expect(screen.getByText('Paired Values')).toBeInTheDocument();
  expect(screen.getAllByText('Same').length).toBeGreaterThan(1);
});
