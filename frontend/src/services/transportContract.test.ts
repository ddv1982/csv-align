import { describe, expect, expectTypeOf, test } from 'vitest';
import compareResponseFixture from '../../../contracts/fixtures/compare-response.json';
import errorBodyFixtures from '../../../contracts/fixtures/error-bodies.json';
import transportContract from '../../../contracts/transport-contract.json';
import type {
  CompareResponse,
  DifferenceResponse,
  MappingDto,
  ResultResponse,
  SummaryResponse,
} from '../types/api';
import { API_TRANSPORT_OPERATIONS } from './apiRoutes';
import { RESOURCE_LIMITS } from './contracts';
import { TAURI_COMMANDS } from './tauriCommands';

const frontendOperations = [
  { key: 'createSession', http: API_TRANSPORT_OPERATIONS.createSession, tauriCommand: TAURI_COMMANDS.createSession },
  { key: 'deleteSession', http: API_TRANSPORT_OPERATIONS.deleteSession, tauriCommand: TAURI_COMMANDS.deleteSession },
  { key: 'loadFile', http: API_TRANSPORT_OPERATIONS.loadFile, tauriCommand: TAURI_COMMANDS.loadCsvBytes },
  { key: 'suggestMappings', http: API_TRANSPORT_OPERATIONS.suggestMappings, tauriCommand: TAURI_COMMANDS.suggestMappings },
  { key: 'compare', http: API_TRANSPORT_OPERATIONS.compare, tauriCommand: TAURI_COMMANDS.compare },
  { key: 'exportResults', http: API_TRANSPORT_OPERATIONS.exportResults, tauriCommand: TAURI_COMMANDS.exportResults },
  { key: 'exportResultsHtml', http: null, tauriCommand: TAURI_COMMANDS.exportResultsHtml },
  { key: 'savePairOrder', http: API_TRANSPORT_OPERATIONS.savePairOrder, tauriCommand: TAURI_COMMANDS.savePairOrder },
  { key: 'loadPairOrder', http: API_TRANSPORT_OPERATIONS.loadPairOrder, tauriCommand: TAURI_COMMANDS.loadPairOrder },
  { key: 'saveComparisonSnapshot', http: API_TRANSPORT_OPERATIONS.saveComparisonSnapshot, tauriCommand: TAURI_COMMANDS.saveComparisonSnapshot },
  { key: 'loadComparisonSnapshot', http: { ...API_TRANSPORT_OPERATIONS.loadComparisonSnapshot, requestBody: 'rawSnapshotJson' }, tauriCommand: TAURI_COMMANDS.loadComparisonSnapshot },
] as const;

const typedCompareResponseFixture: CompareResponse = {
  ...compareResponseFixture,
  results: compareResponseFixture.results.map((result) => ({
    ...result,
    result_type: result.result_type as ResultResponse['result_type'],
  })),
};

const exactMappingFixture = {
  file_a_column: 'name',
  file_b_column: 'display_name',
  mapping_type: 'exact',
  similarity: null,
} satisfies MappingDto;

type ContractDifferenceResponse = {
  column_a: string;
  column_b: string;
  value_a: string;
  value_b: string;
};

type ContractResultResponse = {
  result_type:
    | 'match'
    | 'mismatch'
    | 'missing_left'
    | 'missing_right'
    | 'unkeyed_left'
    | 'unkeyed_right'
    | 'duplicate_file_a'
    | 'duplicate_file_b'
    | 'duplicate_both';
  key: string[];
  values_a: string[];
  values_b: string[];
  duplicate_values_a: string[][];
  duplicate_values_b: string[][];
  differences: ContractDifferenceResponse[];
};

type ContractSummaryResponse = {
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

type ContractCompareResponse = {
  success: boolean;
  results: ContractResultResponse[];
  summary: ContractSummaryResponse;
};

describe('checked transport contract', () => {
  test('matches frontend operation keys, HTTP routes and methods, and Tauri commands', () => {
    expect(frontendOperations).toEqual(transportContract.operations);
  });

  test('matches every frontend-visible resource limit', () => {
    expect(RESOURCE_LIMITS).toEqual(transportContract.limits);
  });

  test('locks the frontend compare DTO and all result variants', () => {
    expectTypeOf<DifferenceResponse>().toEqualTypeOf<ContractDifferenceResponse>();
    expectTypeOf<ResultResponse>().toEqualTypeOf<ContractResultResponse>();
    expectTypeOf<SummaryResponse>().toEqualTypeOf<ContractSummaryResponse>();
    expectTypeOf<CompareResponse>().toEqualTypeOf<ContractCompareResponse>();

    expect(Object.keys(typedCompareResponseFixture).sort()).toEqual(['results', 'success', 'summary']);
    expect(typedCompareResponseFixture.results.map((result) => result.result_type)).toEqual([
      'match',
      'mismatch',
      'missing_left',
      'missing_right',
      'unkeyed_left',
      'unkeyed_right',
      'duplicate_file_a',
      'duplicate_file_b',
      'duplicate_both',
    ]);
    for (const result of typedCompareResponseFixture.results) {
      expect(Object.keys(result).sort()).toEqual([
        'differences',
        'duplicate_values_a',
        'duplicate_values_b',
        'key',
        'result_type',
        'values_a',
        'values_b',
      ]);
    }
  });

  test('accepts nullable similarity from exact mapping responses', () => {
    expect(exactMappingFixture.similarity).toBeNull();
  });

  test('locks canonical error body keys and codes', () => {
    expect(errorBodyFixtures.map(({ body }) => body.code)).toEqual([
      'not_found',
      'validation',
      'bad_input',
      'parse',
      'superseded',
      'io',
      'internal',
    ]);
    for (const { body } of errorBodyFixtures) {
      expect(Object.keys(body).sort()).toEqual(['code', 'error']);
      expect(typeof body.error).toBe('string');
    }
  });
});
