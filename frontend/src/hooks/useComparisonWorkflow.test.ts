import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import type { ComparisonNormalizationConfig, MappingDto } from '../types/api';
import { INITIAL_MAPPING_SELECTION } from '../types/ui';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  compareFilesMock,
  createSessionMock,
  downloadBlobMock,
  exportResultsMock,
  loadComparisonSnapshotMock,
  loadPairOrderMock,
  loadFileMock,
  saveComparisonSnapshotMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  exportResultsMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  loadFileMock: vi.fn(),
  saveComparisonSnapshotMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  downloadBlob: downloadBlobMock,
  exportResults: exportResultsMock,
  loadComparisonSnapshot: loadComparisonSnapshotMock,
  loadPairOrder: loadPairOrderMock,
  loadFile: loadFileMock,
  saveComparisonSnapshot: saveComparisonSnapshotMock,
  savePairOrder: savePairOrderMock,
  suggestMappings: suggestMappingsMock,
}));

const FILE_COLUMNS = [
  { index: 0, name: 'id', data_type: 'string' as const },
  { index: 1, name: 'name', data_type: 'string' as const },
];

const FILE_A = new File(['id,name\n1,Alice'], 'left.csv', { type: 'text/csv' });
const FILE_B = new File(['id,name\n1,Alice'], 'right.csv', { type: 'text/csv' });

const COLUMN_MAPPINGS: MappingDto[] = [
  {
    file_a_column: 'name',
    file_b_column: 'name',
    mapping_type: 'manual',
    similarity: 0.98,
  },
];

const NORMALIZATION: ComparisonNormalizationConfig = {
  ...INITIAL_NORMALIZATION_CONFIG,
  case_insensitive: true,
};

beforeEach(() => {
  compareFilesMock.mockReset();
  createSessionMock.mockReset();
  downloadBlobMock.mockReset();
  exportResultsMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  loadPairOrderMock.mockReset();
  loadFileMock.mockReset();
  saveComparisonSnapshotMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    headers: ['id', 'name'],
    columns: FILE_COLUMNS,
    row_count: file.name === FILE_A.name ? 2 : 3,
  }));
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
      {
        result_type: 'duplicate_filea',
        key: ['2'],
        values_a: ['Bob'],
        values_b: ['Bob'],
        duplicate_values_a: [['Bob']],
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
      duplicates_a: 1,
      duplicates_b: 0,
    },
  });
  loadPairOrderMock.mockResolvedValue({
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['name'],
    },
  });
  savePairOrderMock.mockResolvedValue(undefined);
});

test('surfaces a bootstrap session error when initial session creation fails', async () => {
  createSessionMock.mockRejectedValueOnce(new Error('session bootstrap failed'));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.error).toBe('session bootstrap failed');
  });

  expect(result.current.state.sessionId).toBeNull();
  expect(result.current.step).toBe('select');
  expect(result.current.state.loading).toBe(false);
});

test('bootstraps a session and advances to configure after both files load', async () => {
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
  });

  expect(result.current.state.loading).toBe(false);
  expect(result.current.step).toBe('select');
  expect(result.current.state.fileA).toMatchObject({
    name: 'left.csv',
    headers: ['id', 'name'],
    rowCount: 2,
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  await waitFor(() => {
    expect(result.current.step).toBe('configure');
  });

  expect(loadFileMock).toHaveBeenNthCalledWith(1, 'session-1', FILE_A, 'a');
  expect(loadFileMock).toHaveBeenNthCalledWith(2, 'session-1', FILE_B, 'b');
  expect(result.current.state.fileB).toMatchObject({
    name: 'right.csv',
    headers: ['id', 'name'],
    rowCount: 3,
  });
  expect(result.current.mappingSelection).toEqual(INITIAL_MAPPING_SELECTION);
  expect(result.current.normalizationConfig).toEqual(INITIAL_NORMALIZATION_CONFIG);
});

test('submits comparisons, updates filtered results, and resets with a fresh session', async () => {
  createSessionMock
    .mockResolvedValueOnce({ session_id: 'session-1' })
    .mockResolvedValueOnce({ session_id: 'session-2' });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  await waitFor(() => {
    expect(result.current.step).toBe('configure');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['id'],
      keyColumnsB: ['id'],
      comparisonColumnsA: ['name'],
      comparisonColumnsB: ['name'],
    });
    result.current.setNormalizationConfig(NORMALIZATION);
  });

  await act(async () => {
    await result.current.handleCompare(
      ['id'],
      ['id'],
      ['name'],
      ['name'],
      COLUMN_MAPPINGS,
      NORMALIZATION,
    );
  });

  await waitFor(() => {
    expect(result.current.step).toBe('results');
  });

  expect(compareFilesMock).toHaveBeenCalledWith('session-1', {
    key_columns_a: ['id'],
    key_columns_b: ['id'],
    comparison_columns_a: ['name'],
    comparison_columns_b: ['name'],
    column_mappings: [
      {
        file_a_column: 'name',
        file_b_column: 'name',
        mapping_type: 'manual',
        similarity: 0.98,
      },
    ],
    normalization: NORMALIZATION,
  });
  expect(result.current.state.mappings).toEqual(COLUMN_MAPPINGS);
  expect(result.current.state.summary).toMatchObject({ matches: 1, duplicates_a: 1 });
  expect(result.current.filteredResults).toHaveLength(2);

  act(() => {
    result.current.handleFilterChange('duplicate');
  });

  expect(result.current.state.filter).toBe('duplicate');
  expect(result.current.filteredResults).toEqual([
    expect.objectContaining({ result_type: 'duplicate_filea' }),
  ]);

  await act(async () => {
    await result.current.handleReset();
  });

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-2');
  });

  expect(createSessionMock).toHaveBeenCalledTimes(2);
  expect(result.current.step).toBe('select');
  expect(result.current.state.fileA).toBeNull();
  expect(result.current.state.fileB).toBeNull();
  expect(result.current.state.results).toEqual([]);
  expect(result.current.state.summary).toBeNull();
  expect(result.current.state.filter).toBe('all');
  expect(result.current.mappingSelection).toEqual(INITIAL_MAPPING_SELECTION);
  expect(result.current.normalizationConfig).toEqual(INITIAL_NORMALIZATION_CONFIG);
});

test('keeps the workflow on configure and clears loading when compare fails', async () => {
  compareFilesMock.mockRejectedValueOnce(new Error('compare failed'));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  await waitFor(() => {
    expect(result.current.step).toBe('configure');
  });

  await act(async () => {
    await result.current.handleCompare(
      ['id'],
      ['id'],
      ['name'],
      ['name'],
      COLUMN_MAPPINGS,
      NORMALIZATION,
    );
  });

  expect(result.current.step).toBe('configure');
  expect(result.current.state.results).toEqual([]);
  expect(result.current.state.summary).toBeNull();
  expect(result.current.state.error).toBe('compare failed');
  expect(result.current.state.loading).toBe(false);
});

test('sets an export error and clears loading when export fails', async () => {
  exportResultsMock.mockRejectedValueOnce(new Error('export failed'));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleExport();
  });

  expect(exportResultsMock).toHaveBeenCalledWith('session-1');
  expect(downloadBlobMock).not.toHaveBeenCalled();
  expect(result.current.state.error).toBe('export failed');
  expect(result.current.state.loading).toBe(false);
});
