import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ComparisonNormalizationConfig, MappingDto } from './types/api';
import { getAppTauriMocks } from './test/fixtures.tsx';

const {
  createSessionMock,
  loadFileMock,
  compareFilesMock,
  exportResultsMock,
  loadPairOrderMock,
  downloadBlobMock,
  savePairOrderMock,
  suggestMappingsMock,
} = getAppTauriMocks();

vi.mock('./components/MappingConfig', () => ({
  MappingConfig: ({
    normalization,
    onCompare,
  }: {
    normalization: ComparisonNormalizationConfig;
    onCompare: (
      keyColumnsA: string[],
      keyColumnsB: string[],
      comparisonColumnsA: string[],
      comparisonColumnsB: string[],
      columnMappings: MappingDto[],
      normalization: ComparisonNormalizationConfig
    ) => void;
  }) => (
    <section>
      <h2>Mock Configure</h2>
      <button
        onClick={() =>
          onCompare(
            ['id'],
            ['id'],
            ['name'],
            ['name'],
            [
              {
                file_a_column: 'name',
                file_b_column: 'name',
                mapping_type: 'manual',
              },
            ],
            normalization
          )
        }
      >
        Run compare
      </button>
    </section>
  ),
}));

vi.mock('./components/SummaryStats', () => ({
  SummaryStats: () => <div>Mock Summary</div>,
}));

vi.mock('./components/FilterBar', () => ({
  FilterBar: () => <div>Mock Filter Bar</div>,
}));

vi.mock('./components/ResultsTable', () => ({
  ResultsTable: () => <div>Mock Results Table</div>,
}));

import App from './App';

beforeEach(() => {
  createSessionMock.mockReset();
  loadFileMock.mockReset();
  compareFilesMock.mockReset();
  exportResultsMock.mockReset();
  loadPairOrderMock.mockReset();
  downloadBlobMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-456' });
  loadFileMock.mockResolvedValue({
    success: true,
    file_letter: 'a',
    headers: ['id', 'name'],
    columns: [
      { index: 0, name: 'id', data_type: 'string' },
      { index: 1, name: 'name', data_type: 'string' },
    ],
    row_count: 2,
  });
  compareFilesMock.mockResolvedValue({
    success: true,
    results: [
      {
        result_type: 'match',
        key: ['1'],
        values_a: ['Alice'],
        values_b: ['Alice'],
        duplicate_values_a: [],
        duplicate_values_b: [],
        differences: [],
      },
    ],
    summary: {
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
    },
  });
});

test('returns from results to configuration', async () => {
  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  expect(screen.getByRole('heading', { name: 'Stage the two CSV feeds' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Select File A' }));
  await screen.findByRole('button', { name: 'Select File B' });
  fireEvent.click(screen.getByRole('button', { name: 'Select File B' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });

  fireEvent.click(screen.getByRole('button', { name: 'Run compare' }));

  await screen.findByText('Mock Summary');
  expect(screen.getByText('Mock Filter Bar')).toBeInTheDocument();
  expect(screen.getByText('Mock Results Table')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Back to configuration' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });
  expect(compareFilesMock).toHaveBeenCalledTimes(1);
});

test('clicking unlocked step numbers in the stepper navigates between steps', async () => {
  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  // Step 2 and Step 3 are locked before files are loaded — no navigation buttons exist.
  expect(screen.queryByRole('button', { name: /Go to step 2:/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Go to step 3:/ })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Select File A' }));
  await screen.findByRole('button', { name: 'Select File B' });
  fireEvent.click(screen.getByRole('button', { name: 'Select File B' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });

  // On Configure, Step 1 (select) is clickable to go back.
  fireEvent.click(screen.getByRole('button', { name: /Go to step 1:/ }));
  await screen.findByRole('heading', { name: 'Stage the two CSV feeds' });

  // Step 2 (configure) is now clickable to go forward.
  fireEvent.click(screen.getByRole('button', { name: /Go to step 2:/ }));
  await screen.findByRole('heading', { name: 'Mock Configure' });

  fireEvent.click(screen.getByRole('button', { name: 'Run compare' }));
  await screen.findByText('Mock Summary');

  // From Results: jump back to Step 1 directly via the stepper.
  fireEvent.click(screen.getByRole('button', { name: /Go to step 1:/ }));
  await screen.findByRole('heading', { name: 'Stage the two CSV feeds' });

  // Step 3 (results) is still unlocked because the summary persists.
  fireEvent.click(screen.getByRole('button', { name: /Go to step 3:/ }));
  await screen.findByText('Mock Summary');
});
