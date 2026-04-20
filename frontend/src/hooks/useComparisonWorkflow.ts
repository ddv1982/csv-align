import { useCallback, useMemo, useReducer } from 'react';
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
