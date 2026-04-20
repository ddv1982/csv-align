import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import type { ComparisonNormalizationConfig, MappingDto } from '../types/api';
import { INITIAL_MAPPING_SELECTION } from '../types/ui';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  compareFilesMock,
  createSessionMock,
  deleteSessionMock,
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
  deleteSessionMock: vi.fn(),
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
  deleteSession: deleteSessionMock,
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
  deleteSessionMock.mockReset();
  downloadBlobMock.mockReset();
  exportResultsMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  loadPairOrderMock.mockReset();
  loadFileMock.mockReset();
  saveComparisonSnapshotMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  deleteSessionMock.mockResolvedValue(undefined);
  loadFileMock.mockImplementation(async (_sessionId: string, file: File | string) => ({
    success: true,
    file_letter: typeof file !== 'string' && file.name === FILE_A.name ? 'a' : 'b',
    headers: ['id', 'name'],
    columns: FILE_COLUMNS,
    row_count: typeof file !== 'string' && file.name === FILE_A.name ? 2 : 3,
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
        result_type: 'duplicate_file_a',
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

test('uses the basename when step 1 loads a Tauri file path', async () => {
  const tauriFilePath = '/Users/vriesd/Desktop/from-drop.csv';
  loadFileMock.mockResolvedValueOnce({
    success: true,
    file_letter: 'a',
    headers: ['id', 'name'],
    columns: FILE_COLUMNS,
    row_count: 4,
  });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(tauriFilePath, 'a');
  });

  expect(loadFileMock).toHaveBeenCalledWith('session-1', tauriFilePath, 'a');
  expect(result.current.state.fileA).toMatchObject({
    name: 'from-drop.csv',
    headers: ['id', 'name'],
    rowCount: 4,
  });
});

test('uses the basename when step 1 loads a Windows-style Tauri file path', async () => {
  const tauriFilePath = 'C:\\Users\\vriesd\\Desktop\\from-drop.csv';
  loadFileMock.mockResolvedValueOnce({
    success: true,
    file_letter: 'b',
    headers: ['id', 'name'],
    columns: FILE_COLUMNS,
    row_count: 5,
  });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(tauriFilePath, 'b');
  });

  expect(loadFileMock).toHaveBeenCalledWith('session-1', tauriFilePath, 'b');
  expect(result.current.state.fileB).toMatchObject({
    name: 'from-drop.csv',
    headers: ['id', 'name'],
    rowCount: 5,
  });
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
    expect.objectContaining({ result_type: 'duplicate_file_a' }),
  ]);

  await act(async () => {
    await result.current.handleReset();
  });

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-2');
  });

  expect(deleteSessionMock).toHaveBeenCalledWith('session-1');
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

test('keeps public handlers stable across rerenders when their dependencies do not change', async () => {
  const { result, rerender } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  const initialHandlers = {
    setMappingSelection: result.current.setMappingSelection,
    setNormalizationConfig: result.current.setNormalizationConfig,
    handleFileSelection: result.current.handleFileSelection,
    handleCompare: result.current.handleCompare,
    handleExport: result.current.handleExport,
    handleSaveComparisonSnapshot: result.current.handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot: result.current.handleLoadComparisonSnapshot,
    handleSavePairOrder: result.current.handleSavePairOrder,
    handleLoadPairOrder: result.current.handleLoadPairOrder,
    handleAutoPairComparisonColumns: result.current.handleAutoPairComparisonColumns,
    handleFilterChange: result.current.handleFilterChange,
    handleReset: result.current.handleReset,
    handleStepNavigation: result.current.handleStepNavigation,
    handleBackToConfigure: result.current.handleBackToConfigure,
    handleBackToSelection: result.current.handleBackToSelection,
    handleContinueToConfigure: result.current.handleContinueToConfigure,
  };

  rerender();

  expect(result.current.setMappingSelection).toBe(initialHandlers.setMappingSelection);
  expect(result.current.setNormalizationConfig).toBe(initialHandlers.setNormalizationConfig);
  expect(result.current.handleFileSelection).toBe(initialHandlers.handleFileSelection);
  expect(result.current.handleCompare).toBe(initialHandlers.handleCompare);
  expect(result.current.handleExport).toBe(initialHandlers.handleExport);
  expect(result.current.handleSaveComparisonSnapshot).toBe(initialHandlers.handleSaveComparisonSnapshot);
  expect(result.current.handleLoadComparisonSnapshot).toBe(initialHandlers.handleLoadComparisonSnapshot);
  expect(result.current.handleSavePairOrder).toBe(initialHandlers.handleSavePairOrder);
  expect(result.current.handleLoadPairOrder).toBe(initialHandlers.handleLoadPairOrder);
  expect(result.current.handleAutoPairComparisonColumns).toBe(initialHandlers.handleAutoPairComparisonColumns);
  expect(result.current.handleFilterChange).toBe(initialHandlers.handleFilterChange);
  expect(result.current.handleReset).toBe(initialHandlers.handleReset);
  expect(result.current.handleStepNavigation).toBe(initialHandlers.handleStepNavigation);
  expect(result.current.handleBackToConfigure).toBe(initialHandlers.handleBackToConfigure);
  expect(result.current.handleBackToSelection).toBe(initialHandlers.handleBackToSelection);
  expect(result.current.handleContinueToConfigure).toBe(initialHandlers.handleContinueToConfigure);
});

test('surfaces a reset error when deleting the outgoing session fails', async () => {
  createSessionMock.mockResolvedValueOnce({ session_id: 'session-1' });
  deleteSessionMock.mockRejectedValueOnce(new Error('delete failed'));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleReset();
  });

  await waitFor(() => {
    expect(result.current.state.error).toBe('delete failed');
  });

  expect(deleteSessionMock).toHaveBeenCalledWith('session-1');
  expect(createSessionMock).toHaveBeenCalledTimes(1);
  expect(result.current.state.sessionId).toBeNull();
  expect(result.current.step).toBe('select');
});
