import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { AppState, CompareRequest, ComparisonNormalizationConfig, FileLetter, MappingResponse, ResultFilter } from '../types/api';
import { INITIAL_MAPPING_SELECTION, type AppStep, type MappingSelectionState } from '../types/ui';

const INITIAL_STATE: AppState = {
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

const SNAPSHOT_READ_ONLY_ERROR = 'Loaded comparison snapshots are read-only. Use Reset to start a new comparison.';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function buildCompareRequestPayload(
  keyColumnsA: string[],
  keyColumnsB: string[],
  comparisonColumnsA: string[],
  comparisonColumnsB: string[],
  columnMappings: MappingResponse[],
  normalization: ComparisonNormalizationConfig,
): { request: CompareRequest; retainedMappings: MappingResponse[] } {
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
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [step, setStep] = useState<AppStep>('select');
  const [mappingSelection, setMappingSelection] = useState<MappingSelectionState>(INITIAL_MAPPING_SELECTION);
  const [normalizationConfig, setNormalizationConfig] = useState<ComparisonNormalizationConfig>(INITIAL_NORMALIZATION_CONFIG);
  const shouldAutoAdvanceFromSelectionRef = useRef(true);

  const startLoading = useCallback((clearError = true) => {
    setState((previousState) => ({
      ...previousState,
      loading: true,
      ...(clearError ? { error: null } : {}),
    }));
  }, []);

  const finishLoading = useCallback((updates: Partial<AppState> = {}) => {
    setState((previousState) => ({
      ...previousState,
      ...updates,
      loading: false,
    }));
  }, []);

  const failLoading = useCallback((error: unknown) => {
    setState((previousState) => ({
      ...previousState,
      error: getErrorMessage(error),
      loading: false,
    }));
  }, []);

  const setWorkflowError = useCallback((error: unknown) => {
    setState((previousState) => ({
      ...previousState,
      error: getErrorMessage(error),
    }));
  }, []);

  const blockSnapshotFollowOnWorkflow = useCallback(() => {
    setState((previousState) => previousState.snapshotReadOnly
      ? { ...previousState, error: SNAPSHOT_READ_ONLY_ERROR }
      : previousState);
  }, []);

  useEffect(() => {
    async function initSession() {
      try {
        const response = await createSession();
        setState((previousState) => ({ ...previousState, sessionId: response.session_id }));
      } catch (error) {
        setWorkflowError(error);
      }
    }

    initSession();
  }, [setWorkflowError]);

  useEffect(() => {
    if (
      shouldAutoAdvanceFromSelectionRef.current
      && state.fileA
      && state.fileB
      && state.results.length === 0
      && state.summary === null
      && step === 'select'
    ) {
      setState((previousState) => ({ ...previousState, mappings: [] }));
      setMappingSelection(INITIAL_MAPPING_SELECTION);
      setNormalizationConfig(INITIAL_NORMALIZATION_CONFIG);
      setStep('configure');
    }
  }, [state.fileA, state.fileB, state.results.length, state.summary, step]);

  const handleFileSelection = useCallback(async (file: File, fileLetter: 'a' | 'b') => {
    if (!state.sessionId) {
      return;
    }

    shouldAutoAdvanceFromSelectionRef.current = true;
    startLoading();

    try {
      const response = await loadFile(state.sessionId, file, fileLetter);
      const fileData = {
        name: file.name,
        headers: response.headers,
        columns: response.columns,
        rowCount: response.row_count,
      };

      finishLoading({ [fileLetter === 'a' ? 'fileA' : 'fileB']: fileData } as Partial<AppState>);
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, finishLoading, startLoading, state.sessionId]);

  const handleCompare = useCallback(async (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingResponse[],
    normalization: ComparisonNormalizationConfig,
  ) => {
    if (!state.sessionId) {
      return;
    }

    if (state.snapshotReadOnly) {
      blockSnapshotFollowOnWorkflow();
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

      finishLoading({
        mappings: retainedMappings,
        results: response.results,
        summary: response.summary,
      });
      setStep('results');
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, finishLoading, startLoading, state.sessionId, state.snapshotReadOnly]);

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
      finishLoading();
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, finishLoading, startLoading, state.sessionId]);

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
      finishLoading();
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, finishLoading, startLoading, state.sessionId]);

  const handleLoadComparisonSnapshot = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    startLoading();

    try {
      const response = await loadComparisonSnapshot(state.sessionId, file);
      if (response) {
        setMappingSelection({
          keyColumnsA: response.selection.key_columns_a,
          keyColumnsB: response.selection.key_columns_b,
          comparisonColumnsA: response.selection.comparison_columns_a,
          comparisonColumnsB: response.selection.comparison_columns_b,
        });
        setNormalizationConfig(response.normalization);
        finishLoading({
          fileA: {
            name: response.file_a.name,
            headers: response.file_a.headers,
            columns: response.file_a.columns,
            rowCount: response.file_a.row_count,
          },
          fileB: {
            name: response.file_b.name,
            headers: response.file_b.headers,
            columns: response.file_b.columns,
            rowCount: response.file_b.row_count,
          },
          mappings: response.mappings,
          results: response.results,
          summary: response.summary,
          snapshotReadOnly: true,
          filter: 'all',
        });
        setStep('results');
        return;
      }

      finishLoading();
    } catch (error) {
      failLoading(error);
    }
  }, [failLoading, finishLoading, startLoading, state.sessionId]);

  const handleFilterChange = useCallback((filter: ResultFilter) => {
    setState((previousState) => ({ ...previousState, filter }));
  }, []);

  const handleSavePairOrder = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    if (state.snapshotReadOnly) {
      blockSnapshotFollowOnWorkflow();
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

      finishLoading();
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, finishLoading, mappingSelection, startLoading, state.sessionId, state.snapshotReadOnly]);

  const handleLoadPairOrder = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    if (state.snapshotReadOnly) {
      blockSnapshotFollowOnWorkflow();
      return;
    }

    startLoading();

    try {
      const response = await loadPairOrder(state.sessionId, file);
      if (response) {
        setMappingSelection({
          keyColumnsA: response.selection.key_columns_a,
          keyColumnsB: response.selection.key_columns_b,
          comparisonColumnsA: response.selection.comparison_columns_a,
          comparisonColumnsB: response.selection.comparison_columns_b,
        });
      }

      finishLoading();
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, finishLoading, startLoading, state.sessionId, state.snapshotReadOnly]);

  const handleAutoPairComparisonColumns = useCallback(async (leadingSide: FileLetter) => {
    if (!state.sessionId || !state.fileA || !state.fileB) {
      return;
    }

    if (state.snapshotReadOnly) {
      blockSnapshotFollowOnWorkflow();
      return;
    }

    const hasExplicitKeySelection = mappingSelection.keyColumnsA.length > 0
      && mappingSelection.keyColumnsB.length > 0
      && mappingSelection.keyColumnsA.length === mappingSelection.keyColumnsB.length;

    if (!hasExplicitKeySelection) {
      setState((previousState) => ({
        ...previousState,
        error: 'Select the same number of key columns in File A and File B before using auto-pair.',
      }));
      return;
    }

    startLoading();

    try {
      const response = await suggestMappings(state.sessionId, {
        columns_a: state.fileA.headers,
        columns_b: state.fileB.headers,
      });
      const autoPairSelection = buildAutoPairSelection({
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
        autoPairSelection.comparisonColumnsA.length === mappingSelection.keyColumnsA.length;

      if (noAdditionalComparisonPairsFound) {
        setState((previousState) => ({
          ...previousState,
          error: `No confident comparison column pairs were found using ${leadingSide === 'a' ? 'File A' : 'File B'} order.`,
          loading: false,
          mappings: response.mappings,
        }));
        return;
      }

      setMappingSelection((previousSelection) => ({
        ...previousSelection,
        ...autoPairSelection,
      }));
      setState((previousState) => ({
        ...previousState,
        mappings: response.mappings,
        loading: false,
      }));
    } catch (error) {
      failLoading(error);
    }
  }, [blockSnapshotFollowOnWorkflow, failLoading, mappingSelection.keyColumnsA, mappingSelection.keyColumnsB, startLoading, state.fileA, state.fileB, state.sessionId, state.snapshotReadOnly]);

  const resetWorkflowState = useCallback(() => {
    setState(INITIAL_STATE);
    setMappingSelection(INITIAL_MAPPING_SELECTION);
    setNormalizationConfig(INITIAL_NORMALIZATION_CONFIG);
    setStep('select');
  }, []);

  const handleReset = useCallback(async () => {
    resetWorkflowState();

    try {
      const response = await createSession();
      setState((previousState) => ({ ...previousState, sessionId: response.session_id }));
    } catch (error) {
      setWorkflowError(error);
    }
  }, [resetWorkflowState, setWorkflowError]);

  return {
    state,
    step,
    mappingSelection,
    normalizationConfig,
    filteredResults: filterResults(state.results, state.filter),
    isSnapshotReadOnly: state.snapshotReadOnly,
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
    handleBackToConfigure: () => {
      if (state.snapshotReadOnly) {
        blockSnapshotFollowOnWorkflow();
        return;
      }

      setStep('configure');
    },
    handleBackToSelection: () => {
      if (state.snapshotReadOnly) {
        blockSnapshotFollowOnWorkflow();
        return;
      }

      shouldAutoAdvanceFromSelectionRef.current = false;
      setStep('select');
    },
    handleContinueToConfigure: () => {
      if (state.snapshotReadOnly) {
        blockSnapshotFollowOnWorkflow();
        return;
      }

      setStep('configure');
    },
  };
}
