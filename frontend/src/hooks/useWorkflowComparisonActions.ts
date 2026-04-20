import { useCallback, type Dispatch } from 'react';
import { buildAutoPairSelection } from '../features/mapping/autoPair';
import { compareFiles, loadFile, suggestMappings } from '../services/tauri';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../types/api';
import type { MappingSelectionState, SelectedFileSource } from '../types/ui';
import { buildCompareRequestPayload, type WorkflowAction, type WorkflowState } from './useComparisonWorkflow.reducer';
import { getSelectedFileName } from '../utils/selectedFileSource';

interface UseWorkflowComparisonActionsParams {
  state: WorkflowState['appState'];
  mappingSelection: MappingSelectionState;
  dispatch: Dispatch<WorkflowAction>;
  startLoading: (clearError?: boolean) => void;
  failLoading: (error: unknown) => void;
  blockSnapshotFollowOnWorkflow: () => boolean;
}

export function useWorkflowComparisonActions({
  state,
  mappingSelection,
  dispatch,
  startLoading,
  failLoading,
  blockSnapshotFollowOnWorkflow,
}: UseWorkflowComparisonActionsParams) {
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
  }, [dispatch, failLoading, startLoading, state.sessionId]);

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
  }, [blockSnapshotFollowOnWorkflow, dispatch, failLoading, startLoading, state.sessionId]);

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
  }, [blockSnapshotFollowOnWorkflow, dispatch, failLoading, mappingSelection, startLoading, state.fileA, state.fileB, state.sessionId]);

  return {
    handleFileSelection,
    handleCompare,
    handleAutoPairComparisonColumns,
  };
}
