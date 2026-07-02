import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  buildCreateSessionRoute,
  buildCompareRoute,
  buildDeleteSessionRoute,
  buildExportResultsRoute,
  buildLoadComparisonSnapshotRoute,
  buildLoadFileRoute,
  buildLoadPairOrderRoute,
  buildSaveComparisonSnapshotRoute,
  buildSavePairOrderRoute,
  buildSuggestMappingsRoute,
} from './apiRoutes';
import { TAURI_COMMANDS } from './tauriCommands';
import { validateCsvFileSize } from './contracts';
import { errorMessageFromPayload, fetchBlob, fetchJson, postJson, readErrorMessage, readErrorPayload } from './http';
import type { SelectedFileSource } from '../types/ui';
import type {
  FileLoadResponse,
  SuggestMappingsRequest,
  SuggestMappingsResponse,
  CompareRequest,
  CompareResponse,
  LoadComparisonSnapshotResponse,
  LoadPairOrderResponse,
  PairOrderSelection,
  SessionResponse,
} from '../types/api';

// Check if we're running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; error?: unknown; message?: unknown };
  return candidate.code === 'not_found'
    || candidate.error === 'Session not found'
    || candidate.message === 'Session not found';
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  validateCsvFileSize(file);
  return new Uint8Array(await file.arrayBuffer());
}

/** Desktop dialogs can be dismissed; browser flows never produce this value. */
export const DIALOG_CANCELLED = 'cancelled';
export type DialogCancelled = typeof DIALOG_CANCELLED;
/** Save flows resolve to a Blob to download (browser), 'saved' (desktop), or 'cancelled'. */
export type SaveOutcome = Blob | 'saved' | DialogCancelled;

export type TauriDragDropEvent =
  | { type: 'enter'; paths: string[]; position: { x: number; y: number } }
  | { type: 'over'; position: { x: number; y: number } }
  | { type: 'drop'; paths: string[]; position: { x: number; y: number } }
  | { type: 'leave' };

export async function listenForTauriDragDrop(
  handler: (event: TauriDragDropEvent) => void,
): Promise<(() => void) | undefined> {
  if (!isTauri) {
    return undefined;
  }

  return getCurrentWebviewWindow().onDragDropEvent((event) => {
    handler(event.payload as TauriDragDropEvent);
  });
}

export async function createSession(): Promise<SessionResponse> {
  if (isTauri) {
    return invoke(TAURI_COMMANDS.createSession);
  }

  return fetchJson(buildCreateSessionRoute(), { method: 'POST' }, 'Failed to create session');
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke(TAURI_COMMANDS.deleteSession, { sessionId });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
    return;
  }

  const response = await fetch(buildDeleteSessionRoute(sessionId), { method: 'DELETE' });

  if (response.status === 404) {
    const payload = await readErrorPayload(response);
    if (payload?.code === 'not_found' || payload?.error === 'Session not found') {
      return;
    }

    throw new Error(errorMessageFromPayload(payload, 'Failed to delete session'));
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete session'));
  }
}

export async function loadFile(
  sessionId: string,
  file: SelectedFileSource,
  fileLetter: 'a' | 'b'
): Promise<FileLoadResponse> {
  if (isTauri) {
    if (typeof file === 'string') {
      throw new Error('Desktop path loading is disabled. Use Choose CSV so the file contents stay user-selected.');
    }

    // Raw IPC body: JSON-encoding the bytes as a number array multiplies the
    // payload roughly eightfold for a 25 MiB file. Metadata rides in headers,
    // percent-encoded because header values must stay ASCII.
    return invoke(TAURI_COMMANDS.loadCsvBytes, await readFileBytes(file), {
      headers: {
        'session-id': sessionId,
        'file-letter': fileLetter,
        'file-name': encodeURIComponent(file.name),
      },
    });
  }

  // Browser mode - use HTTP API
  if (!(file instanceof File)) {
    throw new Error('No CSV file selected');
  }

  validateCsvFileSize(file);

  const formData = new FormData();
  formData.append('file', file);

  return fetchJson(buildLoadFileRoute(sessionId, fileLetter), {
    method: 'POST',
    body: formData,
  }, 'Failed to load file');
}

export async function suggestMappings(
  sessionId: string,
  request: SuggestMappingsRequest
): Promise<SuggestMappingsResponse> {
  if (isTauri) {
    return invoke(TAURI_COMMANDS.suggestMappings, {
      sessionId,
      request,
    });
  }

  return postJson(buildSuggestMappingsRoute(sessionId), request, 'Failed to get mappings');
}

export async function compareFiles(
  sessionId: string,
  request: CompareRequest
): Promise<CompareResponse> {
  if (isTauri) {
    return invoke(TAURI_COMMANDS.compare, {
      sessionId,
      request,
    });
  }

  return postJson(buildCompareRoute(sessionId), request, 'Failed to compare files');
}

export async function exportResults(sessionId: string): Promise<SaveOutcome> {
  if (isTauri) {
    return invoke<'saved' | DialogCancelled>(TAURI_COMMANDS.exportResults, {
      sessionId,
    });
  }

  return fetchBlob(buildExportResultsRoute(sessionId), {
    method: 'GET',
  }, 'Failed to export results');
}

export async function exportResultsHtml(contents: string): Promise<SaveOutcome> {
  if (isTauri) {
    return invoke<'saved' | DialogCancelled>(TAURI_COMMANDS.exportResultsHtml, {
      htmlContents: contents,
    });
  }

  return new Blob([contents], { type: 'text/html;charset=utf-8' });
}

export async function savePairOrder(
  sessionId: string,
  selection: PairOrderSelection,
): Promise<SaveOutcome> {
  if (isTauri) {
    return invoke<'saved' | DialogCancelled>(TAURI_COMMANDS.savePairOrder, {
      sessionId,
      selection,
    });
  }

  return fetchBlob(buildSavePairOrderRoute(sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selection }),
  }, 'Failed to save pair order');
}

export async function loadPairOrder(
  sessionId: string,
  file?: File,
): Promise<LoadPairOrderResponse | DialogCancelled> {
  if (isTauri) {
    const response = await invoke<LoadPairOrderResponse | null>(TAURI_COMMANDS.loadPairOrder, {
      sessionId,
    });

    return response ?? DIALOG_CANCELLED;
  }

  if (!(file instanceof File)) {
    throw new Error('No pair-order file selected');
  }

  const contents = await file.text();

  return postJson(buildLoadPairOrderRoute(sessionId), { contents }, 'Failed to load pair order');
}

export async function saveComparisonSnapshot(sessionId: string): Promise<SaveOutcome> {
  if (isTauri) {
    return invoke<'saved' | DialogCancelled>(TAURI_COMMANDS.saveComparisonSnapshot, {
      sessionId,
    });
  }

  return fetchBlob(buildSaveComparisonSnapshotRoute(sessionId), {
    method: 'POST',
  }, 'Failed to save comparison snapshot');
}

export async function loadComparisonSnapshot(
  sessionId: string,
  file?: File,
): Promise<LoadComparisonSnapshotResponse | DialogCancelled> {
  if (isTauri) {
    const response = await invoke<LoadComparisonSnapshotResponse | null>(TAURI_COMMANDS.loadComparisonSnapshot, {
      sessionId,
    });

    return response ?? DIALOG_CANCELLED;
  }

  if (!(file instanceof File)) {
    throw new Error('No comparison snapshot file selected');
  }

  const contents = await file.text();

  return postJson(
    buildLoadComparisonSnapshotRoute(sessionId),
    { contents },
    'Failed to load comparison snapshot',
  );
}

export { isTauri };
