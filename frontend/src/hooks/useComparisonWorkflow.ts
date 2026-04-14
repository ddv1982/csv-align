import { useCallback, useEffect, useState } from 'react';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { filterResults } from '../features/results/presentation';
import { compareFiles, createSession, downloadBlob, exportResults, loadFile } from '../services/tauri';
import type { AppState, ComparisonNormalizationConfig, MappingResponse, ResultFilter } from '../types/api';
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

    setState((previousState) => ({ ...previousState, loading: true, error: null }));

    try {
      const response = await compareFiles(state.sessionId, {
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
      });

      setState((previousState) => ({
        ...previousState,
        mappings: columnMappings,
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
    handleFilterChange,
    handleReset,
    handleBackToConfigure: () => setStep('configure'),
    handleBackToSelection: () => setStep('select'),
    handleContinueToConfigure: () => setStep('configure'),
  };
}
