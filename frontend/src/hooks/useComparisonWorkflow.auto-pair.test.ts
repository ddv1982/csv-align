import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const {
  createSessionMock,
  loadFileMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  loadFileMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: vi.fn(),
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
const INSTANCE_FILE_A = new File(['legacy_id,legacy_name,legacy_sire\n101,Alpha,Bull A'], 'instance-left.csv', { type: 'text/csv' });
const INSTANCE_FILE_B = new File(['animal_number,animal_name,sire_name\n101,Alpha,Bull A'], 'instance-right.csv', { type: 'text/csv' });

beforeEach(() => {
  createSessionMock.mockReset();
  loadFileMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  loadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: file.name === FILE_A.name || file.name === INSTANCE_FILE_A.name ? 'a' : 'b',
    headers: file.name === FILE_A.name
      ? ['id', 'full_name', 'email_address']
      : file.name === FILE_B.name
        ? ['record_id', 'display_name', 'email']
        : file.name === INSTANCE_FILE_A.name
          ? ['legacy_id', 'legacy_name', 'legacy_sire']
          : ['animal_number', 'animal_name', 'sire_name'],
    columns: [],
    row_count: 1,
  }));
});

test('auto-pairs confident instance-backed suggestions even when the headers are unrelated', async () => {
  suggestMappingsMock.mockResolvedValue({
    mappings: [
      { file_a_column: 'legacy_id', file_b_column: 'animal_number', mapping_type: 'fuzzy', similarity: 0.94 },
      { file_a_column: 'legacy_name', file_b_column: 'animal_name', mapping_type: 'fuzzy', similarity: 0.96 },
      { file_a_column: 'legacy_sire', file_b_column: 'sire_name', mapping_type: 'fuzzy', similarity: 0.95 },
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

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: [],
    keyColumnsB: [],
    comparisonColumnsA: ['legacy_name', 'legacy_sire'],
    comparisonColumnsB: ['animal_name', 'sire_name'],
  });
  expect(result.current.state.error).toBeNull();
});

test('auto-pairs confident comparison columns using File A order and excludes implicit key columns', async () => {
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

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(suggestMappingsMock).toHaveBeenCalledWith('session-1', {
    columns_a: ['id', 'full_name', 'email_address'],
    columns_b: ['record_id', 'display_name', 'email'],
  });
  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: [],
    keyColumnsB: [],
    comparisonColumnsA: ['full_name', 'email_address'],
    comparisonColumnsB: ['display_name', 'email'],
  });
  expect(result.current.state.error).toBeNull();
  expect(result.current.state.loading).toBe(false);
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

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('b');
  });

  expect(result.current.mappingSelection).toEqual({
    keyColumnsA: [],
    keyColumnsB: [],
    comparisonColumnsA: ['full_name', 'email_address'],
    comparisonColumnsB: ['display_name', 'email'],
  });
});

test('keeps the current selection when no confident comparison pairs are found', async () => {
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

  await act(async () => {
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(result.current.mappingSelection.comparisonColumnsA).toEqual([]);
  expect(result.current.mappingSelection.comparisonColumnsB).toEqual([]);
  expect(result.current.state.error).toBe('No confident comparison column pairs were found using File A order.');
  expect(result.current.state.loading).toBe(false);
});
