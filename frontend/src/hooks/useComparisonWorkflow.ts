import { useCallback, useEffect, useState } from 'react';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { buildAutoPairSelection } from '../features/mapping/autoPair';
import { filterResults } from '../features/results/presentation';
import { compareFiles, createSession, downloadBlob, exportResults, loadFile, loadPairOrder, savePairOrder, suggestMappings } from '../services/tauri';
import type { AppState, ComparisonNormalizationConfig, FileLetter, MappingResponse, ResultFilter } from '../types/api';
import { INITIAL_MAPPING_SELECTION, type AppStep, type MappingSelectionState } from '../types/ui';

const INITIAL_STATE: AppState = {
  sessionId: null,
  fileA: null,
  fileB: null,
  mappings: [],
  results: [],
  summary: null,
  filter: 'all',
  error: null,
  loading: false,
};

export function useComparisonWorkflow() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [step, setStep] = useState<AppStep>('select');
  const [mappingSelection, setMappingSelection] = useState<MappingSelectionState>(INITIAL_MAPPING_SELECTION);
  const [normalizationConfig, setNormalizationConfig] = useState<ComparisonNormalizationConfig>(INITIAL_NORMALIZATION_CONFIG);

  useEffect(() => {
    async function initSession() {
      try {
        const response = await createSession();
        setState((previousState) => ({ ...previousState, sessionId: response.session_id }));
      } catch (error) {
        setState((previousState) => ({ ...previousState, error: (error as Error).message }));
      }
    }

    initSession();
  }, []);

  useEffect(() => {
    if (state.fileA && state.fileB) {
      setState((previousState) => ({ ...previousState, mappings: [] }));
      setMappingSelection(INITIAL_MAPPING_SELECTION);
      setNormalizationConfig(INITIAL_NORMALIZATION_CONFIG);
      setStep('configure');
    }
  }, [state.fileA, state.fileB]);

  const handleFileSelection = useCallback(async (file: File, fileLetter: 'a' | 'b') => {
    if (!state.sessionId) {
      return;
    }

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

    try {
      const response = await loadFile(state.sessionId, file, fileLetter);
      const fileData = {
        name: file.name,
        headers: response.headers,
        columns: response.columns,
        rowCount: response.row_count,
      };

      setState((previousState) => ({
        ...previousState,
        [fileLetter === 'a' ? 'fileA' : 'fileB']: fileData,
        loading: false,
      }));
    } catch (error) {
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [state.sessionId]);

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

    const keyPairs = new Set(keyColumnsA.map((fileAColumn, index) => `${fileAColumn}::${keyColumnsB[index] ?? ''}`));
    const filteredComparisonPairs = comparisonColumnsA
      .map((fileAColumn, index) => ({
        fileAColumn,
        fileBColumn: comparisonColumnsB[index] ?? '',
      }))
      .filter((pair) => !keyPairs.has(`${pair.fileAColumn}::${pair.fileBColumn}`));
    const filteredColumnMappings = columnMappings.filter(
      (mapping) => !keyPairs.has(`${mapping.file_a_column}::${mapping.file_b_column}`),
    );

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

    try {
      const response = await compareFiles(state.sessionId, {
        key_columns_a: keyColumnsA,
        key_columns_b: keyColumnsB,
        comparison_columns_a: filteredComparisonPairs.map((pair) => pair.fileAColumn),
        comparison_columns_b: filteredComparisonPairs.map((pair) => pair.fileBColumn),
        column_mappings: filteredColumnMappings.map((mapping) => ({
          file_a_column: mapping.file_a_column,
          file_b_column: mapping.file_b_column,
          mapping_type: mapping.mapping_type,
          similarity: mapping.similarity,
        })),
        normalization,
      });

      setState((previousState) => ({
        ...previousState,
        mappings: filteredColumnMappings,
        results: response.results,
        summary: response.summary,
        loading: false,
      }));
      setStep('results');
    } catch (error) {
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  const handleExport = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    setState((previousState) => ({ ...previousState, loading: true }));

    try {
      const blob = await exportResults(state.sessionId);
      if (blob) {
        downloadBlob(blob, 'comparison-results.csv');
      }
      setState((previousState) => ({ ...previousState, loading: false }));
    } catch (error) {
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  const handleFilterChange = useCallback((filter: ResultFilter) => {
    setState((previousState) => ({ ...previousState, filter }));
  }, []);

  const handleSavePairOrder = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

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

      setState((previousState) => ({ ...previousState, loading: false }));
    } catch (error) {
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [mappingSelection, state.sessionId]);

  const handleLoadPairOrder = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

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

      setState((previousState) => ({ ...previousState, loading: false }));
    } catch (error) {
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  const handleAutoPairComparisonColumns = useCallback(async (leadingSide: FileLetter) => {
    if (!state.sessionId || !state.fileA || !state.fileB) {
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

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

    try {
      const response = await suggestMappings(state.sessionId, {
        columns_a: state.fileA.headers,
        columns_b: state.fileB.headers,
      });
      const effectiveKeyColumnsA = mappingSelection.keyColumnsA.length > 0
        ? mappingSelection.keyColumnsA
        : [state.fileA.headers[0]];
      const effectiveKeyColumnsB = mappingSelection.keyColumnsB.length > 0
        ? mappingSelection.keyColumnsB
        : [state.fileB.headers[0]];
      const autoPairSelection = buildAutoPairSelection({
        fileAHeaders: state.fileA.headers,
        fileBHeaders: state.fileB.headers,
        mappings: response.mappings,
        leadingSide,
        keyColumnsA: mappingSelection.keyColumnsA,
        keyColumnsB: mappingSelection.keyColumnsB,
        excludedColumnsA: effectiveKeyColumnsA,
        excludedColumnsB: effectiveKeyColumnsB,
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
      setState((previousState) => ({ ...previousState, error: (error as Error).message, loading: false }));
    }
  }, [mappingSelection.keyColumnsA, mappingSelection.keyColumnsB, state.fileA, state.fileB, state.sessionId]);

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
      setState((previousState) => ({ ...previousState, error: (error as Error).message }));
    }
  }, [resetWorkflowState]);

  return {
    state,
    step,
    mappingSelection,
    normalizationConfig,
    filteredResults: filterResults(state.results, state.filter),
    setMappingSelection,
    setNormalizationConfig,
    handleFileSelection,
    handleCompare,
    handleExport,
    handleSavePairOrder,
    handleLoadPairOrder,
    handleAutoPairComparisonColumns,
    handleFilterChange,
    handleReset,
    handleBackToConfigure: () => setStep('configure'),
    handleBackToSelection: () => setStep('select'),
    handleContinueToConfigure: () => setStep('configure'),
  };
}
