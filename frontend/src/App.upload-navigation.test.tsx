import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ComparisonNormalizationConfig } from './types/api';

const {
  createSessionMock,
  uploadFileMock,
  compareFilesMock,
  exportResultsMock,
  downloadBlobMock,
} = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  uploadFileMock: vi.fn(),
  compareFilesMock: vi.fn(),
  exportResultsMock: vi.fn(),
  downloadBlobMock: vi.fn(),
}));

vi.mock('./services/tauri', () => ({
  createSession: createSessionMock,
  uploadFile: uploadFileMock,
  compareFiles: compareFilesMock,
  exportResults: exportResultsMock,
  downloadBlob: downloadBlobMock,
}));

vi.mock('./components/FileUpload', () => ({
  FileUpload: ({
    label,
    file,
    onUpload,
  }: {
    label: string;
    file: { name: string } | null;
    onUpload: (file: File) => void;
  }) => (
    <section>
      <h2>{label}</h2>
      <div>{file ? `Loaded ${file.name}` : `No file for ${label}`}</div>
      <button onClick={() => onUpload(new File(['id,name'], `${label}.csv`, { type: 'text/csv' }))}>
        Upload {label}
      </button>
    </section>
  ),
}));

vi.mock('./components/MappingConfig', () => ({
  MappingConfig: ({
    selection,
    normalization,
    onSelectionChange,
    onNormalizationChange,
  }: {
    selection: {
      keyColumnsA: string[];
      keyColumnsB: string[];
      comparisonColumnsA: string[];
      comparisonColumnsB: string[];
    };
    normalization: ComparisonNormalizationConfig;
    onSelectionChange: (selection: {
      keyColumnsA: string[];
      keyColumnsB: string[];
      comparisonColumnsA: string[];
      comparisonColumnsB: string[];
    }) => void;
    onNormalizationChange: (normalization: ComparisonNormalizationConfig) => void;
  }) => (
    <section>
      <h2>Mock Configure</h2>
      <div data-testid="selection-state">
        {JSON.stringify(selection)}
      </div>
      <div data-testid="normalization-state">
        {normalization.case_insensitive ? 'case-insensitive-on' : 'case-insensitive-off'}
      </div>
      <button
        onClick={() =>
          onSelectionChange({
            keyColumnsA: ['id'],
            keyColumnsB: ['id'],
            comparisonColumnsA: ['name'],
            comparisonColumnsB: ['name'],
          })
        }
      >
        Choose columns
      </button>
      <button
        onClick={() =>
          onNormalizationChange({
            ...normalization,
            case_insensitive: true,
          })
        }
      >
        Enable case insensitive
      </button>
    </section>
  ),
}));

vi.mock('./components/SummaryStats', () => ({
  SummaryStats: () => <div>Mock Summary</div>,
}));

vi.mock('./components/FilterBar', () => ({
  FilterBar: () => <div>Mock Filter Bar</div>,
}));

vi.mock('./components/ResultsTable', () => ({
  ResultsTable: () => <div>Mock Results Table</div>,
}));

import App from './App';

beforeEach(() => {
  createSessionMock.mockReset();
  uploadFileMock.mockReset();
  compareFilesMock.mockReset();
  exportResultsMock.mockReset();
  downloadBlobMock.mockReset();

  createSessionMock.mockResolvedValue({ session_id: 'session-123' });
  uploadFileMock.mockImplementation(async (_sessionId: string, file: File) => ({
    success: true,
    file_letter: 'a',
    headers: ['id', 'name'],
    columns: [
      { index: 0, name: 'id', data_type: 'string' },
      { index: 1, name: 'name', data_type: 'string' },
    ],
    row_count: file.name === 'File A.csv' ? 3 : 4,
  }));
});

test('returns to upload with files intact and resumes configure without losing state', async () => {
  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  fireEvent.click(screen.getByRole('button', { name: 'Upload File A' }));
  await screen.findByRole('button', { name: 'Upload File B' });
  fireEvent.click(screen.getByRole('button', { name: 'Upload File B' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });

  fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enable case insensitive' }));

  expect(screen.getByTestId('selection-state')).toHaveTextContent('"comparisonColumnsA":["name"]');
  expect(screen.getByTestId('normalization-state')).toHaveTextContent('case-insensitive-on');

  fireEvent.click(screen.getByRole('button', { name: 'Back to file selection' }));

  expect(screen.getByText('Loaded File A.csv')).toBeInTheDocument();
  expect(screen.getByText('Loaded File B.csv')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to configuration' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Continue to configuration' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });
  expect(screen.getByTestId('selection-state')).toHaveTextContent('"comparisonColumnsA":["name"]');
  expect(screen.getByTestId('normalization-state')).toHaveTextContent('case-insensitive-on');
});

test('replacing one file after returning to upload resets configure state to defaults', async () => {
  render(<App />);

  await waitFor(() => {
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  fireEvent.click(screen.getByRole('button', { name: 'Upload File A' }));
  await screen.findByRole('button', { name: 'Upload File B' });
  fireEvent.click(screen.getByRole('button', { name: 'Upload File B' }));

  await screen.findByRole('heading', { name: 'Mock Configure' });

  fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enable case insensitive' }));

  expect(screen.getByTestId('selection-state')).toHaveTextContent('"comparisonColumnsA":["name"]');
  expect(screen.getByTestId('normalization-state')).toHaveTextContent('case-insensitive-on');

  fireEvent.click(screen.getByRole('button', { name: 'Back to file selection' }));

  expect(screen.getByText('Loaded File A.csv')).toBeInTheDocument();
  expect(screen.getByText('Loaded File B.csv')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Upload File A' }));

  await waitFor(() => {
    expect(uploadFileMock).toHaveBeenCalledTimes(3);
  });
  await screen.findByRole('heading', { name: 'Mock Configure' });

  expect(screen.getByTestId('selection-state')).toHaveTextContent('"keyColumnsA":[]');
  expect(screen.getByTestId('selection-state')).toHaveTextContent('"keyColumnsB":[]');
  expect(screen.getByTestId('selection-state')).toHaveTextContent('"comparisonColumnsA":[]');
  expect(screen.getByTestId('selection-state')).toHaveTextContent('"comparisonColumnsB":[]');
  expect(screen.getByTestId('normalization-state')).toHaveTextContent('case-insensitive-off');
});
