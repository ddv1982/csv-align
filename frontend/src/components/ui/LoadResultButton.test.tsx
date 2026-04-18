import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

async function renderButton(isTauri: boolean, onLoadResult = vi.fn()) {
  vi.resetModules();
  vi.doMock('../../services/tauri', () => ({ isTauri }));

  const { LoadResultButton } = await import('./LoadResultButton');
  render(<LoadResultButton onLoadResult={onLoadResult} />);

  return { onLoadResult };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../../services/tauri');
});

test('uses a hidden JSON file input in browser mode and forwards the selected file', async () => {
  const { onLoadResult } = await renderButton(false);

  const input = screen.getByTestId('load-result-input');
  expect(input).toHaveAttribute('accept', '.json,application/json');

  fireEvent.change(input, {
    target: {
      files: [new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' })],
    },
  });

  expect(onLoadResult).toHaveBeenCalledTimes(1);
  expect(onLoadResult.mock.calls[0][0]).toBeInstanceOf(File);
  expect(onLoadResult.mock.calls[0][0].name).toBe('comparison-snapshot.json');
});

test('triggers loading directly in tauri mode without rendering a file input', async () => {
  const { onLoadResult } = await renderButton(true);

  expect(screen.queryByTestId('load-result-input')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Load result' }));
  expect(onLoadResult).toHaveBeenCalledWith();
});
