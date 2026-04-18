import { beforeEach, describe, expect, test, vi } from 'vitest';

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();

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

describe('transport helpers', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  test('createSession posts to the browser API when not running in Tauri', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ session_id: 'session-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { createSession } = await importTauriModule();

    await expect(createSession()).resolves.toEqual({ session_id: 'session-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions', { method: 'POST' });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('createSession invokes the Tauri command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({ session_id: 'session-2' });

    const { createSession } = await importTauriModule();

    await expect(createSession()).resolves.toEqual({ session_id: 'session-2' });
    expect(invokeMock).toHaveBeenCalledWith('create_session');
  });

  test('loadFile posts multipart form data in browser mode', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      file_letter: 'a',
      headers: ['id'],
      columns: [{ index: 0, name: 'id', data_type: 'string' }],
      row_count: 1,
    }));

    const { loadFile } = await importTauriModule();
    const file = new File(['id\n1'], 'example.csv', { type: 'text/csv' });

    await expect(loadFile('session-1', file, 'a')).resolves.toMatchObject({
      file_letter: 'a',
      headers: ['id'],
      row_count: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/files/a', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('loadFile uses invoke with file bytes in Tauri mode', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      success: true,
      file_letter: 'b',
      headers: ['record_id'],
      columns: [{ index: 0, name: 'record_id', data_type: 'string' }],
      row_count: 2,
    });

    const { loadFile } = await importTauriModule();
    const file = new File([new Uint8Array([97, 98, 99])], 'tauri.csv', { type: 'text/csv' });

    await expect(loadFile('session-2', file, 'b')).resolves.toMatchObject({
      file_letter: 'b',
      headers: ['record_id'],
      row_count: 2,
    });
    expect(invokeMock).toHaveBeenCalledWith('load_csv_bytes', {
      sessionId: 'session-2',
      fileLetter: 'b',
      fileName: 'tauri.csv',
      fileBytes: [97, 98, 99],
    });
  });

  test('compareFiles posts JSON to the browser API when not running in Tauri', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const request = {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['display_name'],
      column_mappings: [{
        file_a_column: 'name',
        file_b_column: 'display_name',
        mapping_type: 'manual' as const,
      }],
    };
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      results: [],
      summary: {
        total_rows_a: 1,
        total_rows_b: 1,
        matches: 1,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        unkeyed_left: 0,
        unkeyed_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
      },
    }));

    const { compareFiles } = await importTauriModule();

    await expect(compareFiles('session-3', request)).resolves.toMatchObject({
      success: true,
      results: [],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-3/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('compareFiles invokes the Tauri compare command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      success: true,
      results: [{ result_type: 'match', key: ['1'], values_a: ['Alice'], values_b: ['Alice'], duplicate_values_a: [], duplicate_values_b: [], differences: [] }],
      summary: {
        total_rows_a: 1,
        total_rows_b: 1,
        matches: 1,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        unkeyed_left: 0,
        unkeyed_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
      },
    });

    const { compareFiles } = await importTauriModule();
    const request = {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['display_name'],
      column_mappings: [],
    };

    await compareFiles('session-4', request);

    expect(invokeMock).toHaveBeenCalledWith('compare', {
      sessionId: 'session-4',
      request,
    });
  });

  test('saveComparisonSnapshot posts to the browser snapshot endpoint when not running in Tauri', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('snapshot-bytes', { status: 200 }));

    const { saveComparisonSnapshot } = await importTauriModule();

    const blob = await saveComparisonSnapshot('session-5');

    await expect(blob?.text()).resolves.toBe('snapshot-bytes');
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-5/comparison-snapshot/save', {
      method: 'POST',
    });
    expect(saveMock).not.toHaveBeenCalled();
  });

  test('saveComparisonSnapshot opens a save dialog and invokes the Tauri command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    saveMock.mockResolvedValue('/tmp/comparison-snapshot.json');
    invokeMock.mockResolvedValue(undefined);

    const { saveComparisonSnapshot } = await importTauriModule();

    await expect(saveComparisonSnapshot('session-6')).resolves.toBeUndefined();
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'comparison-snapshot.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    expect(invokeMock).toHaveBeenCalledWith('save_comparison_snapshot', {
      sessionId: 'session-6',
      outputPath: '/tmp/comparison-snapshot.json',
    });
  });
});
