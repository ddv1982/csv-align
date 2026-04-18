import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  createSessionMock,
  downloadBlobMock,
  loadFileMock,
  loadComparisonSnapshotMock,
  loadPairOrderMock,
  saveComparisonSnapshotMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
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
  compareFiles: vi.fn(),
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

beforeEach(() => {
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
  loadPairOrderMock.mockRejectedValueOnce(new Error('Saved pair order does not match the currently loaded File B columns'));

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
