import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { filterResults } from '../features/results/presentation';
import type { ComparisonNormalizationConfig } from '../types/api';
import type { MappingSelectionState } from '../types/ui';
import {
  INITIAL_WORKFLOW_STATE,
  SNAPSHOT_READ_ONLY_ERROR,
  getErrorMessage,
  workflowReducer,
} from './useComparisonWorkflow.reducer';
import { useWorkflowSessionLifecycle } from './useWorkflowSessionLifecycle';
import { useWorkflowComparisonActions } from './useWorkflowComparisonActions';
import { useWorkflowPersistenceActions } from './useWorkflowPersistenceActions';
import { useWorkflowNavigation } from './useWorkflowNavigation';

export function useComparisonWorkflow() {
  const [workflowState, dispatch] = useReducer(workflowReducer, INITIAL_WORKFLOW_STATE);

  const { appState: state, step, mappingSelection, normalizationConfig } = workflowState;
  const currentSessionIdRef = useRef<string | null>(state.sessionId);
  const workflowGenerationRef = useRef(0);
  const workflowMutationRef = useRef(0);

  useEffect(() => {
    currentSessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  const beginWorkflowRequest = useCallback((sessionId: string | null, invalidatesExisting = false) => {
    if (invalidatesExisting) {
      workflowMutationRef.current += 1;
    }

    return {
      sessionId,
      generation: workflowGenerationRef.current,
      mutation: workflowMutationRef.current,
    };
  }, []);

  const isCurrentWorkflowRequest = useCallback((token: { sessionId: string | null; generation: number; mutation: number }) => (
    workflowGenerationRef.current === token.generation
    && workflowMutationRef.current === token.mutation
    && (token.sessionId === null || currentSessionIdRef.current === token.sessionId)
  ), []);

  const advanceWorkflowGeneration = useCallback(() => {
    workflowGenerationRef.current += 1;
    workflowMutationRef.current += 1;
    currentSessionIdRef.current = null;
  }, []);

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

  const { handleReset } = useWorkflowSessionLifecycle({
    state,
    dispatch,
    setWorkflowError,
    beginWorkflowRequest,
    isCurrentWorkflowRequest,
    advanceWorkflowGeneration,
  });

  const {
    handleFileSelection,
    handleCompare,
    handleAutoPairComparisonColumns,
  } = useWorkflowComparisonActions({
    state,
    mappingSelection,
    dispatch,
    startLoading,
    failLoading,
    blockSnapshotFollowOnWorkflow,
    beginWorkflowRequest,
    isCurrentWorkflowRequest,
  });

  const {
    handleExportCsv,
    handleExportHtml,
    handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot,
    handleSavePairOrder,
    handleLoadPairOrder,
  } = useWorkflowPersistenceActions({
    state,
    mappingSelection,
    dispatch,
    startLoading,
    failLoading,
    blockSnapshotFollowOnWorkflow,
    beginWorkflowRequest,
    isCurrentWorkflowRequest,
  });

  const {
    unlockedSteps,
    handleFilterChange,
    handleStepNavigation,
    handleBackToConfigure,
    handleBackToSelection,
    handleContinueToConfigure,
  } = useWorkflowNavigation({
    state,
    step,
    dispatch,
    blockSnapshotFollowOnWorkflow,
  });

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
