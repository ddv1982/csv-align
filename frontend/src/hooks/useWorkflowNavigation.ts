import { useCallback, useMemo, type Dispatch } from 'react';
import type { ResultFilter } from '../types/api';
import type { AppStep } from '../types/ui';
import type { WorkflowAction, WorkflowState } from './useComparisonWorkflow.reducer';

interface UseWorkflowNavigationParams {
  state: WorkflowState['appState'];
  step: AppStep;
  dispatch: Dispatch<WorkflowAction>;
  blockSnapshotFollowOnWorkflow: () => boolean;
}

export function useWorkflowNavigation({
  state,
  step,
  dispatch,
  blockSnapshotFollowOnWorkflow,
}: UseWorkflowNavigationParams) {
  const unlockedSteps = useMemo(() => {
    const steps: AppStep[] = ['select'];
    const hasBothFiles = Boolean(state.fileA && state.fileB);
    const hasSummary = state.summary !== null;

    if (state.snapshotReadOnly) {
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

  const handleFilterChange = useCallback((filter: ResultFilter) => {
    dispatch({ type: 'filterChanged', filter });
  }, [dispatch]);

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
  }, [blockSnapshotFollowOnWorkflow, dispatch, state.fileA, state.fileB, state.snapshotReadOnly, state.summary, step]);

  const handleBackToConfigure = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'configure' });
  }, [blockSnapshotFollowOnWorkflow, dispatch]);

  const handleBackToSelection = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'select' });
  }, [blockSnapshotFollowOnWorkflow, dispatch]);

  const handleContinueToConfigure = useCallback(() => {
    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    dispatch({ type: 'stepChanged', step: 'configure' });
  }, [blockSnapshotFollowOnWorkflow, dispatch]);

  return {
    unlockedSteps,
    handleFilterChange,
    handleStepNavigation,
    handleBackToConfigure,
    handleBackToSelection,
    handleContinueToConfigure,
  };
}
