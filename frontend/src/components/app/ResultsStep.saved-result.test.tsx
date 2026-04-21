import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ResultsStep } from './ResultsStep';
import type { ResultResponse, SummaryResponse } from '../../types/api';

vi.mock('../SummaryStats', () => ({
  SummaryStats: () => <div>Mock Summary</div>,
}));

vi.mock('../FilterBar', () => ({
  FilterBar: () => <div>Mock Filter Bar</div>,
}));

vi.mock('../ResultsTable', () => ({
  ResultsTable: () => <div>Mock Results Table</div>,
}));

const SUMMARY: SummaryResponse = {
  total_rows_a: 1,
  total_rows_b: 1,
  matches: 1,
  mismatches: 0,
  missing_left: 0,
  missing_right: 0,
  unkeyed_left: 0,
  unkeyed_right: 0,
  duplicates_a: 0,
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
];

test('shows a save result entry point for live comparison results', () => {
  const onSaveResult = vi.fn();
  const onBack = vi.fn();

  render(
    <ResultsStep
      summary={SUMMARY}
      fileAName="left.csv"
      fileBName="right.csv"
      comparisonColumnsA={['name']}
      comparisonColumnsB={['display_name']}
      mappings={[]}
      filter="all"
      results={RESULTS}
      filteredResults={RESULTS}
      snapshotReadOnly={false}
      onFilterChange={vi.fn()}
      onExportCsv={vi.fn()}
      onExportHtml={vi.fn()}
      onSaveResult={onSaveResult}
      onBack={onBack}
      onStartNewComparison={vi.fn()}
    />,
  );

  expect(screen.getByText('Save this result for later review')).toBeInTheDocument();
  expect(screen.getByText('Save a snapshot of this comparison to reopen the same results later in read-only mode.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
  expect(onSaveResult).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Back to configuration' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('keeps loaded snapshots read-only and exposes a start-new-comparison action', () => {
  const onStartNewComparison = vi.fn();

  render(
    <ResultsStep
      summary={SUMMARY}
      fileAName="left.csv"
      fileBName="right.csv"
      comparisonColumnsA={['name']}
      comparisonColumnsB={['display_name']}
      mappings={[]}
      filter="all"
      results={RESULTS}
      filteredResults={RESULTS}
      snapshotReadOnly
      onFilterChange={vi.fn()}
      onExportCsv={vi.fn()}
      onExportHtml={vi.fn()}
      onSaveResult={vi.fn()}
      onBack={vi.fn()}
      onStartNewComparison={onStartNewComparison}
    />,
  );

  expect(
    screen.getByText(
      'Loaded snapshots are read-only results. Start a new comparison to edit mappings or load different files.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save result' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Back to configuration' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Start new comparison' }));
  expect(onStartNewComparison).toHaveBeenCalledTimes(1);
});
