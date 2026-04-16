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

test('uses stronger dark-mode contrast for active and hover-ready result filters', () => {
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
  expect(activeFilter).toHaveClass('dark:bg-primary-400/20');
  expect(activeFilter).toHaveClass('dark:ring-primary-300/35');
  expect(inactiveFilter).toHaveClass('dark:hover:border-gray-500');
  expect(inactiveFilter).toHaveClass('dark:hover:bg-gray-800/90');

  fireEvent.click(inactiveFilter!);
  expect(onFilterChange).toHaveBeenCalledWith('missing_left');
});
