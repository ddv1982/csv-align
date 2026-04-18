// NOTE: This file must stay `.tsx` because these shared fixtures render JSX mocks.
import { vi } from 'vitest';

const appTauriMocks = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  loadFileMock: vi.fn(),
  compareFilesMock: vi.fn(),
  exportResultsMock: vi.fn(),
  loadComparisonSnapshotMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  saveComparisonSnapshotMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  isTauri: false,
  createSession: appTauriMocks.createSessionMock,
  loadFile: appTauriMocks.loadFileMock,
  compareFiles: appTauriMocks.compareFilesMock,
  exportResults: appTauriMocks.exportResultsMock,
  loadComparisonSnapshot: appTauriMocks.loadComparisonSnapshotMock,
  loadPairOrder: appTauriMocks.loadPairOrderMock,
  savePairOrder: appTauriMocks.savePairOrderMock,
  saveComparisonSnapshot: appTauriMocks.saveComparisonSnapshotMock,
  suggestMappings: appTauriMocks.suggestMappingsMock,
}));

vi.mock('../services/browserDownload', () => ({
  downloadBlob: appTauriMocks.downloadBlobMock,
}));

vi.mock('../components/FileSelector', () => ({
  FileSelector: ({
    label,
    file,
    onSelect,
  }: {
    label: string;
    file?: { name: string } | null;
    onSelect: (file: File) => void;
  }) => (
    <section>
      <h2>{label}</h2>
      <div>{file ? `Selected ${file.name}` : `No file selected for ${label}`}</div>
      <button onClick={() => onSelect(new File(['id,name'], `${label}.csv`, { type: 'text/csv' }))}>
        Select {label}
      </button>
    </section>
  ),
}));

vi.mock('../components/MappingConfig', () => ({
  MappingConfig: ({
    selection,
    normalization,
    onSelectionChange,
    onNormalizationChange,
    onCompare,
  }: {
    selection?: {
      keyColumnsA: string[];
      keyColumnsB: string[];
      comparisonColumnsA: string[];
      comparisonColumnsB: string[];
    };
    normalization: import('../types/api').ComparisonNormalizationConfig;
    onSelectionChange?: (selection: {
      keyColumnsA: string[];
      keyColumnsB: string[];
      comparisonColumnsA: string[];
      comparisonColumnsB: string[];
    }) => void;
    onNormalizationChange?: (normalization: import('../types/api').ComparisonNormalizationConfig) => void;
    onCompare: (
      keyColumnsA: string[],
      keyColumnsB: string[],
      comparisonColumnsA: string[],
      comparisonColumnsB: string[],
      columnMappings: import('../types/api').MappingDto[],
      normalization: import('../types/api').ComparisonNormalizationConfig,
    ) => void;
  }) => (
    <section>
      <h2>Mock Configure</h2>
      {selection ? <div data-testid="selection-state">{JSON.stringify(selection)}</div> : null}
      <div data-testid="normalization-state">
        {normalization.case_insensitive ? 'case-insensitive-on' : 'case-insensitive-off'}
      </div>
      {onSelectionChange ? (
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
      ) : null}
      {onNormalizationChange ? (
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
      ) : null}
      <button
        onClick={() =>
          onCompare(
            ['id'],
            ['id'],
            ['name'],
            ['name'],
            [
              {
                file_a_column: 'name',
                file_b_column: 'name',
                mapping_type: 'manual',
              },
            ],
            normalization,
          )
        }
      >
        Run compare
      </button>
    </section>
  ),
}));

export function getAppTauriMocks() {
  return appTauriMocks;
}
