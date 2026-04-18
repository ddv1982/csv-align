import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('shows the fixed dark-theme status instead of a theme toggle', async () => {
  await renderHeader();

  expect(screen.queryByRole('button', { name: /switch to .* mode/i })).not.toBeInTheDocument();
  expect(screen.getByText('Theme locked')).toBeInTheDocument();
  expect(screen.getByText('Dark / Kinetic')).toBeInTheDocument();
});
