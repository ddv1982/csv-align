import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { buildAutoPairSelection } from '../features/mapping/autoPair';
import { filterResults } from '../features/results/presentation';
import {
  compareFiles,
  createSession,
  downloadBlob,
  exportResults,
  loadComparisonSnapshot,
  loadFile,
  loadPairOrder,
  saveComparisonSnapshot,
  savePairOrder,
  suggestMappings,
} from '../services/tauri';
import type { AppState, CompareRequest, ComparisonNormalizationConfig, FileLetter, MappingDto, ResultFilter } from '../types/api';
import { INITIAL_MAPPING_SELECTION, type AppStep, type MappingSelectionState } from '../types/ui';

type LoadComparisonSnapshotResult = Exclude<Awaited<ReturnType<typeof loadComparisonSnapshot>>, void>;

const SNAPSHOT_READ_ONLY_ERROR = 'Loaded comparison snapshots are read-only. Use Reset to start a new comparison.';

type WorkflowState = {
  appState: AppState;
  step: AppStep;
  mappingSelection: MappingSelectionState;
  normalizationConfig: ComparisonNormalizationConfig;
};

type WorkflowAction =
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
    response: LoadComparisonSnapshotResult;
  }
  | { type: 'pairOrderLoaded'; selection: MappingSelectionState }
  | { type: 'filterChanged'; filter: ResultFilter }
  | { type: 'autoPairSucceeded'; mappings: MappingDto[]; selection: MappingSelectionState }
  | { type: 'autoPairUnavailable'; mappings: MappingDto[]; error: string }
  | { type: 'mappingSelectionChanged'; selection: MappingSelectionState }
  | { type: 'normalizationConfigChanged'; normalizationConfig: ComparisonNormalizationConfig }
  | { type: 'stepChanged'; step: AppStep }
  | { type: 'resetWorkflow' };

