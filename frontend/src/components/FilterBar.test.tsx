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

test('uses semantic active and inactive styling for result filters', () => {
  const onFilterChange = vi.fn();

  render(
    <FilterBar
      filter="match"
      results={RESULTS}
      onFilterChange={onFilterChange}
      onExportCsv={vi.fn()}
      onExportHtml={vi.fn()}
    />,
  );

  const activeFilter = screen.getByText('Matches').closest('button');
  const inactiveFilter = screen.getByText('Only in File B').closest('button');

  expect(activeFilter).toBeTruthy();
  expect(inactiveFilter).toBeTruthy();

  expect(activeFilter).toHaveAttribute('aria-pressed', 'true');
  expect(activeFilter).toHaveClass('filter-button');
  expect(activeFilter).toHaveClass('active');
  expect(activeFilter?.querySelector('.filter-dot')).toHaveClass('tone-match');
  expect(activeFilter?.querySelector('.filter-count')).toHaveClass('filter-count');

  expect(inactiveFilter).toHaveAttribute('aria-pressed', 'false');
  expect(inactiveFilter).toHaveClass('filter-button');
  expect(inactiveFilter?.querySelector('.filter-dot')).toHaveClass('tone-missing-left');
  expect(inactiveFilter?.querySelector('.filter-count')).toHaveClass('filter-count');

  fireEvent.click(inactiveFilter!);
  expect(onFilterChange).toHaveBeenCalledWith('missing_left');
});

test('gives the export button an accessible label', () => {
  const onExportHtml = vi.fn();
  const onExportCsv = vi.fn();

  render(
    <FilterBar
      filter="all"
      results={RESULTS}
      onFilterChange={vi.fn()}
      onExportCsv={onExportCsv}
      onExportHtml={onExportHtml}
    />,
  );

  const htmlButton = screen.getByRole('button', { name: 'Export comparison results as HTML' });
  const csvButton = screen.getByRole('button', { name: 'Export comparison results as CSV' });

  expect(htmlButton).toBeInTheDocument();
  expect(csvButton).toBeInTheDocument();
  expect(htmlButton).toHaveClass('btn-primary');
  expect(csvButton).toHaveClass('btn-primary');

  fireEvent.click(htmlButton);
  fireEvent.click(csvButton);

  expect(onExportHtml).toHaveBeenCalledTimes(1);
  expect(onExportCsv).toHaveBeenCalledTimes(1);
  expect(htmlButton.compareDocumentPosition(csvButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
