import {
  UploadResponse,
  SuggestMappingsRequest,
  SuggestMappingsResponse,
  CompareRequest,
  CompareResponse,
  SessionResponse,
} from '../types/api';

const API_BASE = '/api';

export async function createSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create session');
  }
  
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete session');
  }
}

export async function uploadFile(
  sessionId: string,
  file: File,
  fileLetter: 'a' | 'b'
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/upload/${fileLetter}`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }
  
  return response.json();
}

export async function suggestMappings(
  sessionId: string,
  request: SuggestMappingsRequest
): Promise<SuggestMappingsResponse> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/mappings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to compare files');
  }
  
  return response.json();
}

export async function exportResults(sessionId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/export`, {
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
