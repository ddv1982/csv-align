import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ComparisonNormalizationConfig, MappingDto } from './types/api';

const {
  compareFilesMock,
  createSessionMock,
  downloadBlobMock,
  exportResultsMock,
  loadComparisonSnapshotMock,
  loadFileMock,
  loadPairOrderMock,
  saveComparisonSnapshotMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  exportResultsMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  loadFileMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  saveComparisonSnapshotMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('./services/tauri', () => ({
  isTauri: false,
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  downloadBlob: downloadBlobMock,
  exportResults: exportResultsMock,
  loadComparisonSnapshot: loadComparisonSnapshotMock,
  loadFile: loadFileMock,
  loadPairOrder: loadPairOrderMock,
  saveComparisonSnapshot: saveComparisonSnapshotMock,
  savePairOrder: savePairOrderMock,
  suggestMappings: suggestMappingsMock,
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
      columnMappings: MappingDto[],
      normalization: ComparisonNormalizationConfig,
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
            normalization,
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
  compareFilesMock.mockReset();
  createSessionMock.mockReset();
  downloadBlobMock.mockReset();
  exportResultsMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  loadFileMock.mockReset();
  loadPairOrderMock.mockReset();
  saveComparisonSnapshotMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-789' });
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
  loadComparisonSnapshotMock.mockResolvedValue({
    file_a: {
      name: 'saved-left.csv',
      headers: ['id', 'name'],
      columns: [
        { index: 0, name: 'id', data_type: 'string' },
        { index: 1, name: 'name', data_type: 'string' },
      ],
      row_count: 2,
    },
    file_b: {
      name: 'saved-right.csv',
      headers: ['id', 'name'],
      columns: [
        { index: 0, name: 'id', data_type: 'string' },
        { index: 1, name: 'name', data_type: 'string' },
      ],
      row_count: 2,
    },
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['name'],
    },
    mappings: [],
    normalization: {
      treat_empty_as_null: false,
      null_tokens: [],
      null_token_case_insensitive: true,
      case_insensitive: false,
      trim_whitespace: true,
      date_normalization: {
        enabled: false,
        formats: [],
      },
    },
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

test('loads a saved result from step 1 through the app workflow', async () => {
  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  expect(screen.getByText('Already have a saved result?')).toBeInTheDocument();

  fireEvent.change(screen.getByTestId('load-result-input'), {
    target: {
      files: [new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' })],
    },
  });

  await screen.findByText('Mock Summary');

  expect(loadComparisonSnapshotMock).toHaveBeenCalledWith(
    'session-789',
    expect.objectContaining({ name: 'comparison-snapshot.json' }),
  );
  expect(
    screen.getByText(
      'Loaded snapshots are read-only results. Start a new comparison to edit mappings or load different files.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start new comparison' })).toBeInTheDocument();
});

test('saves the current result from the results step through the app workflow', async () => {
  saveComparisonSnapshotMock.mockResolvedValue(new Blob(['saved snapshot'], { type: 'application/json' }));

  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  fireEvent.click(screen.getByRole('button', { name: 'Select File A' }));
  await screen.findByRole('button', { name: 'Select File B' });
  fireEvent.click(screen.getByRole('button', { name: 'Select File B' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });
  fireEvent.click(screen.getByRole('button', { name: 'Run compare' }));

  await screen.findByText('Mock Summary');
  fireEvent.click(screen.getByRole('button', { name: 'Save result' }));

  await waitFor(() => {
    expect(saveComparisonSnapshotMock).toHaveBeenCalledWith('session-789');
  });
  expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'comparison-snapshot.json');
});
