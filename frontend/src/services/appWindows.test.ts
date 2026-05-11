import { beforeEach, describe, expect, test, vi } from 'vitest';

const windowOpenMock = vi.fn();
const webviewWindowMock = vi.fn();

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: webviewWindowMock,
}));

async function importAppWindowsModule() {
  vi.resetModules();
  return import('./appWindows');
}

describe('openNewAppWindow', () => {
  beforeEach(() => {
    windowOpenMock.mockReset();
    webviewWindowMock.mockReset();
    vi.unstubAllGlobals();
    windowOpenMock.mockReturnValue({ focus: vi.fn() });
    vi.stubGlobal('open', windowOpenMock);
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  test('opens the current app URL in a new browser tab when not running in Tauri', async () => {
    const { openNewAppWindow } = await importAppWindowsModule();

    await openNewAppWindow();

    expect(windowOpenMock).toHaveBeenCalledWith(window.location.href, '_blank', 'noopener,noreferrer');
    expect(webviewWindowMock).not.toHaveBeenCalled();
  });

  test('throws when the browser blocks opening a new window', async () => {
    windowOpenMock.mockReturnValue(null);
    const { openNewAppWindow } = await importAppWindowsModule();

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

    const { openNewAppWindow } = await importAppWindowsModule();

    await openNewAppWindow();

    expect(webviewWindowMock).toHaveBeenCalledTimes(1);
    const [label, options] = webviewWindowMock.mock.calls[0] as [
      string,
      { title: string; width: number; height: number; center: boolean; resizable: boolean; url: string },
    ];
    expect(label).toMatch(/^app-/);
    expect(options.title).toBe('CSV Align');
    expect(options.width).toBe(1200);
    expect(options.height).toBe(880);
    expect(options.center).toBe(true);
    expect(options.resizable).toBe(true);
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

    const { openNewAppWindow } = await importAppWindowsModule();

    await expect(openNewAppWindow()).rejects.toThrow('creation failed');
  });
});
