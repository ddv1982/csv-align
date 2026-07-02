import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TAURI_COMMANDS } from './tauriCommands';

const invokeMock = vi.fn();
const onDragDropEventMock = vi.fn();
const getCurrentWebviewWindowMock = vi.fn(() => ({
  onDragDropEvent: onDragDropEventMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: getCurrentWebviewWindowMock,
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
    onDragDropEventMock.mockReset();
    getCurrentWebviewWindowMock.mockClear();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  test('listenForTauriDragDrop is a no-op outside Tauri', async () => {
    const handler = vi.fn();
    const { listenForTauriDragDrop } = await importTauriModule();

    await expect(listenForTauriDragDrop(handler)).resolves.toBeUndefined();
    expect(getCurrentWebviewWindowMock).not.toHaveBeenCalled();
    expect(onDragDropEventMock).not.toHaveBeenCalled();
  });

  test('listenForTauriDragDrop subscribes to the window drag-drop stream in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const unlisten = vi.fn();
    const handler = vi.fn();
    onDragDropEventMock.mockResolvedValue(unlisten);

    const { listenForTauriDragDrop } = await importTauriModule();

    await expect(listenForTauriDragDrop(handler)).resolves.toBe(unlisten);
    expect(getCurrentWebviewWindowMock).toHaveBeenCalledTimes(1);
    expect(onDragDropEventMock).toHaveBeenCalledTimes(1);

    const bridgeHandler = onDragDropEventMock.mock.calls[0][0] as (event: { payload: unknown }) => void;
    bridgeHandler({
      payload: { type: 'drop', paths: ['/tmp/bridge.csv'], position: { x: 24, y: 48 } },
    });

    expect(handler).toHaveBeenCalledWith({
      type: 'drop',
      paths: ['/tmp/bridge.csv'],
      position: { x: 24, y: 48 },
    });
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
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.createSession);
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
    expect(invokeMock).toHaveBeenCalledWith(
      TAURI_COMMANDS.loadCsvBytes,
      new Uint8Array([97, 98, 99]),
      {
        headers: {
          'session-id': 'session-2',
          'file-letter': 'b',
          'file-name': 'tauri.csv',
        },
      },
    );
  });

  test('loadFile rejects Tauri string paths before invoking the backend', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    const { loadFile } = await importTauriModule();

    await expect(loadFile('session-path', '/tmp/input.csv', 'a')).rejects.toThrow(
      'Desktop path loading is disabled',
    );
    expect(invokeMock).not.toHaveBeenCalled();
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

    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.compare, {
      sessionId: 'session-4',
      request,
    });
  });

  test('saveComparisonSnapshot posts to the browser snapshot endpoint when not running in Tauri', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('snapshot-bytes', { status: 200 }));

    const { saveComparisonSnapshot } = await importTauriModule();

    const blob = await saveComparisonSnapshot('session-5');

    expect(blob).toBeInstanceOf(Blob);
  await expect((blob as Blob).text()).resolves.toBe('snapshot-bytes');
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-5/comparison-snapshot/save', {
      method: 'POST',
    });
  });

  test('saveComparisonSnapshot invokes the pathless Tauri command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    const { saveComparisonSnapshot } = await importTauriModule();

    await expect(saveComparisonSnapshot('session-6')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.saveComparisonSnapshot, {
      sessionId: 'session-6',
    });
  });

  test('deleteSession invokes the Tauri delete command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    const { deleteSession } = await importTauriModule();

    await expect(deleteSession('session-7')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.deleteSession, {
      sessionId: 'session-7',
    });
  });

  test('deleteSession treats browser 404 not-found responses as already deleted', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({ code: 'not_found', error: 'Session not found' }, { status: 404 }));

    const { deleteSession } = await importTauriModule();

    await expect(deleteSession('missing-session')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/missing-session', { method: 'DELETE' });
  });

  test('deleteSession rejects non-contract browser 404 responses', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({ error: 'route not found' }, { status: 404 }));

    const { deleteSession } = await importTauriModule();

    await expect(deleteSession('missing-session')).rejects.toThrow('route not found');
  });

  test('deleteSession treats Tauri not-found errors as already deleted', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockRejectedValue({ code: 'not_found', error: 'Session not found' });

    const { deleteSession } = await importTauriModule();

    await expect(deleteSession('missing-session')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.deleteSession, {
      sessionId: 'missing-session',
    });
  });

  test('suggestMappings invokes the Tauri mapping command when running in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({ mappings: [] });

    const { suggestMappings } = await importTauriModule();
    const request = { columns_a: ['id'], columns_b: ['record_id'] };

    await expect(suggestMappings('session-8', request)).resolves.toEqual({ mappings: [] });
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.suggestMappings, {
      sessionId: 'session-8',
      request,
    });
  });

  test('suggestMappings posts JSON to the browser mapping endpoint', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      mappings: [{
        file_a_column: 'name',
        file_b_column: 'display_name',
        mapping_type: 'fuzzy',
        similarity: 0.92,
      }],
    }));

    const { suggestMappings } = await importTauriModule();
    const request = { columns_a: ['name'], columns_b: ['display_name'] };

    await expect(suggestMappings('session-8', request)).resolves.toEqual({
      mappings: [{
        file_a_column: 'name',
        file_b_column: 'display_name',
        mapping_type: 'fuzzy',
        similarity: 0.92,
      }],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-8/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('exportResults invokes the pathless Tauri export command', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    const { exportResults } = await importTauriModule();

    await expect(exportResults('session-9')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.exportResults, {
      sessionId: 'session-9',
    });
  });

  test('exportResults downloads a browser CSV blob from the export endpoint', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('status,key\nMatch,1\n', { status: 200 }));

    const { exportResults } = await importTauriModule();

    const blob = await exportResults('session-9');

    expect(blob).toBeDefined();
    expect(blob).toBeInstanceOf(Blob);
  await expect((blob as Blob).text()).resolves.toBe('status,key\nMatch,1\n');
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-9/export', {
      method: 'GET',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('exportResultsHtml returns a browser blob outside Tauri', async () => {
    const { exportResultsHtml } = await importTauriModule();

    const blob = await exportResultsHtml('<!DOCTYPE html><title>Export</title>');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob).toBeInstanceOf(Blob);
  await expect((blob as Blob).text()).resolves.toContain('<title>Export</title>');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('exportResultsHtml invokes the pathless Tauri html export command', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    const { exportResultsHtml } = await importTauriModule();

    await expect(exportResultsHtml('<!DOCTYPE html><title>Export</title>')).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.exportResultsHtml, {
      htmlContents: '<!DOCTYPE html><title>Export</title>',
    });
  });

  test('savePairOrder invokes the pathless Tauri pair-order save command', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    const { savePairOrder } = await importTauriModule();
    const selection = {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['display_name'],
    };

    await expect(savePairOrder('session-10', selection)).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.savePairOrder, {
      sessionId: 'session-10',
      selection,
    });
  });

  test('savePairOrder posts browser JSON and returns a pair-order blob', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('{"version":1}', { status: 200 }));

    const { savePairOrder } = await importTauriModule();
    const selection = {
      key_columns_a: ['id'],
      key_columns_b: ['record_id'],
      comparison_columns_a: ['name'],
      comparison_columns_b: ['display_name'],
    };

    const blob = await savePairOrder('session-10', selection);

    expect(blob).toBeDefined();
    expect(blob).toBeInstanceOf(Blob);
  await expect((blob as Blob).text()).resolves.toBe('{"version":1}');
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-10/pair-order/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selection }),
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('loadPairOrder invokes the pathless Tauri pair-order load command', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({ selection: { key_columns_a: [], key_columns_b: [], comparison_columns_a: [], comparison_columns_b: [] } });

    const { loadPairOrder } = await importTauriModule();

    await expect(loadPairOrder('session-11')).resolves.toEqual({
      selection: { key_columns_a: [], key_columns_b: [], comparison_columns_a: [], comparison_columns_b: [] },
    });
    expect(invokeMock).toHaveBeenCalledWith(TAURI_COMMANDS.loadPairOrder, {
      sessionId: 'session-11',
    });
  });

  test('loadPairOrder posts browser file contents to the pair-order load endpoint', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      selection: {
        key_columns_a: ['id'],
        key_columns_b: ['record_id'],
        comparison_columns_a: ['name'],
        comparison_columns_b: ['display_name'],
      },
    }));

    const { loadPairOrder } = await importTauriModule();
    const file = new File(['{"version":1}'], 'order.csv-align-order.json', { type: 'application/json' });

    await expect(loadPairOrder('session-11', file)).resolves.toEqual({
      selection: {
        key_columns_a: ['id'],
        key_columns_b: ['record_id'],
        comparison_columns_a: ['name'],
        comparison_columns_b: ['display_name'],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-11/pair-order/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: '{"version":1}' }),
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('loadPairOrder rejects missing browser files before fetching', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { loadPairOrder } = await importTauriModule();

    await expect(loadPairOrder('session-11')).rejects.toThrow('No pair-order file selected');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
