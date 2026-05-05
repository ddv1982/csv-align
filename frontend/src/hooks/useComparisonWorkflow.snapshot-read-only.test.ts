import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useComparisonWorkflow } from './useComparisonWorkflow';

const SNAPSHOT_READ_ONLY_ERROR = 'Loaded comparison snapshots are read-only. Use Reset to start a new comparison.';

const {
  compareFilesMock,
  createSessionMock,
  loadComparisonSnapshotMock,
  loadPairOrderMock,
  savePairOrderMock,
  suggestMappingsMock,
} = vi.hoisted(() => ({
  compareFilesMock: vi.fn(),
  createSessionMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  compareFiles: compareFilesMock,
  createSession: createSessionMock,
  downloadBlob: vi.fn(),
  exportResults: vi.fn(),
  isTauri: false,
  loadComparisonSnapshot: loadComparisonSnapshotMock,
  loadFile: vi.fn(),
  loadPairOrder: loadPairOrderMock,
  saveComparisonSnapshot: vi.fn(),
  savePairOrder: savePairOrderMock,
  suggestMappings: suggestMappingsMock,
}));

function buildSnapshotResponse() {
  return {
    file_a: {
      name: 'left.csv',
      headers: ['id', 'name'],
      virtual_headers: ['person.id', 'person.name'],
      columns: [
        { index: 0, name: 'id', data_type: 'string' as const },
        { index: 1, name: 'name', data_type: 'string' as const },
      ],
      row_count: 2,
    },
    file_b: {
      name: 'right.csv',
      headers: ['record_id', 'display_name'],
      virtual_headers: ['person.id', 'person.name'],
      columns: [
        { index: 0, name: 'record_id', data_type: 'string' as const },
        { index: 1, name: 'display_name', data_type: 'string' as const },
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
        mapping_type: 'manual' as const,
        similarity: undefined,
      },
    ],
      normalization: {
        treat_empty_as_null: true,
        null_tokens: [],
        null_token_case_insensitive: true,
        flexible_key_matching: false,
        case_insensitive: true,
        trim_whitespace: true,
        numeric_equivalence: false,
        decimal_rounding: {
          enabled: false,
          decimals: 0,
        },
        date_normalization: {
          enabled: false,
          formats: [],
      },
    },
    results: [
      {
        result_type: 'match' as const,
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
  };
}

beforeEach(() => {
  compareFilesMock.mockReset();
  createSessionMock.mockReset();
  loadComparisonSnapshotMock.mockReset();
  loadPairOrderMock.mockReset();
  savePairOrderMock.mockReset();
  suggestMappingsMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-1' });
  loadComparisonSnapshotMock.mockResolvedValue(buildSnapshotResponse());
});

test('keeps loaded snapshots on the results step and blocks navigation back to configuration', async () => {
  const snapshotFile = new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' });
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleLoadComparisonSnapshot(snapshotFile);
  });

  act(() => {
    result.current.handleBackToConfigure();
  });

  expect(result.current.isSnapshotReadOnly).toBe(true);
  expect(result.current.step).toBe('results');
  expect(result.current.state.error).toBe(SNAPSHOT_READ_ONLY_ERROR);
});

test('blocks compare and pair-order workflows after loading a snapshot', async () => {
  const snapshotFile = new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' });
  const pairOrderFile = new File(['saved'], 'pair-order.txt', { type: 'text/plain' });
  const { result } = renderHook(() => useComparisonWorkflow());

  await waitFor(() => {
    expect(result.current.state.sessionId).toBe('session-1');
  });

  await act(async () => {
    await result.current.handleLoadComparisonSnapshot(snapshotFile);
  });

  await act(async () => {
    await result.current.handleCompare(
      ['id'],
      ['record_id'],
      ['name'],
      ['display_name'],
      [],
      result.current.normalizationConfig,
    );
    await result.current.handleSavePairOrder();
    await result.current.handleLoadPairOrder(pairOrderFile);
    await result.current.handleAutoPairComparisonColumns('a');
  });

  expect(compareFilesMock).not.toHaveBeenCalled();
  expect(savePairOrderMock).not.toHaveBeenCalled();
  expect(loadPairOrderMock).not.toHaveBeenCalled();
  expect(suggestMappingsMock).not.toHaveBeenCalled();
  expect(result.current.state.error).toBe(SNAPSHOT_READ_ONLY_ERROR);
  expect(result.current.step).toBe('results');
});
