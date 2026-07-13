/** Shared browser-mode HTTP helpers: fetch wrappers and API error parsing. */

export type ErrorPayload = { code?: unknown; error?: unknown };

export class ApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function isSupersededError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'superseded';
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown };
  return candidate.code === 'superseded';
}

async function apiErrorFromResponse(response: Response, fallback: string): Promise<ApiError> {
  const payload = await readErrorPayload(response);
  const code = typeof payload?.code === 'string' ? payload.code : null;
  return new ApiError(errorMessageFromPayload(payload, fallback), code);
}

export async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return await response.json() as ErrorPayload;
  } catch {
    return null;
  }
}

export function errorMessageFromPayload(payload: ErrorPayload | null, fallback: string): string {
  if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  return fallback;
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  return errorMessageFromPayload(await readErrorPayload(response), fallback);
}

export async function fetchJson<T>(input: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw await apiErrorFromResponse(response, fallbackError);
  }

  return response.json() as Promise<T>;
}

export async function fetchBlob(input: string, init: RequestInit, fallbackError: string): Promise<Blob> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw await apiErrorFromResponse(response, fallbackError);
  }

  return response.blob();
}

export async function postJson<TResponse>(input: string, body: unknown, fallbackError: string): Promise<TResponse> {
  return fetchJson<TResponse>(input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, fallbackError);
}
