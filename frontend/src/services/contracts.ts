/**
 * Frontend-visible policy mirrors from the authoritative Rust backend.
 *
 * These values provide preflight UX only. Backend checks remain authoritative.
 * Keep this object aligned with `contracts/transport-contract.json`.
 */
export const RESOURCE_LIMITS = {
  rawCsvBytes: 25 * 1024 * 1024,
  decodedCsvBytes: 100 * 1024 * 1024,
  csvColumns: 4_096,
  csvRows: 250_000,
  csvCells: 5_000_000,
  retainedCsvBytes: 128 * 1024 * 1024,
  comparisonResultsBytes: 128 * 1024 * 1024,
  virtualLabels: 10_000,
  jsonPathDepth: 64,
  retainedSessionBytes: 384 * 1024 * 1024,
  snapshotBytes: 128 * 1024 * 1024,
  htmlExportRows: 50_000,
  htmlExportDataBytes: 32 * 1024 * 1024,
  htmlExportDocumentBytes: 40 * 1024 * 1024,
} as const;

/** Compatibility alias for existing frontend callers. */
export const MAX_CSV_FILE_BYTES = RESOURCE_LIMITS.rawCsvBytes;

export function validateCsvFileSize(file: File): void {
  if (file.size > MAX_CSV_FILE_BYTES) {
    throw new Error('CSV file is too large; maximum supported size is 25 MiB');
  }
}

export function validateSnapshotFileSize(file: Pick<File, 'size'>): void {
  if (file.size > RESOURCE_LIMITS.snapshotBytes) {
    throw new Error('Comparison snapshot is too large; maximum supported size is 128 MiB');
  }
}
