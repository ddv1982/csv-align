import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  compareFilesMock,
  createSessionMock,
  downloadBlobMock,
  loadFileMock,
  loadComparisonSnapshotMock,
  loadPairOrderMock,
  saveComparisonSnapshotMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  loadFileMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  saveComparisonSnapshotMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  exportResults: vi.fn(),
  isTauri: false,
  loadComparisonSnapshot: loadComparisonSnapshotMock,
  loadFile: loadFileMock,
  loadPairOrder: loadPairOrderMock,
  saveComparisonSnapshot: saveComparisonSnapshotMock,
  savePairOrder: savePairOrderMock,
  suggestMappings: suggestMappingsMock,
}));

vi.mock('../services/browserDownload', () => ({
  downloadBlob: downloadBlobMock,
}));

const FILE_COLUMNS = [
  { index: 0, name: 'id', data_type: 'string' as const },
  { index: 1, name: 'name', data_type: 'string' as const },
];

const FILE_A = new File(['id,name\n1,Alice'], 'left.csv', { type: 'text/csv' });
const FILE_B = new File(['id,name\n1,Alice'], 'right.csv', { type: 'text/csv' });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  compareFilesMock.mockReset();
  createSessionMock.mockReset();
  downloadBlobMock.mockReset();
  loadFileMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  loadPairOrderMock.mockReset();
  saveComparisonSnapshotMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    headers: ['id', 'name'],
    columns: FILE_COLUMNS,
    row_count: 1,
  }));
});

test('saves the current pair order and downloads the returned text file', async () => {
  savePairOrderMock.mockResolvedValue(new Blob(['saved'], { type: 'text/plain' }));

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['id'],
      keyColumnsB: ['id'],
      comparisonColumnsA: ['name'],
      comparisonColumnsB: ['name'],
    });
  });

  await act(async () => {
    await result.current.handleSavePairOrder();
  });

  expect(savePairOrderMock).toHaveBeenCalledWith('session-1', {
    key_columns_a: ['id'],
    key_columns_b: ['id'],
    comparison_columns_a: ['name'],
    comparison_columns_b: ['name'],
  });
  expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'pair-order.txt');
  expect(result.current.state.loading).toBe(false);
  expect(result.current.state.error).toBeNull();
});

test('restores saved selection state from a loaded pair-order file', async () => {
  const pairOrderFile = new File(['saved'], 'pair-order.txt', { type: 'text/plain' });
  loadPairOrderMock.mockResolvedValue({
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['name'],
    },
  });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['name'],
      keyColumnsB: ['name'],
      comparisonColumnsA: ['id'],
      comparisonColumnsB: ['id'],
    });
  });

  await act(async () => {
    await result.current.handleLoadPairOrder(pairOrderFile);
  });

  expect(loadPairOrderMock).toHaveBeenCalledWith('session-1', pairOrderFile);
  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['id'],
    keyColumnsB: ['id'],
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['name'],
  });
  expect(result.current.state.loading).toBe(false);
});

test('keeps the current pair order unchanged when loading fails', async () => {
  const pairOrderFile = new File(['bad'], 'pair-order.txt', { type: 'text/plain' });
  loadPairOrderMock.mockRejectedValueOnce('Saved pair order does not match the currently loaded File B columns');

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['name'],
      keyColumnsB: ['name'],
      comparisonColumnsA: ['id'],
      comparisonColumnsB: ['id'],
    });
  });

  await act(async () => {
    await result.current.handleLoadPairOrder(pairOrderFile);
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['name'],
    keyColumnsB: ['name'],
    comparisonColumnsA: ['id'],
    comparisonColumnsB: ['id'],
  });
  expect(result.current.state.error).toBe('Saved pair order does not match the currently loaded File B columns');
  expect(result.current.state.loading).toBe(false);
});

test('ignores stale comparison results after loading a newer pair order', async () => {
  const pairOrderFile = new File(['saved'], 'pair-order.txt', { type: 'text/plain' });
  const compareDeferred = deferred<{
    success: boolean;
    results: never[];
    summary: {
      total_rows_a: number;
      total_rows_b: number;
      matches: number;
      mismatches: number;
      missing_left: number;
      missing_right: number;
      unkeyed_left: number;
      unkeyed_right: number;
      duplicates_a: number;
      duplicates_b: number;
    };
  }>();

  compareFilesMock.mockReturnValue(compareDeferred.promise);
  loadPairOrderMock.mockResolvedValue({
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['name'],
    },
  });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['id'],
      keyColumnsB: ['id'],
      comparisonColumnsA: ['id'],
      comparisonColumnsB: ['id'],
    });
  });

  let comparePromise!: Promise<void>;
  await act(async () => {
    comparePromise = result.current.handleCompare(
      ['id'],
      ['id'],
      ['id'],
      ['id'],
      [],
      result.current.normalizationConfig,
    );
  });

  await act(async () => {
    await result.current.handleLoadPairOrder(pairOrderFile);
  });

  compareDeferred.resolve({
    success: true,
    results: [],
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

  await act(async () => {
    await comparePromise;
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['id'],
    keyColumnsB: ['id'],
    comparisonColumnsA: ['name'],
    comparisonColumnsB: ['name'],
  });
  expect(result.current.step).toBe('configure');
  expect(result.current.state.summary).toBeNull();
  expect(result.current.state.results).toEqual([]);
  expect(result.current.state.loading).toBe(false);
});

test('keeps in-flight comparison current when a newer pair order load fails', async () => {
  const pairOrderFile = new File(['bad'], 'pair-order.txt', { type: 'text/plain' });
  const compareDeferred = deferred<{
    success: boolean;
    results: never[];
    summary: {
      total_rows_a: number;
      total_rows_b: number;
      matches: number;
      mismatches: number;
      missing_left: number;
      missing_right: number;
      unkeyed_left: number;
      unkeyed_right: number;
      duplicates_a: number;
      duplicates_b: number;
    };
  }>();

  compareFilesMock.mockReturnValue(compareDeferred.promise);
  loadPairOrderMock.mockRejectedValueOnce('Saved pair order does not match the currently loaded File B columns');

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  let comparePromise!: Promise<void>;
  await act(async () => {
    comparePromise = result.current.handleCompare(
      ['id'],
      ['id'],
      ['name'],
      ['name'],
      [],
      result.current.normalizationConfig,
    );
  });

  await act(async () => {
    await result.current.handleLoadPairOrder(pairOrderFile);
  });

  compareDeferred.resolve({
    success: true,
    results: [],
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

  await act(async () => {
    await comparePromise;
  });

  await waitFor(() => {
    expect(result.current.step).toBe('results');
  });
  expect(result.current.state.summary).toMatchObject({ matches: 1 });
  expect(result.current.state.error).toBeNull();
  expect(result.current.state.loading).toBe(false);
});
