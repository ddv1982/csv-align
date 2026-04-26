import { useCallback, useEffect, type Dispatch } from 'react';
import { createSession, deleteSession } from '../services/tauri';
import type { WorkflowAction, WorkflowState } from './useComparisonWorkflow.reducer';

interface UseWorkflowSessionLifecycleParams {
  state: WorkflowState['appState'];
  dispatch: Dispatch<WorkflowAction>;
  setWorkflowError: (error: unknown) => void;
}

function isSessionNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; error?: unknown; message?: unknown };
  return candidate.code === 'not_found'
    || candidate.error === 'Session not found'
    || candidate.message === 'Session not found';
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
        try {
          await deleteSession(outgoingSessionId);
        } catch (error) {
          if (!isSessionNotFoundError(error)) {
            throw error;
          }
        }
      }
      const response = await createSession();
      dispatch({ type: 'sessionCreated', sessionId: response.session_id });
    } catch (error) {
      setWorkflowError(error);
    }
  }, [dispatch, setWorkflowError, state.sessionId]);

  return { handleReset };
}
