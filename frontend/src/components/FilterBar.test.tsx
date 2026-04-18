import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { FilterBar } from './FilterBar';
import type { ResultResponse } from '../types/api';

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
    result_type: 'missing_left',
    key: ['2'],
    values_a: [],
    values_b: ['Bob'],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: [],
  },
];

test('uses a minimal solid active style and subtle hover-ready styling for result filters', () => {
  const onFilterChange = vi.fn();

  render(
    <FilterBar
      filter="match"
      results={RESULTS}
      onFilterChange={onFilterChange}
      onExport={vi.fn()}
    />,
  );

  const activeFilter = screen.getByText('Matches').closest('button');
  const inactiveFilter = screen.getByText('Only in File B').closest('button');

  expect(activeFilter).toBeTruthy();
  expect(inactiveFilter).toBeTruthy();

  // Active pill is a solid primary-colored, pressed, rounded-full button.
  expect(activeFilter).toHaveAttribute('aria-pressed', 'true');
  expect(activeFilter).toHaveClass('bg-primary-600');
  expect(activeFilter).toHaveClass('text-white');
  expect(activeFilter).toHaveClass('rounded-full');

  // Inactive pill uses neutral surfaces with subtle hover states in both modes.
  expect(inactiveFilter).toHaveAttribute('aria-pressed', 'false');
  expect(inactiveFilter).toHaveClass('rounded-full');
  expect(inactiveFilter).toHaveClass('dark:hover:bg-gray-800');
  expect(inactiveFilter).toHaveClass('dark:hover:border-gray-600');

  fireEvent.click(inactiveFilter!);
  expect(onFilterChange).toHaveBeenCalledWith('missing_left');
});

test('gives the export button an accessible label', () => {
  render(
    <FilterBar
      filter="all"
      results={RESULTS}
      onFilterChange={vi.fn()}
      onExport={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Export comparison results as CSV' })).toBeInTheDocument();
});
