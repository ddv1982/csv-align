import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { TAURI_COMMANDS } from './tauriCommands';
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

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Fall back to the caller-provided message when the response is not JSON.
  }

  return fallback;
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
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}

export async function createSession(): Promise<SessionResponse> {
  if (isTauri) {
    return invoke(TAURI_COMMANDS.createSession);
  }

  return fetchJson('/api/sessions', { method: 'POST' }, 'Failed to create session');
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (isTauri) {
    await invoke(TAURI_COMMANDS.deleteSession, { sessionId });
    return;
  }

  const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete session'));
  }
}

export async function loadFile(
  sessionId: string,
  file: File | string,  // File in browser, path string/bytes in Tauri
  fileLetter: 'a' | 'b'
): Promise<FileLoadResponse> {
  if (isTauri) {
    // In Tauri, support both direct path loading and File object loading.
    if (typeof file === 'string') {
      return invoke(TAURI_COMMANDS.loadCsv, {
        sessionId,
        fileLetter,
        filePath: file,
      });
    }

    return invoke(TAURI_COMMANDS.loadCsvBytes, {
      sessionId,
      fileLetter,
      fileName: file.name,
      fileBytes: await readFileBytes(file),
    });
  }

  // Browser mode - use HTTP API
  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  }

  return fetchJson(`/api/sessions/${sessionId}/files/${fileLetter}`, {
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

  return postJson(`/api/sessions/${sessionId}/mappings`, request, 'Failed to get mappings');
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

  return postJson(`/api/sessions/${sessionId}/compare`, request, 'Failed to compare files');
}

export async function exportResults(sessionId: string): Promise<Blob | void> {
  if (isTauri) {
    const outputPath = await save({
      defaultPath: 'comparison-results.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (!outputPath) {
      return;
    }

    await invoke(TAURI_COMMANDS.exportResults, {
      sessionId,
      outputPath,
    });

    return;
  }

  return fetchBlob(`/api/sessions/${sessionId}/export`, {
    method: 'GET',
  }, 'Failed to export results');
}

export async function savePairOrder(
  sessionId: string,
  selection: PairOrderSelection,
): Promise<Blob | void> {
  if (isTauri) {
    const outputPath = await save({
      defaultPath: 'pair-order.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (!outputPath) {
      return;
    }

    await invoke(TAURI_COMMANDS.savePairOrder, {
      sessionId,
      selection,
      outputPath,
    });

    return;
  }

  return fetchBlob(`/api/sessions/${sessionId}/pair-order/save`, {
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
    const filePath = await open({
      multiple: false,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (!filePath || Array.isArray(filePath)) {
      return;
    }

    return invoke(TAURI_COMMANDS.loadPairOrder, {
      sessionId,
      filePath,
    });
  }

  if (!(file instanceof File)) {
    throw new Error('No pair-order file selected');
  }

  const contents = await file.text();

  return postJson(`/api/sessions/${sessionId}/pair-order/load`, { contents }, 'Failed to load pair order');
}

export async function saveComparisonSnapshot(sessionId: string): Promise<Blob | void> {
  if (isTauri) {
    const outputPath = await save({
      defaultPath: 'comparison-snapshot.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (!outputPath) {
      return;
    }

    await invoke(TAURI_COMMANDS.saveComparisonSnapshot, {
      sessionId,
      outputPath,
    });

    return;
  }

  return fetchBlob(`/api/sessions/${sessionId}/comparison-snapshot/save`, {
    method: 'POST',
  }, 'Failed to save comparison snapshot');
}

export async function loadComparisonSnapshot(
  sessionId: string,
  file?: File,
): Promise<LoadComparisonSnapshotResponse | void> {
  if (isTauri) {
    const filePath = await open({
      multiple: false,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (!filePath || Array.isArray(filePath)) {
      return;
    }

    return invoke(TAURI_COMMANDS.loadComparisonSnapshot, {
      sessionId,
      filePath,
    });
  }

  if (!(file instanceof File)) {
    throw new Error('No comparison snapshot file selected');
  }

  const contents = await file.text();

  return postJson(`/api/sessions/${sessionId}/comparison-snapshot/load`, { contents }, 'Failed to load comparison snapshot');
}

export { isTauri };
