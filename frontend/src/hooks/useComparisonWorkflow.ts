import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { buildAutoPairSelection } from '../features/mapping/autoPair';
import { buildResultsHtmlDocument } from '../features/results/htmlExport';
import { filterResults } from '../features/results/presentation';
import { downloadBlob } from '../services/browserDownload';
import {
  compareFiles,
  createSession,
  deleteSession,
  exportResultsHtml,
  exportResults,
  loadComparisonSnapshot,
  loadFile,
  loadPairOrder,
  saveComparisonSnapshot,
  savePairOrder,
  suggestMappings,
} from '../services/tauri';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto, ResultFilter } from '../types/api';
import type { AppStep, MappingSelectionState } from '../types/ui';
import {
  INITIAL_WORKFLOW_STATE,
  SNAPSHOT_READ_ONLY_ERROR,
  buildCompareRequestPayload,
  getErrorMessage,
  workflowReducer,
} from './useComparisonWorkflow.reducer';
import type { SelectedFileSource } from '../types/ui';

function getSelectedFileName(file: SelectedFileSource): string {
  if (typeof file === 'string') {
    return file.split(/[/\\]/).pop() ?? file;
  }

  return file.name;
}

export function useComparisonWorkflow() {
  const [workflowState, dispatch] = useReducer(workflowReducer, INITIAL_WORKFLOW_STATE);

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
  const handleFileSelection = useCallback(async (file: SelectedFileSource, fileLetter: 'a' | 'b') => {
    if (!state.sessionId) {
      return;
    }

    startLoading();

    try {
      const response = await loadFile(state.sessionId, file, fileLetter);
      const fileData = {
        name: getSelectedFileName(file),
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

  const handleExportCsv = useCallback(async () => {
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

  const handleExportHtml = useCallback(async () => {
    if (state.summary === null) {
      return;
    }

    startLoading(false);

    try {
      const htmlDocument = buildResultsHtmlDocument({
        summary: state.summary,
        fileAName: state.fileA?.name ?? 'File A',
        fileBName: state.fileB?.name ?? 'File B',
        results: state.results,
        initialFilter: state.filter,
      });
      const blob = await exportResultsHtml(htmlDocument);
      if (blob) {
        downloadBlob(blob, 'comparison-results.html');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, startLoading, state.fileA?.name, state.fileB?.name, state.filter, state.results, state.summary]);

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
        error: 'Select the same number of row keys in File A and File B before using auto-pair.',
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
    const outgoingSessionId = state.sessionId;
    dispatch({ type: 'resetWorkflow' });

    try {
      if (outgoingSessionId) {
        await deleteSession(outgoingSessionId);
      }
      const response = await createSession();
      dispatch({ type: 'sessionCreated', sessionId: response.session_id });
    } catch (error) {
      setWorkflowError(error);
    }
  }, [setWorkflowError, state.sessionId]);

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
    handleExportCsv,
    handleExportHtml,
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
