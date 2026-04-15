import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { compareFiles, createSession, exportResults, loadFile, loadPairOrder, savePairOrder, suggestMappings } from './tauri';

const { invokeMock, openMock, saveMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
  save: saveMock,
}));

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  openMock.mockReset();
  saveMock.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('createSession surfaces the backend error payload in browser mode', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(jsonResponse({ error: 'Failed to create session' }, { status: 500 }));

  await expect(createSession()).rejects.toThrow('Failed to create session');
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions', { method: 'POST' });
});

test('loadFile sends browser uploads as multipart form data', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  const file = new File(['id,name\n1,Alice'], 'left.csv', { type: 'text/csv' });

  fetchMock.mockResolvedValue(jsonResponse({
    success: true,
    file_letter: 'a',
    headers: ['id', 'name'],
    columns: [],
    row_count: 1,
  }));

  const response = await loadFile('session-1', file, 'a');

  expect(response.headers).toEqual(['id', 'name']);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/sessions/session-1/files/a',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );

  const requestInit = fetchMock.mock.calls[0]?.[1];
  expect(requestInit).toBeDefined();
  const formData = requestInit?.body as FormData;
  expect(formData.get('file')).toBe(file);
});

test('compareFiles falls back to a stable default error for non-json failures', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(new Response('server exploded', { status: 500 }));

  await expect(compareFiles('session-1', {
    key_columns_a: ['id'],
    key_columns_b: ['id'],
    comparison_columns_a: ['name'],
    comparison_columns_b: ['name'],
    column_mappings: [],
    normalization: {
      treat_empty_as_null: false,
      null_tokens: [],
      null_token_case_insensitive: true,
      case_insensitive: false,
      trim_whitespace: false,
      date_normalization: {
        enabled: false,
        formats: [],
      },
    },
  })).rejects.toThrow('Failed to compare files');
});

test('suggestMappings posts JSON and returns mapping suggestions in browser mode', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(jsonResponse({
    mappings: [
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
    ],
  }));

  const response = await suggestMappings('session-1', {
    columns_a: ['id', 'full_name'],
    columns_b: ['record_id', 'display_name'],
  });

  expect(response.mappings).toEqual([
    { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
  ]);
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/mappings', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }));
});

test('savePairOrder returns a browser blob download payload', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(new Response('saved pair order', { status: 200 }));

  const blob = await savePairOrder('session-1', {
    key_columns_a: ['id'],
    key_columns_b: ['record_id'],
    comparison_columns_a: ['full_name'],
    comparison_columns_b: ['display_name'],
  });

  expect(blob).toBeDefined();
  expect(typeof blob?.text).toBe('function');
  await expect(blob?.text()).resolves.toBe('saved pair order');
});

test('loadPairOrder reads the selected file and posts its contents in browser mode', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(jsonResponse({
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['full_name'],
      comparison_columns_b: ['display_name'],
    },
  }));

  const file = new File(['{"saved":true}'], 'pair-order.txt', { type: 'text/plain' });
  const response = await loadPairOrder('session-1', file);

  expect(response).toEqual({
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['full_name'],
      comparison_columns_b: ['display_name'],
    },
  });
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/pair-order/load', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: '{"saved":true}' }),
  }));
});

test('exportResults returns the browser export blob', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(new Response('csv,data', {
    status: 200,
    headers: { 'Content-Type': 'text/csv' },
  }));

  const blob = await exportResults('session-1');

  expect(blob).toBeDefined();
  expect(typeof blob?.text).toBe('function');
  await expect(blob?.text()).resolves.toBe('csv,data');
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/export', { method: 'GET' });
});
