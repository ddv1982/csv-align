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

test('shows clearer labels and explanations for one-sided and ignored rows', () => {
  render(<ResultsTable results={RESULTS} />);

  expect(screen.getByText('Only in File A')).toBeInTheDocument();
  expect(screen.getByText('Ignored in File B')).toBeInTheDocument();
  expect(screen.getByText('Present only in File A for the selected key.')).toBeInTheDocument();
  expect(screen.getByText('Skipped because File B has an unusable selected key for this row.')).toBeInTheDocument();
  expect(screen.queryByText('Missing Right')).not.toBeInTheDocument();
  expect(screen.queryByText('Unkeyed Left')).not.toBeInTheDocument();

  const fileAOnlyBadge = screen.getByText('Only in File A').closest('span');
  expect(fileAOnlyBadge).toHaveClass('whitespace-nowrap');
  expect(fileAOnlyBadge).toHaveClass('w-fit');
});

test('filters visible rows by search query across keys and values', () => {
  render(<ResultsTable results={RESULTS} />);

  const search = screen.getByPlaceholderText('Search keys or values');
  fireEvent.change(search, { target: { value: 'gamma' } });

  expect(screen.getByText('C-3')).toBeInTheDocument();
  expect(screen.queryByText('A-1')).not.toBeInTheDocument();
  expect(screen.queryByText('B-2')).not.toBeInTheDocument();
  expect(screen.getByText('1 of 4 rows shown')).toBeInTheDocument();
});

test('sorts rows by key when the header is clicked', () => {
  render(<ResultsTable results={RESULTS} />);

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
