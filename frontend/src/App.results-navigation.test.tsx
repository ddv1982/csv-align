import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ComparisonNormalizationConfig, MappingResponse } from './types/api';

const {
  createSessionMock,
  loadFileMock,
  compareFilesMock,
  exportResultsMock,
  downloadBlobMock,
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  loadFileMock: vi.fn(),
  compareFilesMock: vi.fn(),
  exportResultsMock: vi.fn(),
  downloadBlobMock: vi.fn(),
}));

vi.mock('./services/tauri', () => ({
  createSession: createSessionMock,
  loadFile: loadFileMock,
  compareFiles: compareFilesMock,
  exportResults: exportResultsMock,
  downloadBlob: downloadBlobMock,
}));

vi.mock('./components/FileSelector', () => ({
  FileSelector: ({
    label,
    onSelect,
  }: {
    label: string;
    onSelect: (file: File) => void;
  }) => (
    <section>
      <h2>{label}</h2>
      <button onClick={() => onSelect(new File(['id,name'], `${label}.csv`, { type: 'text/csv' }))}>
        Select {label}
      </button>
    </section>
  ),
}));

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
      columnMappings: MappingResponse[],
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
  downloadBlobMock.mockReset();

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

  expect(screen.getByRole('heading', { name: 'Select two local CSV files' })).toBeInTheDocument();

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
