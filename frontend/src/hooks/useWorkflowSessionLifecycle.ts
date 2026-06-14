import { useCallback, useEffect, useRef, type Dispatch } from 'react';
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

async function deleteSessionIfPresent(sessionId: string) {
  try {
    await deleteSession(sessionId);
  } catch (error) {
    if (!isSessionNotFoundError(error)) {
      throw error;
    }
  }
}

export function useWorkflowSessionLifecycle({
  state,
  dispatch,
  setWorkflowError,
  beginWorkflowRequest,
  isCurrentWorkflowRequest,
  advanceWorkflowGeneration,
}: UseWorkflowSessionLifecycleParams) {
  const mountedRef = useRef(false);
  const sessionToDeleteOnUnmountRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initSession() {
      const token = beginWorkflowRequest(null);
      try {
        const response = await createSession();

        if (!cancelled && mountedRef.current && isCurrentWorkflowRequest(token)) {
          sessionToDeleteOnUnmountRef.current = response.session_id;
          dispatch({ type: 'sessionCreated', sessionId: response.session_id });
        } else {
          await deleteSessionIfPresent(response.session_id);
        }
      } catch (error) {
        if (!cancelled && mountedRef.current && isCurrentWorkflowRequest(token)) {
          setWorkflowError(error);
        }
      }
    }

    void initSession();

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (sessionToDeleteOnUnmountRef.current) {
        void deleteSessionIfPresent(sessionToDeleteOnUnmountRef.current).catch(() => undefined);
      }
    };
  }, [beginWorkflowRequest, dispatch, isCurrentWorkflowRequest, setWorkflowError]);

  const handleReset = useCallback(async () => {
    const outgoingSessionId = state.sessionId;
    advanceWorkflowGeneration();
    const token = beginWorkflowRequest(null);
    dispatch({ type: 'resetWorkflow' });

    try {
      if (outgoingSessionId) {
        await deleteSessionIfPresent(outgoingSessionId);
      }
      const response = await createSession();
      if (mountedRef.current && isCurrentWorkflowRequest(token)) {
        sessionToDeleteOnUnmountRef.current = response.session_id;
        dispatch({ type: 'sessionCreated', sessionId: response.session_id });
      } else {
        await deleteSessionIfPresent(response.session_id);
      }
    } catch (error) {
      if (mountedRef.current && isCurrentWorkflowRequest(token)) {
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
