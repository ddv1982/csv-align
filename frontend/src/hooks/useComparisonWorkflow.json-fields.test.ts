import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  compareFilesMock,
  createSessionMock,
  downloadBlobMock,
  loadFileMock,
  loadPairOrderMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  loadFileMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  exportResults: vi.fn(),
  isTauri: false,
  loadComparisonSnapshot: vi.fn(),
  loadFile: loadFileMock,
  loadPairOrder: loadPairOrderMock,
  saveComparisonSnapshot: vi.fn(),
  savePairOrder: savePairOrderMock,
  suggestMappings: suggestMappingsMock,
}));

vi.mock('../services/browserDownload', () => ({
  downloadBlob: downloadBlobMock,
}));

const FILE_A = new File(['id,payload\n1,{}'], 'left.csv', { type: 'text/csv' });
const FILE_B = new File(['record_id,body\n1,{}'], 'right.csv', { type: 'text/csv' });
const SUMMARY = {
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

beforeEach(() => {
  compareFilesMock.mockReset();
  createSessionMock.mockReset();
  downloadBlobMock.mockReset();
  loadFileMock.mockReset();
  loadPairOrderMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  compareFilesMock.mockResolvedValue({ success: true, results: [], summary: SUMMARY });
  savePairOrderMock.mockResolvedValue(new Blob(['saved'], { type: 'text/plain' }));
  suggestMappingsMock.mockResolvedValue({ mappings: [] });
});

async function loadFiles() {
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  return result;
}

test('stores virtual headers from file loads and defaults missing virtual_headers to empty arrays', async () => {
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    file_name: file.name,
    headers: file.name === FILE_A.name ? ['id', 'payload'] : ['record_id', 'body'],
    virtual_headers: file.name === FILE_A.name ? ['payload.customer.id'] : undefined,
    columns: [],
    row_count: 1,
  }));

  const result = await loadFiles();

  expect(result.current.state.fileA?.virtualHeaders).toEqual(['payload.customer.id']);
  expect(result.current.state.fileB?.virtualHeaders).toEqual([]);
});

test('compare payload preserves selected virtual JSON field strings unchanged', async () => {
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    file_name: file.name,
    headers: file.name === FILE_A.name ? ['id', 'payload'] : ['record_id', 'body'],
    virtual_headers: file.name === FILE_A.name ? ['payload.customer.id', 'payload.customer.name'] : ['body.customer.id', 'body.customer.name'],
    columns: [],
    row_count: 1,
  }));

  const result = await loadFiles();

  await act(async () => {
    await result.current.handleCompare(
      ['payload.customer.id'],
      ['body.customer.id'],
      ['payload.customer.name'],
      ['body.customer.name'],
      [{ file_a_column: 'payload.customer.name', file_b_column: 'body.customer.name', mapping_type: 'manual' }],
      INITIAL_NORMALIZATION_CONFIG,
    );
  });

  expect(compareFilesMock).toHaveBeenCalledWith('session-1', {
    key_columns_a: ['payload.customer.id'],
    key_columns_b: ['body.customer.id'],
    comparison_columns_a: ['payload.customer.name'],
    comparison_columns_b: ['body.customer.name'],
    column_mappings: [{ file_a_column: 'payload.customer.name', file_b_column: 'body.customer.name', mapping_type: 'manual', similarity: undefined }],
    normalization: INITIAL_NORMALIZATION_CONFIG,
  });
});

test('auto-pair still requests suggestions from physical headers only', async () => {
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    file_name: file.name,
    headers: file.name === FILE_A.name ? ['id', 'payload'] : ['record_id', 'body'],
    virtual_headers: file.name === FILE_A.name ? ['payload.customer.name'] : ['body.customer.name'],
    columns: [],
    row_count: 1,
  }));

  const result = await loadFiles();

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['id'],
      keyColumnsB: ['record_id'],
      comparisonColumnsA: [],
      comparisonColumnsB: [],
    });
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(suggestMappingsMock).toHaveBeenCalledWith('session-1', {
    columns_a: ['id', 'payload'],
    columns_b: ['record_id', 'body'],
  });
});

test('pair order save and load preserve virtual JSON field strings unchanged', async () => {
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name ? 'a' : 'b',
    file_name: file.name,
    headers: file.name === FILE_A.name ? ['id', 'payload'] : ['record_id', 'body'],
    virtual_headers: file.name === FILE_A.name ? ['payload.customer.id', 'payload.customer.name'] : ['body.customer.id', 'body.customer.name'],
    columns: [],
    row_count: 1,
  }));
  loadPairOrderMock.mockResolvedValue({
    selection: {
      key_columns_a: ['payload.customer.id'],
      key_columns_b: ['body.customer.id'],
      comparison_columns_a: ['payload.customer.name'],
      comparison_columns_b: ['body.customer.name'],
    },
  });
  const pairOrderFile = new File(['saved'], 'pair-order.txt', { type: 'text/plain' });
  const result = await loadFiles();

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['payload.customer.id'],
      keyColumnsB: ['body.customer.id'],
      comparisonColumnsA: ['payload.customer.name'],
      comparisonColumnsB: ['body.customer.name'],
    });
  });

  await act(async () => {
    await result.current.handleSavePairOrder();
  });

  expect(savePairOrderMock).toHaveBeenCalledWith('session-1', {
    key_columns_a: ['payload.customer.id'],
    key_columns_b: ['body.customer.id'],
    comparison_columns_a: ['payload.customer.name'],
    comparison_columns_b: ['body.customer.name'],
  });

  await act(async () => {
    await result.current.handleLoadPairOrder(pairOrderFile);
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['payload.customer.id'],
    keyColumnsB: ['body.customer.id'],
    comparisonColumnsA: ['payload.customer.name'],
    comparisonColumnsB: ['body.customer.name'],
  });
});
