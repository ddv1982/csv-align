use std::sync::Arc;

use crate::backend::error::CsvAlignError;
use crate::backend::limits::MAX_SNAPSHOT_BYTES;
use crate::backend::persistence::v1::{
    PreparedSnapshotV1, SNAPSHOT_VERSION, SnapshotV1, serialize_snapshot_v1,
    unsupported_snapshot_version_message,
};
use crate::backend::requests::LoadComparisonSnapshotResponse;
use crate::backend::session::SessionData;
use crate::data::types::{ColumnCatalog, ComparisonConfig, CsvData, RowComparisonResult};

pub fn ensure_snapshot_size(byte_length: usize) -> Result<(), CsvAlignError> {
    if byte_length > MAX_SNAPSHOT_BYTES {
        tracing::warn!(
            limit_name = "comparison snapshot bytes",
            actual = byte_length,
            limit = MAX_SNAPSHOT_BYTES,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Comparison snapshot exceeds the {MAX_SNAPSHOT_BYTES} byte limit"
        )));
    }
    Ok(())
}

fn deserialize_snapshot(contents: &[u8]) -> Result<SnapshotV1, CsvAlignError> {
    ensure_snapshot_size(contents.len())?;
    reject_unsupported_top_level_version(contents)?;
    serde_json::from_slice(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse comparison snapshot file: {error}"))
    })
}

/// Find an ordinary top-level `version` key without deserializing the document.
/// This preserves the legacy-version diagnostic even when an unsupported file
/// also has fields that cannot be decoded as v2, while valid v2 documents are
/// still deserialized exactly once.
fn reject_unsupported_top_level_version(contents: &[u8]) -> Result<(), CsvAlignError> {
    let mut depth = 0_usize;
    let mut index = 0_usize;
    while index < contents.len() {
        match contents[index] {
            b'{' | b'[' => {
                depth += 1;
                index += 1;
            }
            b'}' | b']' => {
                depth = depth.saturating_sub(1);
                index += 1;
            }
            b'"' => {
                let start = index + 1;
                index = start;
                let mut escaped = false;
                while index < contents.len() {
                    let byte = contents[index];
                    if escaped {
                        escaped = false;
                    } else if byte == b'\\' {
                        escaped = true;
                    } else if byte == b'"' {
                        break;
                    }
                    index += 1;
                }
                let end = index;
                index = index.saturating_add(1);

                if depth != 1 || &contents[start..end] != b"version" {
                    continue;
                }
                while contents.get(index).is_some_and(u8::is_ascii_whitespace) {
                    index += 1;
                }
                if contents.get(index) != Some(&b':') {
                    continue;
                }
                index += 1;
                while contents.get(index).is_some_and(u8::is_ascii_whitespace) {
                    index += 1;
                }
                let number_start = index;
                if contents.get(index) == Some(&b'-') {
                    index += 1;
                }
                let digit_start = index;
                while contents.get(index).is_some_and(u8::is_ascii_digit) {
                    index += 1;
                }
                if index == digit_start || matches!(contents.get(index), Some(b'.' | b'e' | b'E')) {
                    continue;
                }
                let mut trailer = index;
                while contents.get(trailer).is_some_and(u8::is_ascii_whitespace) {
                    trailer += 1;
                }
                if !matches!(contents.get(trailer), Some(b',' | b'}')) {
                    continue;
                }
                let version = &contents[number_start..index];
                let expected_version = SNAPSHOT_VERSION.to_string();
                if version != expected_version.as_bytes() {
                    let version = String::from_utf8_lossy(version);
                    return Err(CsvAlignError::BadInput(
                        unsupported_snapshot_version_message(version),
                    ));
                }
            }
            _ => index += 1,
        }
    }
    Ok(())
}

pub fn validate_comparison_snapshot_version(contents: &str) -> Result<(), CsvAlignError> {
    deserialize_snapshot(contents.as_bytes()).map(|_| ())
}

/// Everything a snapshot save needs, cloned out of the session so the
/// expensive serialization can run without holding the store lock.
pub struct ComparisonSnapshotInputs {
    csv_a: Arc<CsvData>,
    csv_b: Arc<CsvData>,
    catalog_a: Arc<ColumnCatalog>,
    catalog_b: Arc<ColumnCatalog>,
    config: ComparisonConfig,
    results: Vec<RowComparisonResult>,
}

pub fn snapshot_inputs_from_session(
    session_data: &SessionData,
) -> Result<ComparisonSnapshotInputs, CsvAlignError> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File A not selected or loaded".to_string()))?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File B not selected or loaded".to_string()))?;
    let config = session_data.comparison_config.as_ref().ok_or_else(|| {
        CsvAlignError::BadInput(
            "No comparison results to save. Run a comparison first.".to_string(),
        )
    })?;

    Ok(ComparisonSnapshotInputs {
        csv_a: Arc::clone(csv_a),
        csv_b: Arc::clone(csv_b),
        catalog_a: Arc::clone(&session_data.columns_a),
        catalog_b: Arc::clone(&session_data.columns_b),
        config: config.clone(),
        results: session_data.comparison_results.clone(),
    })
}

pub fn serialize_comparison_snapshot(
    inputs: &ComparisonSnapshotInputs,
) -> Result<String, CsvAlignError> {
    let contents = serialize_snapshot_v1(
        &inputs.csv_a,
        &inputs.csv_b,
        &inputs.catalog_a,
        &inputs.catalog_b,
        &inputs.config,
        &inputs.results,
    )
    .map_err(|error| {
        CsvAlignError::Internal(format!("Failed to serialize comparison snapshot: {error}"))
    })?;
    ensure_snapshot_size(contents.len())?;
    Ok(contents)
}

pub fn save_comparison_snapshot_workflow(
    session_data: &SessionData,
) -> Result<String, CsvAlignError> {
    serialize_comparison_snapshot(&snapshot_inputs_from_session(session_data)?)
}

/// A parsed and fully validated snapshot, ready to apply to a session under a
/// short lock. Parsing and validation are the expensive part of a load and do
/// not need session access.
pub struct PreparedComparisonSnapshotLoad {
    prepared: PreparedSnapshotV1,
}

pub fn prepare_comparison_snapshot_load(
    contents: &str,
) -> Result<PreparedComparisonSnapshotLoad, CsvAlignError> {
    prepare_comparison_snapshot_load_bytes(contents.as_bytes())
}

pub fn prepare_comparison_snapshot_load_bytes(
    contents: &[u8],
) -> Result<PreparedComparisonSnapshotLoad, CsvAlignError> {
    let snapshot = deserialize_snapshot(contents)?;
    let prepared = snapshot.into_prepared_load()?;

    Ok(PreparedComparisonSnapshotLoad { prepared })
}

impl PreparedComparisonSnapshotLoad {
    pub fn apply(
        self,
        session_data: &mut SessionData,
    ) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
        Ok(self.prepared.apply(session_data))
    }
}

pub fn load_comparison_snapshot_workflow(
    session_data: &mut SessionData,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    prepare_comparison_snapshot_load(contents)?.apply(session_data)
}
