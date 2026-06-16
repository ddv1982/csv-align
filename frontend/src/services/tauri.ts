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
const MAX_CSV_FILE_BYTES = 25 * 1024 * 1024;

function validateCsvFileSize(file: File): void {
  if (file.size > MAX_CSV_FILE_BYTES) {
    throw new Error('CSV file is too large; maximum supported size is 25 MiB');
  }
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; error?: unknown; message?: unknown };
  return candidate.code === 'not_found'
    || candidate.error === 'Session not found'
    || candidate.message === 'Session not found';
}

type ErrorPayload = { code?: unknown; error?: unknown };

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return await response.json() as ErrorPayload;
  } catch {
    return null;
  }
}

function errorMessageFromPayload(payload: ErrorPayload | null, fallback: string): string {
  if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  return fallback;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  return errorMessageFromPayload(await readErrorPayload(response), fallback);
}

async function fetchJson<T>(input: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackError));
  }

  return response.json() as Promise<T>;
}

async function fetchBlob(input: string, init: RequestInit, fallbackError: string): Promise<Blob> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackError));
  }

  return response.blob();
}

async function postJson<TResponse>(input: string, body: unknown, fallbackError: string): Promise<TResponse> {
  return fetchJson<TResponse>(input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, fallbackError);
}

async function readFileBytes(file: File): Promise<number[]> {
  validateCsvFileSize(file);
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}

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

    return invoke(TAURI_COMMANDS.loadCsvBytes, {
      sessionId,
      fileLetter,
      fileName: file.name,
      fileBytes: await readFileBytes(file),
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

export async function exportResults(sessionId: string): Promise<Blob | void> {
  if (isTauri) {
    await invoke(TAURI_COMMANDS.exportResults, {
      sessionId,
    });

    return;
  }

  return fetchBlob(buildExportResultsRoute(sessionId), {
    method: 'GET',
  }, 'Failed to export results');
}

export async function exportResultsHtml(contents: string): Promise<Blob | void> {
  if (isTauri) {
    await invoke(TAURI_COMMANDS.exportResultsHtml, {
      htmlContents: contents,
    });

    return;
  }

  return new Blob([contents], { type: 'text/html;charset=utf-8' });
}

export async function savePairOrder(
  sessionId: string,
  selection: PairOrderSelection,
): Promise<Blob | void> {
  if (isTauri) {
    await invoke(TAURI_COMMANDS.savePairOrder, {
      sessionId,
      selection,
    });

    return;
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
): Promise<LoadPairOrderResponse | void> {
  if (isTauri) {
    const response = await invoke<LoadPairOrderResponse | null>(TAURI_COMMANDS.loadPairOrder, {
      sessionId,
    });

    return response ?? undefined;
  }

  if (!(file instanceof File)) {
    throw new Error('No pair-order file selected');
  }

  const contents = await file.text();

  return postJson(buildLoadPairOrderRoute(sessionId), { contents }, 'Failed to load pair order');
}

export async function saveComparisonSnapshot(sessionId: string): Promise<Blob | void> {
  if (isTauri) {
    await invoke(TAURI_COMMANDS.saveComparisonSnapshot, {
      sessionId,
    });

    return;
  }

  return fetchBlob(buildSaveComparisonSnapshotRoute(sessionId), {
    method: 'POST',
  }, 'Failed to save comparison snapshot');
}

export async function loadComparisonSnapshot(
  sessionId: string,
  file?: File,
): Promise<LoadComparisonSnapshotResponse | void> {
  if (isTauri) {
    const response = await invoke<LoadComparisonSnapshotResponse | null>(TAURI_COMMANDS.loadComparisonSnapshot, {
      sessionId,
    });

    return response ?? undefined;
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