const INITIAL_APP_STATE: AppState = {
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

const INITIAL_WORKFLOW_STATE: WorkflowState = {
  appState: INITIAL_APP_STATE,
  step: 'select',
  mappingSelection: INITIAL_MAPPING_SELECTION,
  normalizationConfig: INITIAL_NORMALIZATION_CONFIG,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function buildCompareRequestPayload(
  keyColumnsA: string[],
  keyColumnsB: string[],
  comparisonColumnsA: string[],
  comparisonColumnsB: string[],
  columnMappings: MappingDto[],
  normalization: ComparisonNormalizationConfig,
): { request: CompareRequest; retainedMappings: MappingDto[] } {
  const keyPairs = new Set(keyColumnsA.map((fileAColumn, index) => `${fileAColumn}::${keyColumnsB[index] ?? ''}`));

  const filteredComparisonPairs = comparisonColumnsA
    .map((fileAColumn, index) => ({
      fileAColumn,
      fileBColumn: comparisonColumnsB[index] ?? '',
    }))
    .filter((pair) => !keyPairs.has(`${pair.fileAColumn}::${pair.fileBColumn}`));

  const retainedMappings = columnMappings.filter(
    (mapping) => !keyPairs.has(`${mapping.file_a_column}::${mapping.file_b_column}`),
  );

  return {
    request: {
      key_columns_a: keyColumnsA,
      key_columns_b: keyColumnsB,
      comparison_columns_a: filteredComparisonPairs.map((pair) => pair.fileAColumn),
      comparison_columns_b: filteredComparisonPairs.map((pair) => pair.fileBColumn),
      column_mappings: retainedMappings.map((mapping) => ({
        file_a_column: mapping.file_a_column,
        file_b_column: mapping.file_b_column,
        mapping_type: mapping.mapping_type,
        similarity: mapping.similarity,
      })),
      normalization,
    },
    retainedMappings,
  };
}

export function useComparisonWorkflow() {
  const [workflowState, dispatch] = useReducer((state: WorkflowState, action: WorkflowAction): WorkflowState => {
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
  }, INITIAL_WORKFLOW_STATE);

  const { appState: state, step, mappingSelection, normalizationConfig } = workflowState;

  const startLoading = useCallback((clearError = true) => {
    dispatch({ type: 'loadingStarted', clearError });
  }, []);

  const failLoading = useCallback((error: unknown) => {
    dispatch({ type: 'loadingFailed', error: getErrorMessage(error) });
  }, []);

  const setWorkflowError = useCallback((error: unknown) => {
    dispatch({ type: 'workflowError', error: getErrorMessage(error) });
  }, []);

  const blockSnapshotFollowOnWorkflow = useCallback(() => {
    if (state.snapshotReadOnly) {
      dispatch({ type: 'workflowError', error: SNAPSHOT_READ_ONLY_ERROR });
      return true;
    }

    return false;
  }, [state.snapshotReadOnly]);

  useEffect(() => {
    async function initSession() {
      try {
        const response = await createSession();
        dispatch({ type: 'sessionCreated', sessionId: response.session_id });
      } catch (error) {
        setWorkflowError(error);
      }
    }

    initSession();
  }, [setWorkflowError]);
  const handleFileSelection = useCallback(async (file: File, fileLetter: 'a' | 'b') => {
    if (!state.sessionId) {
      return;
    }

    startLoading();

    try {
      const response = await loadFile(state.sessionId, file, fileLetter);
      const fileData = {
        name: file.name,
        headers: response.headers,
        columns: response.columns,
        rowCount: response.row_count,
      };

      dispatch({ type: 'fileLoaded', fileLetter, fileData });
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, startLoading, state.sessionId]);

  const handleCompare = useCallback(async (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingDto[],
    normalization: ComparisonNormalizationConfig,
  ) => {
    if (!state.sessionId) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    const { request, retainedMappings } = buildCompareRequestPayload(
      keyColumnsA,
      keyColumnsB,
      comparisonColumnsA,
      comparisonColumnsB,
      columnMappings,
      normalization,
    );

    startLoading();

    try {
      const response = await compareFiles(state.sessionId, request);

      dispatch({
        type: 'compareSucceeded',
        mappings: retainedMappings,
        results: response.results,
        summary: response.summary,
      });
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, startLoading, state.sessionId]);

  const handleExport = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    startLoading(false);

    try {
      const blob = await exportResults(state.sessionId);
      if (blob) {
        downloadBlob(blob, 'comparison-results.csv');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, startLoading, state.sessionId]);

  const handleSaveComparisonSnapshot = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    startLoading();

    try {
      const blob = await saveComparisonSnapshot(state.sessionId);
      if (blob) {
        downloadBlob(blob, 'comparison-snapshot.json');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, startLoading, state.sessionId]);

  const handleLoadComparisonSnapshot = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    startLoading();

    try {
      const response = await loadComparisonSnapshot(state.sessionId, file);
      if (response) {
        dispatch({ type: 'snapshotLoaded', response });
        return;
      }

      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, startLoading, state.sessionId]);

  const handleFilterChange = useCallback((filter: ResultFilter) => {
    dispatch({ type: 'filterChanged', filter });
  }, []);

  const handleSavePairOrder = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    startLoading();

    try {
      const blob = await savePairOrder(state.sessionId, {
        key_columns_a: mappingSelection.keyColumnsA,
        key_columns_b: mappingSelection.keyColumnsB,
        comparison_columns_a: mappingSelection.comparisonColumnsA,
        comparison_columns_b: mappingSelection.comparisonColumnsB,
      });

      if (blob) {
        downloadBlob(blob, 'pair-order.txt');
      }

      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, mappingSelection, startLoading, state.sessionId]);

  const handleLoadPairOrder = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    startLoading();

    try {
      const response = await loadPairOrder(state.sessionId, file);
      if (response) {
        dispatch({
          type: 'pairOrderLoaded',
          selection: {
            keyColumnsA: response.selection.key_columns_a,
            keyColumnsB: response.selection.key_columns_b,
            comparisonColumnsA: response.selection.comparison_columns_a,
            comparisonColumnsB: response.selection.comparison_columns_b,
          },
        });
        return;
      }

      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, startLoading, state.sessionId]);

  const handleAutoPairComparisonColumns = useCallback(async (leadingSide: FileLetter) => {
    if (!state.sessionId || !state.fileA || !state.fileB) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    const hasExplicitKeySelection = mappingSelection.keyColumnsA.length > 0
      && mappingSelection.keyColumnsB.length > 0
      && mappingSelection.keyColumnsA.length === mappingSelection.keyColumnsB.length;

    if (!hasExplicitKeySelection) {
      dispatch({
        type: 'workflowError',
        error: 'Select the same number of key columns in File A and File B before using auto-pair.',
      });
      return;
    }

    startLoading();

    try {
      const response = await suggestMappings(state.sessionId, {
        columns_a: state.fileA.headers,
        columns_b: state.fileB.headers,
      });
      const comparisonSelection = buildAutoPairSelection({
        fileAHeaders: state.fileA.headers,
        fileBHeaders: state.fileB.headers,
        mappings: response.mappings,
        leadingSide,
        keyColumnsA: mappingSelection.keyColumnsA,
        keyColumnsB: mappingSelection.keyColumnsB,
        excludedColumnsA: mappingSelection.keyColumnsA,
        excludedColumnsB: mappingSelection.keyColumnsB,
      });

      const noAdditionalComparisonPairsFound =
        comparisonSelection.comparisonColumnsA.length === mappingSelection.keyColumnsA.length;

      if (noAdditionalComparisonPairsFound) {
        dispatch({
          type: 'autoPairUnavailable',
          error: `No confident comparison column pairs were found using ${leadingSide === 'a' ? 'File A' : 'File B'} order.`,
          mappings: response.mappings,
        });
        return;
      }

      dispatch({
        type: 'autoPairSucceeded',
        mappings: response.mappings,
        selection: {
          ...mappingSelection,
          ...comparisonSelection,
        },
      });
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, mappingSelection.keyColumnsA, mappingSelection.keyColumnsB, startLoading, state.fileA, state.fileB, state.sessionId]);

  const handleReset = useCallback(async () => {
    dispatch({ type: 'resetWorkflow' });

    try {
      const response = await createSession();
      dispatch({ type: 'sessionCreated', sessionId: response.session_id });
    } catch (error) {
      setWorkflowError(error);
    }
  }, [setWorkflowError]);

  const unlockedSteps = useMemo(() => {
    const steps: AppStep[] = ['select'];
    const hasBothFiles = Boolean(state.fileA && state.fileB);
    const hasSummary = state.summary !== null;

    if (state.snapshotReadOnly) {
      // Snapshot mode is locked to the loaded results view.
      if (hasSummary) {
        steps.push('results');
      }
      return steps;
    }

    if (hasBothFiles) {
      steps.push('configure');
    }
    if (hasSummary) {
      steps.push('results');
    }

    return steps;
  }, [state.fileA, state.fileB, state.snapshotReadOnly, state.summary]);

  const handleStepNavigation = useCallback((target: AppStep) => {
    if (target === step) {
      return;
    }

    if (state.snapshotReadOnly) {
      if (target === 'results' && state.summary !== null) {
        dispatch({ type: 'stepChanged', step: 'results' });
        return;
      }
      blockSnapshotFollowOnWorkflow();
      return;
    }

    if (target === 'select') {
      dispatch({ type: 'stepChanged', step: 'select' });
      return;
    }

    if (target === 'configure') {
      if (!state.fileA || !state.fileB) {
        return;
      }
      dispatch({ type: 'stepChanged', step: 'configure' });
      return;
    }

    if (target === 'results') {
      if (state.summary === null) {
        return;
      }
      dispatch({ type: 'stepChanged', step: 'results' });
    }
  }, [blockSnapshotFollowOnWorkflow, state.fileA, state.fileB, state.snapshotReadOnly, state.summary, step]);

  const setMappingSelection = useCallback((selection: MappingSelectionState | ((previous: MappingSelectionState) => MappingSelectionState)) => {
    const nextSelection = typeof selection === 'function' ? selection(mappingSelection) : selection;
    dispatch({ type: 'mappingSelectionChanged', selection: nextSelection });
  }, [mappingSelection]);

  const setNormalizationConfig = useCallback((
    nextNormalizationConfig:
      | ComparisonNormalizationConfig
      | ((previous: ComparisonNormalizationConfig) => ComparisonNormalizationConfig),
  ) => {
    dispatch({
      type: 'normalizationConfigChanged',
      normalizationConfig: typeof nextNormalizationConfig === 'function'
        ? nextNormalizationConfig(normalizationConfig)
        : nextNormalizationConfig,
    });
  }, [normalizationConfig]);

  const handleBackToConfigure = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'configure' });
  }, [blockSnapshotFollowOnWorkflow]);

  const handleBackToSelection = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'select' });
  }, [blockSnapshotFollowOnWorkflow]);

  const handleContinueToConfigure = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'configure' });
  }, [blockSnapshotFollowOnWorkflow]);

  const filteredResults = useMemo(() => filterResults(state.results, state.filter), [state.filter, state.results]);

  return {
    state,
    step,
    mappingSelection,
    normalizationConfig,
    filteredResults,
    isSnapshotReadOnly: state.snapshotReadOnly,
    unlockedSteps,
    setMappingSelection,
    setNormalizationConfig,
    handleFileSelection,
    handleCompare,
    handleExport,
    handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot,
    handleSavePairOrder,
    handleLoadPairOrder,
    handleAutoPairComparisonColumns,
    handleFilterChange,
    handleReset,
    handleStepNavigation,
    handleBackToConfigure,
    handleBackToSelection,
    handleContinueToConfigure,
  };
}
