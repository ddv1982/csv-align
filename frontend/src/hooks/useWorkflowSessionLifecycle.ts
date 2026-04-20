import { useCallback, useEffect, type Dispatch } from 'react';
import { createSession, deleteSession } from '../services/tauri';
import type { WorkflowAction, WorkflowState } from './useComparisonWorkflow.reducer';

interface UseWorkflowSessionLifecycleParams {
  state: WorkflowState['appState'];
  dispatch: Dispatch<WorkflowAction>;
  setWorkflowError: (error: unknown) => void;
}

export function useWorkflowSessionLifecycle({
  state,
  dispatch,
  setWorkflowError,
}: UseWorkflowSessionLifecycleParams) {
  useEffect(() => {
    async function initSession() {
      try {
        const response = await createSession();
        dispatch({ type: 'sessionCreated', sessionId: response.session_id });
      } catch (error) {
        setWorkflowError(error);
      }
    }

    void initSession();
  }, [dispatch, setWorkflowError]);

  const handleReset = useCallback(async () => {
    const outgoingSessionId = state.sessionId;
    dispatch({ type: 'resetWorkflow' });

    try {
      if (outgoingSessionId) {
        await deleteSession(outgoingSessionId);
      }
      const response = await createSession();
      dispatch({ type: 'sessionCreated', sessionId: response.session_id });
    } catch (error) {
      setWorkflowError(error);
    }
  }, [dispatch, setWorkflowError, state.sessionId]);

  return { handleReset };
}
