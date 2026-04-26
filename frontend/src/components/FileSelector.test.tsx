import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { TauriDragDropEvent } from '../services/tauri';
import { listenForTauriDragDrop } from '../services/tauri';
import { FileSelector, hasCsvExtension } from './FileSelector';

vi.mock('../services/tauri', async () => {
  const actual = await vi.importActual('../services/tauri');
  return {
    ...actual,
    listenForTauriDragDrop: vi.fn(),
  };
});

const listenForTauriDragDropMock = vi.mocked(listenForTauriDragDrop);

beforeEach(() => {
  listenForTauriDragDropMock.mockReset();
  listenForTauriDragDropMock.mockResolvedValue(undefined);
});

test('accepts files by .csv extension even when the MIME type is generic', () => {
  expect(hasCsvExtension('report.csv')).toBe(true);
  expect(hasCsvExtension('REPORT.CSV')).toBe(true);
  expect(hasCsvExtension('report.txt')).toBe(false);

  const onSelect = vi.fn();
  const { container } = render(<FileSelector label="File A" file={null} onSelect={onSelect} />);
  const input = container.querySelector('input[type="file"]');

  expect(input).not.toBeNull();

  fireEvent.change(input as HTMLInputElement, {
    target: {
      files: [new File(['id,name\n1,Alice'], 'python-export.csv', { type: 'application/octet-stream' })],
    },
  });

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect.mock.calls[0][0]).toBeInstanceOf(File);
  expect(onSelect.mock.calls[0][0].name).toBe('python-export.csv');
  expect(screen.queryByText('Please choose a file with a .csv extension.')).not.toBeInTheDocument();
});

test('rejects files without a .csv extension even if the MIME type looks like csv', () => {
  const onSelect = vi.fn();
  const { container } = render(<FileSelector label="File B" file={null} onSelect={onSelect} />);
  const input = container.querySelector('input[type="file"]');

  expect(input).not.toBeNull();

  fireEvent.change(input as HTMLInputElement, {
    target: {
      files: [new File(['id,name\n1,Alice'], 'python-export.txt', { type: 'text/csv' })],
    },
  });

  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByText('Please choose a file with a .csv extension.')).toBeInTheDocument();
});

test('accepts dropped files with an uppercase .CSV extension', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  fireEvent.drop(screen.getByText('Drag a CSV file here').closest('div') as HTMLElement, {
    dataTransfer: {
      files: [new File(['id,name\n1,Alice'], 'UPPERCASE.CSV', { type: '' })],
    },
  });

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect.mock.calls[0][0].name).toBe('UPPERCASE.CSV');
});

test('renders the kinetic idle styling for the empty dropzone', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByText('Drag a CSV file here').closest('div')?.parentElement;

  expect(dropzone).toHaveClass('kinetic-dropzone');
});

test('renders a semantic button trigger for choosing a file in empty state', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  expect(screen.getByRole('button', { name: 'Choose a CSV file' })).toBeInTheDocument();
});

test('supports keyboard activation on the dropzone', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  expect(dropzone).toHaveAttribute('tabindex', '0');
  expect(dropzone).toHaveAttribute('title', 'Choose a CSV file for File A');
});

test('activates the picker from Enter and Space key presses', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  const input = screen.getByLabelText('Choose a CSV file', { selector: 'input' });
  const clickSpy = vi.spyOn(input, 'click');

  fireEvent.keyDown(dropzone, { key: 'Enter' });
  fireEvent.keyDown(dropzone, { key: ' ' });
  fireEvent.keyDown(dropzone, { key: 'Escape' });

  expect(clickSpy).toHaveBeenCalledTimes(2);
});

test('renders a semantic button trigger for replacing a selected file', () => {
  const onSelect = vi.fn();
  render(
    <FileSelector
      label="File A"
      file={{
        name: 'existing.csv',
        headers: ['id'],
        columns: [{ index: 0, name: 'id', data_type: 'string' }],
        rowCount: 1,
      }}
      onSelect={onSelect}
    />,
  );

  expect(screen.getByRole('button', { name: 'Choose a different CSV file' })).toBeInTheDocument();
});

test('picker-cancel does not call onSelect when the file input is cleared', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const input = screen.getByLabelText('Choose a CSV file', { selector: 'input' });

  fireEvent.change(input, {
    target: {
      files: [],
    },
  });

  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByText('Please choose a file with a .csv extension.')).not.toBeInTheDocument();
});

test('drag-leave-resets-hover styling without calling onSelect', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });

  fireEvent.dragOver(dropzone);
  expect(dropzone).toHaveClass('kinetic-dropzone-active');
  expect(dropzone).not.toHaveClass('kinetic-dropzone');

  fireEvent.dragLeave(dropzone);
  expect(dropzone).toHaveClass('kinetic-dropzone');
  expect(dropzone).not.toHaveClass('kinetic-dropzone-active');
  expect(onSelect).not.toHaveBeenCalled();
});

test('accepts a Tauri path drop when the window drop lands inside the selector', async () => {
  const onSelect = vi.fn();
  let dragDropHandler: ((event: TauriDragDropEvent) => void) | undefined;

  listenForTauriDragDropMock.mockImplementation(async (handler) => {
    dragDropHandler = handler;
    return undefined;
  });

  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  vi.spyOn(dropzone, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    top: 0,
    right: 200,
    bottom: 120,
    left: 0,
    toJSON: () => ({}),
  });

  dragDropHandler?.({ type: 'drop', paths: ['/tmp/desktop-drop.csv'], position: { x: 50, y: 50 } });

  await waitFor(() => {
    expect(onSelect).toHaveBeenCalledWith('/tmp/desktop-drop.csv');
  });
  expect(screen.queryByText('Please choose a file with a .csv extension.')).not.toBeInTheDocument();
});

test('ignores a Tauri path drop when the window drop lands outside the selector bounds', async () => {
  const onSelect = vi.fn();
  let dragDropHandler: ((event: TauriDragDropEvent) => void) | undefined;

  listenForTauriDragDropMock.mockImplementation(async (handler) => {
    dragDropHandler = handler;
    return undefined;
  });

  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  vi.spyOn(dropzone, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    top: 0,
    right: 200,
    bottom: 120,
    left: 0,
    toJSON: () => ({}),
  });

  dragDropHandler?.({ type: 'enter', paths: ['/tmp/outside-drop.csv'], position: { x: 50, y: 50 } });

  dragDropHandler?.({ type: 'drop', paths: ['/tmp/outside-drop.csv'], position: { x: 240, y: 140 } });

  await waitFor(() => {
    expect(dropzone).toHaveClass('kinetic-dropzone');
  });
  expect(dropzone).not.toHaveClass('kinetic-dropzone-active');
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByText('Please choose a file with a .csv extension.')).not.toBeInTheDocument();
});
