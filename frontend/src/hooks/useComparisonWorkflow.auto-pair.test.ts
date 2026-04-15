import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  compareFilesMock,
  createSessionMock,
  loadFileMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  loadFileMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  downloadBlob: vi.fn(),
  exportResults: vi.fn(),
  isTauri: false,
  loadFile: loadFileMock,
  loadPairOrder: vi.fn(),
  savePairOrder: vi.fn(),
  suggestMappings: suggestMappingsMock,
}));

const FILE_A = new File(['id,full_name,email_address\n1,Alice,alice@example.com'], 'left.csv', { type: 'text/csv' });
const FILE_B = new File(['record_id,display_name,email\n1,Alice,alice@example.com'], 'right.csv', { type: 'text/csv' });
const INSTANCE_FILE_A = new File(['source_id,display_label,group_label\n101,Alpha,Group A'], 'instance-left.csv', { type: 'text/csv' });
const INSTANCE_FILE_B = new File(['external_key,public_name,category_name\n101,Alpha,Group A'], 'instance-right.csv', { type: 'text/csv' });

beforeEach(() => {
  createSessionMock.mockReset();
  compareFilesMock.mockReset();
  loadFileMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  compareFilesMock.mockResolvedValue({ results: [], summary: { total_rows: 0, matched_rows: 0, only_in_a: 0, only_in_b: 0, different_rows: 0 } });
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name || file.name === INSTANCE_FILE_A.name ? 'a' : 'b',
    headers: file.name === FILE_A.name
      ? ['id', 'full_name', 'email_address']
      : file.name === FILE_B.name
        ? ['record_id', 'display_name', 'email']
        : file.name === INSTANCE_FILE_A.name
          ? ['source_id', 'display_label', 'group_label']
          : ['external_key', 'public_name', 'category_name'],
    columns: [],
    row_count: 1,
  }));
});

test('auto-pairs confident instance-backed suggestions even when the headers are unrelated', async () => {
  suggestMappingsMock.mockResolvedValue({
    mappings: [
      { file_a_column: 'source_id', file_b_column: 'external_key', mapping_type: 'fuzzy', similarity: 0.94 },
      { file_a_column: 'display_label', file_b_column: 'public_name', mapping_type: 'fuzzy', similarity: 0.96 },
      { file_a_column: 'group_label', file_b_column: 'category_name', mapping_type: 'fuzzy', similarity: 0.95 },
    ],
  });

  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(INSTANCE_FILE_A, 'a');
    await result.current.handleFileSelection(INSTANCE_FILE_B, 'b');
  });

  act(() => {
    result.current.setMappingSelection({
      keyColumnsA: ['source_id'],
      keyColumnsB: ['external_key'],
      comparisonColumnsA: [],
      comparisonColumnsB: [],
    });
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['source_id'],
    keyColumnsB: ['external_key'],
    comparisonColumnsA: ['source_id', 'display_label', 'group_label'],
    comparisonColumnsB: ['external_key', 'public_name', 'category_name'],
  });
  expect(result.current.state.error).toBeNull();
});

test('auto-pairs confident comparison columns using File A order and prepends selected key columns', async () => {
  suggestMappingsMock.mockResolvedValue({
    mappings: [
      { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
    ],
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
      keyColumnsB: ['record_id'],
      comparisonColumnsA: [],
      comparisonColumnsB: [],
    });
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(suggestMappingsMock).toHaveBeenCalledWith('session-1', {
    columns_a: ['id', 'full_name', 'email_address'],
    columns_b: ['record_id', 'display_name', 'email'],
  });
  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['id'],
    keyColumnsB: ['record_id'],
    comparisonColumnsA: ['id', 'full_name', 'email_address'],
    comparisonColumnsB: ['record_id', 'display_name', 'email'],
  });
  expect(result.current.state.error).toBeNull();
  expect(result.current.state.loading).toBe(false);
});

test('removes prepended key pairs before sending the comparison request', async () => {
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleCompare(
      ['id'],
      ['record_id'],
      ['id', 'full_name', 'email_address'],
      ['record_id', 'display_name', 'email'],
      [
        { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'manual' },
        { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'manual' },
        { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'manual' },
      ],
      INITIAL_NORMALIZATION_CONFIG,
    );
  });

  expect(compareFilesMock).toHaveBeenCalledWith('session-1', expect.objectContaining({
    key_columns_a: ['id'],
    key_columns_b: ['record_id'],
    comparison_columns_a: ['full_name', 'email_address'],
    comparison_columns_b: ['display_name', 'email'],
    column_mappings: [
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'manual', similarity: undefined },
      { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'manual', similarity: undefined },
    ],
  }));
});

test('auto-pairs using File B order when File B leads', async () => {
  suggestMappingsMock.mockResolvedValue({
    mappings: [
      { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
    ],
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
      keyColumnsB: ['record_id'],
      comparisonColumnsA: [],
      comparisonColumnsB: [],
    });
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('b');
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: ['id'],
    keyColumnsB: ['record_id'],
    comparisonColumnsA: ['id', 'full_name', 'email_address'],
    comparisonColumnsB: ['record_id', 'display_name', 'email'],
  });
});

test('refuses auto-pairing until matching key columns have been selected', async () => {
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleFileSelection(FILE_A, 'a');
    await result.current.handleFileSelection(FILE_B, 'b');
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(suggestMappingsMock).not.toHaveBeenCalled();
  expect(result.current.state.error).toBe('Select the same number of key columns in File A and File B before using auto-pair.');
});

test('keeps the current selection when no additional confident comparison pairs are found', async () => {
  suggestMappingsMock.mockResolvedValue({
    mappings: [
      { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.82 },
    ],
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
      keyColumnsB: ['record_id'],
      comparisonColumnsA: [],
      comparisonColumnsB: [],
    });
  });

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(result.current.mappingSelection.comparisonColumnsA).toEqual([]);
  expect(result.current.mappingSelection.comparisonColumnsB).toEqual([]);
  expect(result.current.state.error).toBe('No confident comparison column pairs were found using File A order.');
  expect(result.current.state.loading).toBe(false);
});
