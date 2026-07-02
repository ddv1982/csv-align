/**
 * Contract constants mirrored from the Rust backend.
 *
 * MAX_CSV_FILE_BYTES mirrors `MAX_CSV_FILE_BYTES` in `src/backend/workflow.rs`;
 * the backend enforces the real limit, this copy only exists to reject
 * oversized files before uploading them. Keep the values in sync.
 */
export const MAX_CSV_FILE_BYTES = 25 * 1024 * 1024;

export function validateCsvFileSize(file: File): void {
  if (file.size > MAX_CSV_FILE_BYTES) {
    throw new Error('CSV file is too large; maximum supported size is 25 MiB');
  }
}
