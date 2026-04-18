import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  createSessionMock,
  downloadBlobMock,
  loadComparisonSnapshotMock,
  saveComparisonSnapshotMock,
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  saveComparisonSnapshotMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: vi.fn(),
  createSession: createSessionMock,
  exportResults: vi.fn(),
  isTauri: false,
  loadComparisonSnapshot: loadComparisonSnapshotMock,
  loadFile: vi.fn(),
  loadPairOrder: vi.fn(),
  saveComparisonSnapshot: saveComparisonSnapshotMock,
  savePairOrder: vi.fn(),
  suggestMappings: vi.fn(),
}));

vi.mock('../services/browserDownload', () => ({
  downloadBlob: downloadBlobMock,
}));

beforeEach(() => {
  createSessionMock.mockReset();
  downloadBlobMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  saveComparisonSnapshotMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
});

test('saves the current completed comparison snapshot and downloads the returned file', async () => {
  saveComparisonSnapshotMock.mockResolvedValue(new Blob(['saved snapshot'], { type: 'application/json' }));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleSaveComparisonSnapshot();
  });

  expect(saveComparisonSnapshotMock).toHaveBeenCalledWith('session-1');
  expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'comparison-snapshot.json');
  expect(result.current.state.loading).toBe(false);
  expect(result.current.state.error).toBeNull();
});

test('loads a saved comparison snapshot into the results workflow state', async () => {
  const snapshotFile = new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' });
  loadComparisonSnapshotMock.mockResolvedValue({
    file_a: {
      name: 'left.csv',
      headers: ['id', 'name'],
      columns: [
        { index: 0, name: 'id', data_type: 'string' },
        { index: 1, name: 'name', data_type: 'string' },
      ],
      row_count: 2,
    },
    file_b: {
      name: 'right.csv',
      headers: ['record_id', 'display_name'],
      columns: [
        { index: 0, name: 'record_id', data_type: 'string' },
        { index: 1, name: 'display_name', data_type: 'string' },
      ],
      row_count: 2,
    },
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['display_name'],
    },
    mappings: [
      {
        file_a_column: 'name',
        file_b_column: 'display_name',
        mapping_type: 'manual',
        similarity: undefined,
      },
    ],
    normalization: {
      treat_empty_as_null: true,
      null_tokens: ['n/a'],
      null_token_case_insensitive: true,
      case_insensitive: true,
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
      total_rows_a: 2,
      total_rows_b: 2,
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

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleLoadComparisonSnapshot(snapshotFile);
  });

  expect(loadComparisonSnapshotMock).toHaveBeenCalledWith('session-1', snapshotFile);
  expect(result.current.step).toBe('results');
  expect(result.current.state.fileA).toEqual({
    name: 'left.csv',
    headers: ['id', 'name'],
    columns: [
      { index: 0, name: 'id', data_type: 'string' },
      { index: 1, name: 'name', data_type: 'string' },
    ],
    rowCount: 2,
  });
  expect(result.current.state.fileB?.name).toBe('right.csv');
  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['id'],
    keyColumnsB: ['record_id'],
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['display_name'],
  });
  expect(result.current.normalizationConfig.case_insensitive).toBe(true);
  expect(result.current.state.mappings).toEqual([
    {
      file_a_column: 'name',
      file_b_column: 'display_name',
      mapping_type: 'manual',
      similarity: undefined,
    },
  ]);
  expect(result.current.state.summary).toMatchObject({ matches: 1 });
  expect(result.current.state.filter).toBe('all');
  expect(result.current.state.loading).toBe(false);
});
