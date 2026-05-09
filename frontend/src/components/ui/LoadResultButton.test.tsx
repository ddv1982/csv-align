import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

async function renderButton(isTauri: boolean, onLoadResult = vi.fn()) {
  vi.resetModules();
  vi.doMock('../../services/tauri', () => ({ isTauri }));

  const { LoadResultButton } = await import('./LoadResultButton');
  const renderResult = render(<LoadResultButton onLoadResult={onLoadResult} />);

  return { onLoadResult, ...renderResult };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../../services/tauri');
});

test('uses a semantic button trigger with a hidden JSON file input in browser mode', async () => {
  await renderButton(false);

  const trigger = screen.getByRole('button', { name: 'Open saved result' });
  const input = screen.getByTestId('load-result-input');
  const clickSpy = vi.spyOn(input, 'click');

  expect(input).toHaveAttribute('accept', '.json,application/json');

  fireEvent.click(trigger);
  expect(clickSpy).toHaveBeenCalledTimes(1);
});

test('forwards the selected file in browser mode', async () => {
  const { onLoadResult } = await renderButton(false);

  const input = screen.getByTestId('load-result-input');

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

  fireEvent.click(screen.getByRole('button', { name: 'Open saved result' }));
  expect(onLoadResult).toHaveBeenCalledWith();
});

test('renders an svg icon inside the saved-result action', async () => {
  await renderButton(false);

  const trigger = screen.getByRole('button', { name: 'Open saved result' });
  expect(trigger.querySelector('svg')).not.toBeNull();
});
