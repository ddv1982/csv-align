import { useCallback, useEffect, type Dispatch } from 'react';
import { createSession, deleteSession } from '../services/tauri';
import type { WorkflowAction, WorkflowState } from './useComparisonWorkflow.reducer';

interface UseWorkflowSessionLifecycleParams {
  state: WorkflowState['appState'];
  dispatch: Dispatch<WorkflowAction>;
  setWorkflowError: (error: unknown) => void;
  beginWorkflowRequest: (sessionId: string | null, invalidatesExisting?: boolean) => WorkflowRequestToken;
  isCurrentWorkflowRequest: (token: WorkflowRequestToken) => boolean;
  advanceWorkflowGeneration: () => void;
}

type WorkflowRequestToken = {
  sessionId: string | null;
  generation: number;
  mutation: number;
};

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
  beginWorkflowRequest,
  isCurrentWorkflowRequest,
  advanceWorkflowGeneration,
}: UseWorkflowSessionLifecycleParams) {
  useEffect(() => {
    async function initSession() {
      const token = beginWorkflowRequest(null);
      try {
        const response = await createSession();
        if (isCurrentWorkflowRequest(token)) {
          dispatch({ type: 'sessionCreated', sessionId: response.session_id });
        }
      } catch (error) {
        if (isCurrentWorkflowRequest(token)) {
          setWorkflowError(error);
        }
      }
    }

    void initSession();
  }, [beginWorkflowRequest, dispatch, isCurrentWorkflowRequest, setWorkflowError]);

  const handleReset = useCallback(async () => {
    const outgoingSessionId = state.sessionId;
    advanceWorkflowGeneration();
    const token = beginWorkflowRequest(null);
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
      if (isCurrentWorkflowRequest(token)) {
        dispatch({ type: 'sessionCreated', sessionId: response.session_id });
      }
    } catch (error) {
      if (isCurrentWorkflowRequest(token)) {
        setWorkflowError(error);
      }
    }
  }, [
    advanceWorkflowGeneration,
    beginWorkflowRequest,
    dispatch,
    isCurrentWorkflowRequest,
    setWorkflowError,
    state.sessionId,
  ]);

  return { handleReset };
}
