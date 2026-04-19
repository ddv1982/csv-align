import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TAURI_COMMANDS } from './tauriCommands';
import { loadComparisonSnapshot, saveComparisonSnapshot } from './tauri';

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

async function importTauriModule() {
  vi.resetModules();
  return import('./tauri');
}

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
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('saveComparisonSnapshot returns a browser blob download payload', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(new Response('{"saved":true}', { status: 200 }));

  const blob = await saveComparisonSnapshot('session-1');

  expect(blob).toBeDefined();
  await expect(blob?.text()).resolves.toBe('{"saved":true}');
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/comparison-snapshot/save', {
    method: 'POST',
  });
});

test('loadComparisonSnapshot reads the selected file and posts its contents in browser mode', async () => {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue(jsonResponse({
    file_a: {
      name: 'left.csv',
      headers: ['id'],
      columns: [{ index: 0, name: 'id', data_type: 'string' }],
      row_count: 1,
    },
    file_b: {
      name: 'right.csv',
      headers: ['record_id'],
      columns: [{ index: 0, name: 'record_id', data_type: 'string' }],
      row_count: 1,
    },
    selection: {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['id'],
      comparison_columns_b: ['record_id'],
    },
    mappings: [],
    normalization: {
      treat_empty_as_null: false,
      null_tokens: [],
      null_token_case_insensitive: true,
      case_insensitive: false,
      trim_whitespace: false,
      date_normalization: { enabled: false, formats: [] },
    },
    results: [],
    summary: {
      total_rows_a: 1,
      total_rows_b: 1,
      matches: 0,
      mismatches: 0,
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
  }));

  const file = new File(['{"snapshot":true}'], 'comparison-snapshot.json', { type: 'application/json' });
  const response = await loadComparisonSnapshot('session-1', file);

  expect(response?.file_a.name).toBe('left.csv');
  expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/comparison-snapshot/load', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: '{"snapshot":true}' }),
  }));
});

test('loadComparisonSnapshot invokes the Tauri snapshot load command when a file is chosen', async () => {
  (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  openMock.mockResolvedValue('/tmp/comparison-snapshot.json');
  invokeMock.mockResolvedValue({ file_a: { name: 'left.csv' } });

  const { loadComparisonSnapshot } = await importTauriModule();

  await expect(loadComparisonSnapshot('session-2')).resolves.toEqual({ file_a: { name: 'left.csv' } });
  expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.loadComparisonSnapshot, {
    sessionId: 'session-2',
    filePath: '/tmp/comparison-snapshot.json',
  });
});
