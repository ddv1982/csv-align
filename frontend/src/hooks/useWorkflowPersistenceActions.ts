import { useCallback, type Dispatch } from 'react';
import { buildResultsHtmlDocument } from '../features/results/htmlExport';
import { downloadBlob } from '../services/browserDownload';
import {
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
}

export function useWorkflowPersistenceActions({
  state,
  mappingSelection,
  dispatch,
  startLoading,
  failLoading,
  blockSnapshotFollowOnWorkflow,
}: UseWorkflowPersistenceActionsParams) {
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
  }, [dispatch, failLoading, startLoading, state.sessionId]);

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
        comparisonColumnsA: mappingSelection.comparisonColumnsA,
        comparisonColumnsB: mappingSelection.comparisonColumnsB,
        mappings: state.mappings,
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
  }, [
    dispatch,
    failLoading,
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

    try {
      const blob = await saveComparisonSnapshot(state.sessionId);
      if (blob) {
        downloadBlob(blob, 'comparison-snapshot.json');
      }
      dispatch({ type: 'downloadCompleted' });
    } catch (error) {
      failLoading(error);
    }
  }, [dispatch, failLoading, startLoading, state.sessionId]);

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
  }, [dispatch, failLoading, startLoading, state.sessionId]);

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
  }, [blockSnapshotFollowOnWorkflow, dispatch, failLoading, mappingSelection, startLoading, state.sessionId]);

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
  }, [blockSnapshotFollowOnWorkflow, dispatch, failLoading, startLoading, state.sessionId]);

  return {
    handleExportCsv,
    handleExportHtml,
    handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot,
    handleSavePairOrder,
    handleLoadPairOrder,
  };
}
