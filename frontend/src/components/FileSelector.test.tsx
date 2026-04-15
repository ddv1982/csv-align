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
