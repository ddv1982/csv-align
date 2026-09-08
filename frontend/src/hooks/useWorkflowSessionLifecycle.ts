import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import { createSession, deleteSession } from '../services/tauri';
import type { WorkflowRequestToken } from '../types/ui';
import type { WorkflowAction, WorkflowState } from './useComparisonWorkflow.reducer';

interface UseWorkflowSessionLifecycleParams {
  state: WorkflowState['appState'];
  dispatch: Dispatch<WorkflowAction>;
  setWorkflowError: (error: unknown) => void;
  beginWorkflowRequest: (sessionId: string | null, invalidatesExisting?: boolean) => WorkflowRequestToken;
  isCurrentWorkflowRequest: (token: WorkflowRequestToken) => boolean;
  advanceWorkflowGeneration: () => void;
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
          await deleteSession(response.session_id);
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
        void deleteSession(sessionToDeleteOnUnmountRef.current).catch(() => undefined);
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
        await deleteSession(outgoingSessionId);
      }
      const response = await createSession();
      if (mountedRef.current && isCurrentWorkflowRequest(token)) {
        sessionToDeleteOnUnmountRef.current = response.session_id;
        dispatch({ type: 'sessionCreated', sessionId: response.session_id });
      } else {
        await deleteSession(response.session_id);
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
