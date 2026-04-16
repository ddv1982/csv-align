import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

async function renderStep(isTauri: boolean) {
  vi.resetModules();
  vi.doMock('../../services/tauri', () => ({ isTauri }));

  const { FileSelectionStep } = await import('./FileSelectionStep');
  const onFileSelect = vi.fn();
  const onLoadResult = vi.fn();

  render(
    <FileSelectionStep
      fileA={null}
      fileB={null}
      onFileSelect={onFileSelect}
      onLoadResult={onLoadResult}
      onContinue={vi.fn()}
    />,
  );

  return { onFileSelect, onLoadResult };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../../services/tauri');
});

test('shows load result copy and forwards the selected snapshot file in browser mode', async () => {
  const { onFileSelect, onLoadResult } = await renderStep(false);

  expect(screen.getByText('Already have a saved result?')).toBeInTheDocument();
  expect(screen.getByText('Load a saved comparison snapshot to reopen the results in read-only mode.')).toBeInTheDocument();

  fireEvent.change(screen.getByTestId('load-result-input'), {
    target: {
      files: [new File(['saved'], 'comparison-snapshot.json', { type: 'application/json' })],
    },
  });

  expect(onLoadResult).toHaveBeenCalledTimes(1);
  expect(onLoadResult.mock.calls[0][0]).toBeInstanceOf(File);
  expect(onLoadResult.mock.calls[0][0].name).toBe('comparison-snapshot.json');
  expect(onFileSelect).not.toHaveBeenCalled();
});

test('triggers saved-result loading directly in tauri mode', async () => {
  const { onLoadResult } = await renderStep(true);

  expect(screen.queryByTestId('load-result-input')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Load result' }));

  expect(onLoadResult).toHaveBeenCalledTimes(1);
  expect(onLoadResult).toHaveBeenCalledWith();
});
