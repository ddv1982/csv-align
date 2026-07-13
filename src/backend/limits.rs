//! Authoritative product resource limits.
//!
//! Runtime enforcement is added at the relevant trust boundaries. Keep the
//! values here aligned with `contracts/transport-contract.json`; parity tests
//! intentionally fail when either side changes independently.

const MIB: usize = 1024 * 1024;

pub const MAX_RAW_CSV_BYTES: usize = 25 * MIB;
pub const MAX_DECODED_CSV_BYTES: usize = 100 * MIB;
pub const MAX_CSV_COLUMNS: usize = 4_096;
pub const MAX_CSV_ROWS: usize = 250_000;
pub const MAX_CSV_CELLS: usize = 5_000_000;
pub const MAX_RETAINED_CSV_BYTES: usize = 128 * MIB;
pub const MAX_COMPARISON_RESULTS_BYTES: usize = 128 * MIB;
pub const MAX_VIRTUAL_LABELS: usize = 10_000;
pub const MAX_JSON_PATH_DEPTH: usize = 64;
pub const MAX_RETAINED_SESSION_BYTES: usize = 384 * MIB;
pub const MAX_SNAPSHOT_BYTES: usize = 128 * MIB;
pub const MAX_HTML_EXPORT_ROWS: usize = 50_000;
pub const MAX_HTML_EXPORT_DATA_BYTES: usize = 32 * MIB;
pub const MAX_HTML_EXPORT_DOCUMENT_BYTES: usize = 40 * MIB;

/// Compatibility alias for existing callers.
pub const MAX_CSV_FILE_BYTES: usize = MAX_RAW_CSV_BYTES;
