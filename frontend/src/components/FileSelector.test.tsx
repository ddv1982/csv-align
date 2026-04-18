import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { FileSelector, hasCsvExtension } from './FileSelector';

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

  fireEvent.drop(screen.getByText('Drag & drop a local CSV file to choose it').closest('div') as HTMLElement, {
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

  const dropzone = screen.getByText('Drag & drop a local CSV file to choose it').closest('div')?.parentElement;

  expect(dropzone).toHaveClass('border-[color:var(--color-kinetic-line)]');
  expect(dropzone).toHaveClass('bg-[rgba(255,255,255,0.02)]');
});

test('supports keyboard activation on the dropzone', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  expect(dropzone).toHaveAttribute('tabindex', '0');
  expect(dropzone).toHaveAttribute('title', 'Choose a local CSV for File A');
});

test('activates the picker from Enter and Space key presses', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const dropzone = screen.getByRole('button', { name: 'File A file selector' });
  const input = screen.getByLabelText('Choose Local CSV', { selector: 'input' });
  const clickSpy = vi.spyOn(input, 'click');

  fireEvent.keyDown(dropzone, { key: 'Enter' });
  fireEvent.keyDown(dropzone, { key: ' ' });
  fireEvent.keyDown(dropzone, { key: 'Escape' });

  expect(clickSpy).toHaveBeenCalledTimes(2);
});

test('picker-cancel does not call onSelect when the file input is cleared', () => {
  const onSelect = vi.fn();
  render(<FileSelector label="File A" file={null} onSelect={onSelect} />);

  const input = screen.getByLabelText('Choose Local CSV', { selector: 'input' });

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
  expect(dropzone).toHaveClass('border-[color:var(--color-kinetic-accent)]', 'bg-[rgba(110,231,255,0.08)]');
  expect(dropzone).not.toHaveClass('border-[color:var(--color-kinetic-line)]', 'bg-[rgba(255,255,255,0.02)]');

  fireEvent.dragLeave(dropzone);
  expect(dropzone).toHaveClass('border-[color:var(--color-kinetic-line)]', 'bg-[rgba(255,255,255,0.02)]');
  expect(dropzone).not.toHaveClass('border-[color:var(--color-kinetic-accent)]', 'bg-[rgba(110,231,255,0.08)]');
  expect(onSelect).not.toHaveBeenCalled();
});
