import { vi } from 'vitest';

const appTauriMocks = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  loadFileMock: vi.fn(),
  compareFilesMock: vi.fn(),
  exportResultsMock: vi.fn(),
  loadPairOrderMock: vi.fn(),
  downloadBlobMock: vi.fn(),
  savePairOrderMock: vi.fn(),
  suggestMappingsMock: vi.fn(),
}));

vi.mock('../services/tauri', () => ({
  isTauri: false,
  createSession: appTauriMocks.createSessionMock,
  loadFile: appTauriMocks.loadFileMock,
  compareFiles: appTauriMocks.compareFilesMock,
  exportResults: appTauriMocks.exportResultsMock,
  loadPairOrder: appTauriMocks.loadPairOrderMock,
  downloadBlob: appTauriMocks.downloadBlobMock,
  savePairOrder: appTauriMocks.savePairOrderMock,
  suggestMappings: appTauriMocks.suggestMappingsMock,
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

export function getAppTauriMocks() {
  return appTauriMocks;
}
