import { beforeEach, describe, expect, test, vi } from 'vitest';

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();
const windowOpenMock = vi.fn();
const webviewWindowMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
  save: saveMock,
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: webviewWindowMock,
}));

async function importTauriModule() {
  vi.resetModules();
  return import('./tauri');
}

describe('transport helpers', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();
    windowOpenMock.mockReset();
    webviewWindowMock.mockReset();
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
});

describe('openNewAppWindow', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();
    windowOpenMock.mockReset();
    webviewWindowMock.mockReset();
    vi.unstubAllGlobals();
    windowOpenMock.mockReturnValue({ focus: vi.fn() });
    vi.stubGlobal('open', windowOpenMock);
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  test('opens the current app URL in a new browser tab when not running in Tauri', async () => {
    const { openNewAppWindow } = await importTauriModule();

    await openNewAppWindow();

    expect(windowOpenMock).toHaveBeenCalledWith(window.location.href, '_blank', 'noopener,noreferrer');
    expect(webviewWindowMock).not.toHaveBeenCalled();
  });

  test('throws when the browser blocks opening a new window', async () => {
    windowOpenMock.mockReturnValue(null);
    const { openNewAppWindow } = await importTauriModule();

    await expect(openNewAppWindow()).rejects.toThrow('Failed to open a new browser window');
  });

  test('creates a Tauri webview window and waits for the created event', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    webviewWindowMock.mockImplementation(function MockWebviewWindow() {
      return {
        once: (event: string, callback: (payload?: unknown) => void) => {
          if (event === 'tauri://created') {
            callback();
          }
        },
      };
    });

    const { openNewAppWindow } = await importTauriModule();

    await openNewAppWindow();

    expect(webviewWindowMock).toHaveBeenCalledTimes(1);
    const [label, options] = webviewWindowMock.mock.calls[0] as [string, { title: string; url: string }];
    expect(label).toMatch(/^app-/);
    expect(options.title).toBe('CSV Align');
    expect(options.url).toBe(window.location.href);
  });

  test('surfaces Tauri window creation errors from the error event', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    webviewWindowMock.mockImplementation(function MockWebviewWindow() {
      return {
        once: (event: string, callback: (payload?: { payload?: string }) => void) => {
          if (event === 'tauri://error') {
            callback({ payload: 'creation failed' });
          }
        },
      };
    });

    const { openNewAppWindow } = await importTauriModule();

    await expect(openNewAppWindow()).rejects.toThrow('creation failed');
  });
});
