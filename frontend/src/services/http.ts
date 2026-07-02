/** Shared browser-mode HTTP helpers: fetch wrappers and API error parsing. */

export type ErrorPayload = { code?: unknown; error?: unknown };

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
    throw new Error(await readErrorMessage(response, fallbackError));
  }

  return response.json() as Promise<T>;
}

export async function fetchBlob(input: string, init: RequestInit, fallbackError: string): Promise<Blob> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackError));
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
