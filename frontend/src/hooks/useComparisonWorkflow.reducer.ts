import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import type {
  AppState,
  CompareRequest,
  ComparisonNormalizationConfig,
  FileLetter,
  LoadComparisonSnapshotResponse,
  MappingDto,
  ResultFilter,
} from '../types/api';
import { INITIAL_MAPPING_SELECTION, type AppStep, type MappingSelectionState } from '../types/ui';

export const SNAPSHOT_READ_ONLY_ERROR = 'Loaded comparison snapshots are read-only. Use Reset to start a new comparison.';

export type WorkflowState = {
  appState: AppState;
  step: AppStep;
  mappingSelection: MappingSelectionState;
  normalizationConfig: ComparisonNormalizationConfig;
};

export type WorkflowAction =
  | { type: 'sessionCreated'; sessionId: string }
  | { type: 'workflowError'; error: string }
  | { type: 'loadingStarted'; clearError: boolean }
  | { type: 'loadingFailed'; error: string }
  | { type: 'fileLoaded'; fileLetter: FileLetter; fileData: NonNullable<AppState['fileA']> }
  | {
    type: 'compareSucceeded';
    mappings: MappingDto[];
    results: AppState['results'];
    summary: NonNullable<AppState['summary']>;
  }
  | { type: 'downloadCompleted' }
  | {
    type: 'snapshotLoaded';
    response: LoadComparisonSnapshotResponse;
  }
  | { type: 'pairOrderLoaded'; selection: MappingSelectionState }
  | { type: 'filterChanged'; filter: ResultFilter }
  | { type: 'autoPairSucceeded'; mappings: MappingDto[]; selection: MappingSelectionState }
  | { type: 'autoPairUnavailable'; mappings: MappingDto[]; error: string }
  | { type: 'mappingSelectionChanged'; selection: MappingSelectionState }
  | { type: 'normalizationConfigChanged'; normalizationConfig: ComparisonNormalizationConfig }
  | { type: 'stepChanged'; step: AppStep }
  | { type: 'resetWorkflow' };

export const INITIAL_APP_STATE: AppState = {
  sessionId: null,
  fileA: null,
  fileB: null,
  mappings: [],
  results: [],
  summary: null,
  snapshotReadOnly: false,
  filter: 'all',
  error: null,
  loading: false,
};

export const INITIAL_WORKFLOW_STATE: WorkflowState = {
  appState: INITIAL_APP_STATE,
  step: 'select',
  mappingSelection: INITIAL_MAPPING_SELECTION,
  normalizationConfig: INITIAL_NORMALIZATION_CONFIG,
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function buildCompareRequestPayload(
  keyColumnsA: string[],
  keyColumnsB: string[],
  comparisonColumnsA: string[],
  comparisonColumnsB: string[],
  columnMappings: MappingDto[],
  normalization: ComparisonNormalizationConfig,
): { request: CompareRequest; retainedMappings: MappingDto[] } {
  return {
    request: {
      key_columns_a: keyColumnsA,
      key_columns_b: keyColumnsB,
      comparison_columns_a: comparisonColumnsA,
      comparison_columns_b: comparisonColumnsB,
      column_mappings: columnMappings.map((mapping) => ({
        file_a_column: mapping.file_a_column,
        file_b_column: mapping.file_b_column,
        mapping_type: mapping.mapping_type,
        similarity: mapping.similarity,
      })),
      normalization,
    },
    retainedMappings: columnMappings,
  };
}

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'sessionCreated':
      return {
        ...state,
        appState: {
          ...state.appState,
          sessionId: action.sessionId,
        },
      };
    case 'workflowError':
      return {
        ...state,
        appState: {
          ...state.appState,
          error: action.error,
        },
      };
    case 'loadingStarted':
      return {
        ...state,
        appState: {
          ...state.appState,
          loading: true,
          ...(action.clearError ? { error: null } : {}),
        },
      };
    case 'loadingFailed':
      return {
        ...state,
        appState: {
          ...state.appState,
          error: action.error,
          loading: false,
        },
      };
    case 'fileLoaded': {
      const nextAppState: AppState = {
        ...state.appState,
        [action.fileLetter === 'a' ? 'fileA' : 'fileB']: action.fileData,
        loading: false,
      };
      const shouldAdvance = Boolean(
        nextAppState.fileA
        && nextAppState.fileB
        && nextAppState.results.length === 0
        && nextAppState.summary === null
        && state.step === 'select',
      );

      return {
        appState: {
          ...nextAppState,
          ...(shouldAdvance ? { mappings: [] } : {}),
        },
        step: shouldAdvance ? 'configure' : state.step,
        mappingSelection: shouldAdvance ? INITIAL_MAPPING_SELECTION : state.mappingSelection,
        normalizationConfig: shouldAdvance ? INITIAL_NORMALIZATION_CONFIG : state.normalizationConfig,
      };
    }
    case 'compareSucceeded':
      return {
        ...state,
        step: 'results',
        appState: {
          ...state.appState,
          mappings: action.mappings,
          results: action.results,
          summary: action.summary,
          loading: false,
        },
      };
    case 'downloadCompleted':
      return {
        ...state,
        appState: {
          ...state.appState,
          loading: false,
        },
      };
    case 'snapshotLoaded':
      return {
        step: 'results',
        mappingSelection: {
          keyColumnsA: action.response.selection.key_columns_a,
          keyColumnsB: action.response.selection.key_columns_b,
          comparisonColumnsA: action.response.selection.comparison_columns_a,
          comparisonColumnsB: action.response.selection.comparison_columns_b,
        },
        normalizationConfig: action.response.normalization,
        appState: {
          ...state.appState,
          fileA: {
            name: action.response.file_a.name,
            headers: action.response.file_a.headers,
            columns: action.response.file_a.columns,
            rowCount: action.response.file_a.row_count,
          },
          fileB: {
            name: action.response.file_b.name,
            headers: action.response.file_b.headers,
            columns: action.response.file_b.columns,
            rowCount: action.response.file_b.row_count,
          },
          mappings: action.response.mappings,
          results: action.response.results,
          summary: action.response.summary,
          snapshotReadOnly: true,
          filter: 'all',
          loading: false,
        },
      };
    case 'pairOrderLoaded':
      return {
        ...state,
        mappingSelection: action.selection,
        appState: {
          ...state.appState,
          loading: false,
        },
      };
    case 'filterChanged':
      return {
        ...state,
        appState: {
          ...state.appState,
          filter: action.filter,
        },
      };
    case 'autoPairSucceeded':
      return {
        ...state,
        mappingSelection: {
          ...action.selection,
        },
        appState: {
          ...state.appState,
          mappings: action.mappings,
          loading: false,
          error: null,
        },
      };
    case 'autoPairUnavailable':
      return {
        ...state,
        appState: {
          ...state.appState,
          error: action.error,
          loading: false,
          mappings: action.mappings,
        },
      };
    case 'mappingSelectionChanged':
      return {
        ...state,
        mappingSelection: action.selection,
      };
    case 'normalizationConfigChanged':
      return {
        ...state,
        normalizationConfig: action.normalizationConfig,
      };
    case 'stepChanged':
      return {
        ...state,
        step: action.step,
      };
    case 'resetWorkflow':
      return INITIAL_WORKFLOW_STATE;
  }
}
