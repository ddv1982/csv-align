use crate::backend::error::CsvAlignError;
use crate::backend::persistence::v1::{SNAPSHOT_VERSION, SnapshotV1};
use crate::backend::requests::LoadComparisonSnapshotResponse;
use crate::backend::session::SessionData;

#[derive(serde::Deserialize)]
struct SnapshotVersionProbe {
    version: u8,
}

pub fn validate_comparison_snapshot_version(contents: &str) -> Result<(), CsvAlignError> {
    let probe: SnapshotVersionProbe = serde_json::from_str(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse comparison snapshot file: {error}"))
    })?;

    if probe.version != SNAPSHOT_VERSION {
        return Err(CsvAlignError::BadInput(format!(
            "Unsupported comparison snapshot version {} — this file was produced by an older csv-align release. Re-run the comparison in v2.",
            probe.version
        )));
    }

    Ok(())
}

pub fn save_comparison_snapshot_workflow(
    session_data: &SessionData,
) -> Result<String, CsvAlignError> {
    let persisted = SnapshotV1::from_session(session_data)?;

    serde_json::to_string_pretty(&persisted).map_err(|error| {
        CsvAlignError::Internal(format!("Failed to serialize comparison snapshot: {error}"))
    })
}

pub fn load_comparison_snapshot_workflow(
    session_data: &mut SessionData,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    validate_comparison_snapshot_version(contents)?;

    let persisted: SnapshotV1 = serde_json::from_str(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse comparison snapshot file: {error}"))
    })?;

    persisted.to_load_response(session_data)
}
