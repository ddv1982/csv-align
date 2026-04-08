import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  UploadResponse,
  SuggestMappingsRequest,
  SuggestMappingsResponse,
  CompareRequest,
  CompareResponse,
  SessionResponse,
} from '../types/api';

// Check if we're running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function createSession(): Promise<SessionResponse> {
  if (isTauri) {
    return await invoke('create_session');
  }
  
  const response = await fetch('/api/sessions', { method: 'POST' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create session');
  }
  return response.json();
}

export async function uploadFile(
  sessionId: string,
  file: File | string,  // File in browser, path string/bytes in Tauri
  fileLetter: 'a' | 'b'
): Promise<UploadResponse> {
  if (isTauri) {
    // In Tauri, support both direct path uploads and File object uploads.
    if (typeof file === 'string') {
      return await invoke('upload_csv', {
        sessionId,
        fileLetter,
        filePath: file,
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    return await invoke('upload_csv_bytes', {
      sessionId,
      fileLetter,
      fileName: file.name,
      fileBytes: Array.from(bytes),
    });
  }
  
  // Browser mode - use HTTP API
  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  }
  
  const response = await fetch(`/api/sessions/${sessionId}/upload/${fileLetter}`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }
  return response.json();
}

export async function pickFile(): Promise<string | null> {
  // Deprecated in current desktop flow: file selection is handled via
  // the standard file input/drag-drop and sent as bytes to the backend.
  return null;
}

export async function suggestMappings(
  sessionId: string,
  request: SuggestMappingsRequest
): Promise<SuggestMappingsResponse> {
  if (isTauri) {
    return await invoke('suggest_mappings', {
      sessionId,
      request,
    });
  }
  
  const response = await fetch(`/api/sessions/${sessionId}/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get mappings');
  }
  return response.json();
}

export async function compareFiles(
  sessionId: string,
  request: CompareRequest
): Promise<CompareResponse> {
  if (isTauri) {
    return await invoke('compare', {
      sessionId,
      request,
    });
  }
  
  const response = await fetch(`/api/sessions/${sessionId}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to compare files');
  }
  return response.json();
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

    await invoke('export_results', {
      sessionId,
      outputPath,
    });

    return;
  }
  
  const response = await fetch(`/api/sessions/${sessionId}/export`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to export results');
  }
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { isTauri };
