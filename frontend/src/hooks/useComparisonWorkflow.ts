import { useCallback, useEffect, useReducer, useRef } from 'react';
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
import {
  SUPERSEDED_OPERATION_KINDS,
  type WorkflowOperationKind,
  type WorkflowRequestToken,
} from './workflowRequestToken';

export function useComparisonWorkflow() {
  const [workflowState, dispatch] = useReducer(workflowReducer, INITIAL_WORKFLOW_STATE);

  const { appState: state, step, mappingSelection, normalizationConfig } = workflowState;
  const currentSessionIdRef = useRef<string | null>(state.sessionId);
  const workflowGenerationRef = useRef(0);
  const workflowMutationRef = useRef(0);
  const operationSequenceRef = useRef(0);
  const operationClaimsRef = useRef<Partial<Record<WorkflowOperationKind, number>>>({});

  useEffect(() => {
    currentSessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  const beginWorkflowRequest = useCallback((sessionId: string | null, invalidatesExisting = false) => {
    if (invalidatesExisting) {
      workflowMutationRef.current += 1;
      operationClaimsRef.current = {};
    }

    return {
      sessionId,
      generation: workflowGenerationRef.current,
      mutation: workflowMutationRef.current,
    };
  }, []);

  const beginWorkflowOperation = useCallback((
    sessionId: string,
    operationKind: WorkflowOperationKind,
  ): WorkflowRequestToken => {
    workflowMutationRef.current += 1;
    operationSequenceRef.current += 1;
    const operationSequence = operationSequenceRef.current;

    for (const supersededKind of SUPERSEDED_OPERATION_KINDS[operationKind]) {
      delete operationClaimsRef.current[supersededKind];
    }
    operationClaimsRef.current[operationKind] = operationSequence;

    return {
      sessionId,
      generation: workflowGenerationRef.current,
      mutation: workflowMutationRef.current,
      operationKind,
      operationSequence,
    };
  }, []);

  const isCurrentWorkflowRequest = useCallback((token: WorkflowRequestToken) => {
    const sessionIsCurrent = token.sessionId === null || currentSessionIdRef.current === token.sessionId;
    if (workflowGenerationRef.current !== token.generation || !sessionIsCurrent) {
      return false;
    }

    if (token.operationKind !== undefined) {
      return operationClaimsRef.current[token.operationKind] === token.operationSequence;
    }

    return workflowMutationRef.current === token.mutation;
  }, []);

  const invalidateWorkflowRequests = useCallback((sessionId: string | null) => {
    workflowMutationRef.current += 1;
    operationClaimsRef.current = {};

    return {
      sessionId,
      generation: workflowGenerationRef.current,
      mutation: workflowMutationRef.current,
    };
  }, []);

  const advanceWorkflowGeneration = useCallback(() => {
    workflowGenerationRef.current += 1;
    workflowMutationRef.current += 1;
    operationClaimsRef.current = {};
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
    beginWorkflowOperation,
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
    beginWorkflowOperation,
    invalidateWorkflowRequests,
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

  return {
    state,
    step,
    mappingSelection,
    normalizationConfig,
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
