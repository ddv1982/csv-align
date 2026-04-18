import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

async function renderHeader(options?: {
  isTauri?: boolean;
  openImpl?: () => Promise<void> | void;
}) {
  vi.resetModules();

  vi.doMock('../../services/appWindows', () => ({
    openNewAppWindow: vi.fn(options?.openImpl ?? (() => Promise.resolve())),
  }));

  const { AppHeader } = await import('./AppHeader');
  const appWindowsModule = await import('../../services/appWindows');

  render(
    <AppHeader
      onReset={vi.fn()}
    />,
  );

  return {
    openNewAppWindow: appWindowsModule.openNewAppWindow as ReturnType<typeof vi.fn>,
  };
}

afterEach(() => {
  cleanup();
  window.localStorage?.removeItem?.('csv-align-theme');
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  vi.resetModules();
  vi.doUnmock('../../services/appWindows');
});

test('opens a new app instance from the header action', async () => {
  const { openNewAppWindow } = await renderHeader();

  fireEvent.click(screen.getByRole('button', { name: 'New window' }));

  await waitFor(() => {
    expect(openNewAppWindow).toHaveBeenCalledTimes(1);
  });
});

test('shows a header error when opening a new app instance fails', async () => {
  const { openNewAppWindow } = await renderHeader({
    openImpl: () => Promise.reject(new Error('blocked')),
  });

  fireEvent.click(screen.getByRole('button', { name: 'New window' }));

  await waitFor(() => {
    expect(openNewAppWindow).toHaveBeenCalledTimes(1);
  });

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open a new window right now.');
});

test('adds a descriptive tooltip to the new window action', async () => {
  await renderHeader();

  expect(screen.getByRole('button', { name: 'New window' })).toHaveAttribute('title', 'Open CSV Align in a new window');
});

test('toggles between dark and light theme labels', async () => {
  await renderHeader();

  const themeButton = screen.getByRole('button', { name: 'Switch to light mode' });
  expect(themeButton).toHaveTextContent('Dark');

  fireEvent.click(themeButton);

  expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toHaveTextContent('Light');
});
