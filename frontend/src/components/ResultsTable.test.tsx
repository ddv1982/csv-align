import { render, screen } from '@testing-library/react';
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
