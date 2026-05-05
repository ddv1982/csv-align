import { describe, expect, test } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import type { LoadComparisonSnapshotResponse } from '../types/api';
import { INITIAL_MAPPING_SELECTION } from '../types/ui';
import {
  INITIAL_WORKFLOW_STATE,
  buildCompareRequestPayload,
  getErrorMessage,
  workflowReducer,
} from './useComparisonWorkflow.reducer';

describe('useComparisonWorkflow reducer', () => {
  test('buildCompareRequestPayload preserves overlapping key and comparison pairs', () => {
    const { request, retainedMappings } = buildCompareRequestPayload(
      ['id'],
      ['record_id'],
      ['id', 'name'],
      ['record_id', 'display_name'],
      [
        { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'manual' },
        { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
      ],
      INITIAL_NORMALIZATION_CONFIG,
    );

    expect(request.comparison_columns_a).toEqual(['id', 'name']);
    expect(request.comparison_columns_b).toEqual(['record_id', 'display_name']);
    expect(retainedMappings).toEqual([
      { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'manual' },
      { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
    ]);
  });

  test('fileLoaded advances to configure and resets selection state after both files load', () => {
    const afterFileA = workflowReducer(INITIAL_WORKFLOW_STATE, {
      type: 'fileLoaded',
      fileLetter: 'a',
      fileData: { name: 'left.csv', headers: ['id'], columns: [], rowCount: 1 },
    });

    const nextState = workflowReducer({
      ...afterFileA,
      mappingSelection: {
        keyColumnsA: ['stale'],
        keyColumnsB: ['stale'],
        comparisonColumnsA: ['stale'],
        comparisonColumnsB: ['stale'],
      },
    }, {
      type: 'fileLoaded',
      fileLetter: 'b',
      fileData: { name: 'right.csv', headers: ['record_id'], columns: [], rowCount: 1 },
    });

    expect(nextState.step).toBe('configure');
    expect(nextState.mappingSelection).toEqual(INITIAL_MAPPING_SELECTION);
    expect(nextState.normalizationConfig).toEqual(INITIAL_NORMALIZATION_CONFIG);
  });

  test('fileLoaded clears stale comparison artifacts when replacing a file', () => {
    const nextState = workflowReducer({
      ...INITIAL_WORKFLOW_STATE,
      step: 'results',
      mappingSelection: {
        keyColumnsA: ['id'],
        keyColumnsB: ['record_id'],
        comparisonColumnsA: ['name'],
        comparisonColumnsB: ['display_name'],
      },
      normalizationConfig: {
        ...INITIAL_NORMALIZATION_CONFIG,
        case_insensitive: true,
      },
      appState: {
        ...INITIAL_WORKFLOW_STATE.appState,
        sessionId: 'session-1',
        fileA: { name: 'old-left.csv', headers: ['id', 'name'], columns: [], rowCount: 1 },
        fileB: { name: 'right.csv', headers: ['record_id', 'display_name'], columns: [], rowCount: 1 },
        mappings: [{ file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' }],
        results: [{ result_type: 'match', key: ['1'], values_a: ['Alice'], values_b: ['Alice'], duplicate_values_a: [], duplicate_values_b: [], differences: [] }],
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
        filter: 'match',
      },
    }, {
      type: 'fileLoaded',
      fileLetter: 'a',
      fileData: { name: 'new-left.csv', headers: ['id', 'name'], columns: [], rowCount: 2 },
    });

    expect(nextState.step).toBe('configure');
    expect(nextState.appState.fileA?.name).toBe('new-left.csv');
    expect(nextState.appState.fileB?.name).toBe('right.csv');
    expect(nextState.appState.mappings).toEqual([]);
    expect(nextState.appState.results).toEqual([]);
    expect(nextState.appState.summary).toBeNull();
    expect(nextState.appState.filter).toBe('all');
    expect(nextState.mappingSelection).toEqual(INITIAL_MAPPING_SELECTION);
    expect(nextState.normalizationConfig).toEqual(INITIAL_NORMALIZATION_CONFIG);
  });

  test('snapshotLoaded enters read-only results mode', () => {
    const snapshot: LoadComparisonSnapshotResponse = {
      file_a: {
        name: 'left.csv',
        headers: ['id'],
        virtual_headers: [],
        columns: [],
        row_count: 1,
      },
      file_b: {
        name: 'right.csv',
        headers: ['record_id'],
        virtual_headers: [],
        columns: [],
        row_count: 1,
      },
      selection: {
        key_columns_a: ['id'],
        key_columns_b: ['record_id'],
        comparison_columns_a: ['name'],
        comparison_columns_b: ['display_name'],
      },
      mappings: [],
      normalization: INITIAL_NORMALIZATION_CONFIG,
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
    };

    const nextState = workflowReducer(INITIAL_WORKFLOW_STATE, {
      type: 'snapshotLoaded',
      response: snapshot,
    });

    expect(nextState.step).toBe('results');
    expect(nextState.appState.snapshotReadOnly).toBe(true);
    expect(nextState.appState.filter).toBe('all');
    expect(nextState.mappingSelection).toEqual({
      keyColumnsA: ['id'],
      keyColumnsB: ['record_id'],
      comparisonColumnsA: ['name'],
      comparisonColumnsB: ['display_name'],
    });
  });

  test('compareSucceeded stores results and advances to the results step', () => {
    const nextState = workflowReducer({
      ...INITIAL_WORKFLOW_STATE,
      appState: {
        ...INITIAL_WORKFLOW_STATE.appState,
        loading: true,
      },
    }, {
      type: 'compareSucceeded',
      mappings: [{ file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' }],
      results: [{ result_type: 'match', key: ['1'], values_a: ['Alice'], values_b: ['Alice'], duplicate_values_a: [], duplicate_values_b: [], differences: [] }],
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

    expect(nextState.step).toBe('results');
    expect(nextState.appState.loading).toBe(false);
    expect(nextState.appState.mappings).toEqual([
      { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
    ]);
    expect(nextState.appState.results).toHaveLength(1);
    expect(nextState.appState.summary?.matches).toBe(1);
  });

  test('autoPairUnavailable preserves returned mappings and records the error', () => {
    const nextState = workflowReducer({
      ...INITIAL_WORKFLOW_STATE,
      appState: {
        ...INITIAL_WORKFLOW_STATE.appState,
        loading: true,
      },
    }, {
      type: 'autoPairUnavailable',
      error: 'No confident comparison column pairs were found.',
      mappings: [{ file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.92 }],
    });

    expect(nextState.appState.loading).toBe(false);
    expect(nextState.appState.error).toBe('No confident comparison column pairs were found.');
    expect(nextState.appState.mappings).toEqual([
      { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.92 },
    ]);
  });

  test('getErrorMessage preserves non-Error backend messages', () => {
    expect(getErrorMessage('Saved pair order does not match the currently loaded File B columns')).toBe(
      'Saved pair order does not match the currently loaded File B columns',
    );

    expect(getErrorMessage({ error: 'Saved pair order is missing the current comparison columns' })).toBe(
      'Saved pair order is missing the current comparison columns',
    );
  });

  test('resetWorkflow returns the reducer to its initial state', () => {
    const nextState = workflowReducer({
      step: 'results',
      mappingSelection: {
        keyColumnsA: ['id'],
        keyColumnsB: ['record_id'],
        comparisonColumnsA: ['name'],
        comparisonColumnsB: ['display_name'],
      },
      normalizationConfig: INITIAL_NORMALIZATION_CONFIG,
      appState: {
        ...INITIAL_WORKFLOW_STATE.appState,
        sessionId: 'session-1',
        loading: true,
        error: 'stale error',
        snapshotReadOnly: true,
      },
    }, {
      type: 'resetWorkflow',
    });

    expect(nextState).toEqual(INITIAL_WORKFLOW_STATE);
  });
});
