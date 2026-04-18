import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from './tauri';

export async function openNewAppWindow(): Promise<void> {
  if (isTauri) {
    const label = `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const webviewWindow = new WebviewWindow(label, {
      title: 'CSV Align',
      width: 1200,
      height: 800,
      center: true,
      resizable: true,
      url: window.location.href,
    });

    await new Promise<void>((resolve, reject) => {
      void webviewWindow.once('tauri://created', () => resolve());
      void webviewWindow.once('tauri://error', (event) => reject(new Error(String(event.payload))));
    });

    return;
  }

  const openedWindow = window.open(window.location.href, '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    throw new Error('Failed to open a new browser window');
  }
}
