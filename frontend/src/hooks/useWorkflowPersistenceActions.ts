import { useCallback, type Dispatch } from 'react';
import { buildResultsHtmlDocument } from '../features/results/htmlExport';
import { downloadBlob } from '../services/browserDownload';
import {
  DIALOG_CANCELLED,
  exportResults,
  exportResultsHtml,
  loadComparisonSnapshot,
  loadPairOrder,
  saveComparisonSnapshot,
  savePairOrder,
} from '../services/tauri';
import type { MappingSelectionState } from '../types/ui';
import {
  type WorkflowAction,
  type WorkflowState,
} from './useComparisonWorkflow.reducer';

interface UseWorkflowPersistenceActionsParams {
  state: WorkflowState['appState'];
  mappingSelection: MappingSelectionState;
  dispatch: Dispatch<WorkflowAction>;
  startLoading: (clearError?: boolean) => void;
  failLoading: (error: unknown) => void;
  blockSnapshotFollowOnWorkflow: () => boolean;
  beginWorkflowRequest: (sessionId: string | null, invalidatesExisting?: boolean) => WorkflowRequestToken;
  invalidateWorkflowRequests: (sessionId: string | null) => WorkflowRequestToken;
  isCurrentWorkflowRequest: (token: WorkflowRequestToken) => boolean;
}

type WorkflowRequestToken = {
  sessionId: string | null;
  generation: number;
  mutation: number;
};

export function useWorkflowPersistenceActions({
  state,
  mappingSelection,
  dispatch,
  startLoading,
  failLoading,
  blockSnapshotFollowOnWorkflow,
  beginWorkflowRequest,
  invalidateWorkflowRequests,
  isCurrentWorkflowRequest,
}: UseWorkflowPersistenceActionsParams) {
  const handleExportCsv = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    const token = beginWorkflowRequest(state.sessionId);
    startLoading(false);

    try {
      const outcome = await exportResults(state.sessionId);
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }
      if (outcome === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'CSV export cancelled.' });
        return;
      }
      if (outcome instanceof Blob) {
        downloadBlob(outcome, 'comparison-results.csv');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [beginWorkflowRequest, dispatch, failLoading, isCurrentWorkflowRequest, startLoading, state.sessionId]);

  const handleExportHtml = useCallback(async () => {
    if (state.summary === null) {
      return;
    }

    startLoading(false);
    const token = beginWorkflowRequest(state.sessionId);

    try {
      const activeTheme = typeof document === 'undefined' ? undefined : document.documentElement.dataset.theme;
      const htmlDocument = buildResultsHtmlDocument({
        summary: state.summary,
        fileAName: state.fileA?.name ?? 'File A',
        fileBName: state.fileB?.name ?? 'File B',
        comparisonColumnsA: mappingSelection.comparisonColumnsA,
        comparisonColumnsB: mappingSelection.comparisonColumnsB,
        mappings: state.mappings,
        results: state.results,
        initialFilter: state.filter,
        theme: activeTheme,
      });
      const outcome = await exportResultsHtml(htmlDocument);
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }
      if (outcome === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'HTML export cancelled.' });
        return;
      }
      if (outcome instanceof Blob) {
        downloadBlob(outcome, 'comparison-results.html');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [
    beginWorkflowRequest,
    dispatch,
    failLoading,
    isCurrentWorkflowRequest,
    mappingSelection.comparisonColumnsA,
    mappingSelection.comparisonColumnsB,
    startLoading,
    state.fileA?.name,
    state.fileB?.name,
    state.filter,
    state.mappings,
    state.results,
    state.summary,
  ]);

  const handleSaveComparisonSnapshot = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    startLoading();
    const token = beginWorkflowRequest(state.sessionId);

    try {
      const outcome = await saveComparisonSnapshot(state.sessionId);
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }
      if (outcome === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'Snapshot save cancelled.' });
        return;
      }
      if (outcome instanceof Blob) {
        downloadBlob(outcome, 'comparison-snapshot.json');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [beginWorkflowRequest, dispatch, failLoading, isCurrentWorkflowRequest, startLoading, state.sessionId]);

  const handleLoadComparisonSnapshot = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    startLoading();
    const token = beginWorkflowRequest(state.sessionId, true);

    try {
      const response = await loadComparisonSnapshot(state.sessionId, file);
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }
      if (response === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'Snapshot load cancelled.' });
        return;
      }
      if (response) {
        dispatch({ type: 'snapshotLoaded', response });
        return;
      }

      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [beginWorkflowRequest, dispatch, failLoading, isCurrentWorkflowRequest, startLoading, state.sessionId]);

  const handleSavePairOrder = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    startLoading();
    const token = beginWorkflowRequest(state.sessionId, true);

    try {
      const outcome = await savePairOrder(state.sessionId, {
        key_columns_a: mappingSelection.keyColumnsA,
        key_columns_b: mappingSelection.keyColumnsB,
        comparison_columns_a: mappingSelection.comparisonColumnsA,
        comparison_columns_b: mappingSelection.comparisonColumnsB,
      });
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }

      if (outcome === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'Pair-order save cancelled.' });
        return;
      }
      if (outcome instanceof Blob) {
        downloadBlob(outcome, 'pair-order.txt');
      }

      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [
    beginWorkflowRequest,
    blockSnapshotFollowOnWorkflow,
    dispatch,
    failLoading,
    isCurrentWorkflowRequest,
    mappingSelection,
    startLoading,
    state.sessionId,
  ]);

  const handleLoadPairOrder = useCallback(async (file?: File) => {
    if (!state.sessionId) {
      return;
    }

    if (blockSnapshotFollowOnWorkflow()) {
      return;
    }

    startLoading();
    const token = beginWorkflowRequest(state.sessionId);

    try {
      const response = await loadPairOrder(state.sessionId, file);
      if (!isCurrentWorkflowRequest(token)) {
        return;
      }
      if (response === DIALOG_CANCELLED) {
        dispatch({ type: 'persistenceCancelled', notice: 'Pair-order load cancelled.' });
        return;
      }
      if (response) {
        const pairOrderToken = invalidateWorkflowRequests(state.sessionId);
        if (!isCurrentWorkflowRequest(pairOrderToken)) {
          return;
        }

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
      if (isCurrentWorkflowRequest(token)) {
        failLoading(error);
      }
    }
  }, [
    beginWorkflowRequest,
    blockSnapshotFollowOnWorkflow,
    dispatch,
    failLoading,
    invalidateWorkflowRequests,
    isCurrentWorkflowRequest,
    startLoading,
    state.sessionId,
  ]);

  return {
    handleExportCsv,
    handleExportHtml,
    handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot,
    handleSavePairOrder,
    handleLoadPairOrder,
  };
}
