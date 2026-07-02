use std::sync::Arc;

use crate::backend::error::CsvAlignError;
use crate::backend::persistence::v1::{SNAPSHOT_VERSION, SnapshotV1};
use crate::backend::requests::LoadComparisonSnapshotResponse;
use crate::backend::session::SessionData;
use crate::data::types::{ComparisonConfig, CsvData, RowComparisonResult};

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

/// Everything a snapshot save needs, cloned out of the session so the
/// expensive serialization can run without holding the store lock.
pub struct ComparisonSnapshotInputs {
    csv_a: Arc<CsvData>,
    csv_b: Arc<CsvData>,
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
        config: config.clone(),
        results: session_data.comparison_results.clone(),
    })
}

pub fn serialize_comparison_snapshot(
    inputs: &ComparisonSnapshotInputs,
) -> Result<String, CsvAlignError> {
    let persisted = SnapshotV1::from_comparison(
        &inputs.csv_a,
        &inputs.csv_b,
        &inputs.config,
        &inputs.results,
    );

    serde_json::to_string_pretty(&persisted).map_err(|error| {
        CsvAlignError::Internal(format!("Failed to serialize comparison snapshot: {error}"))
    })
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
    snapshot: SnapshotV1,
}

pub fn prepare_comparison_snapshot_load(
    contents: &str,
) -> Result<PreparedComparisonSnapshotLoad, CsvAlignError> {
    validate_comparison_snapshot_version(contents)?;

    let snapshot: SnapshotV1 = serde_json::from_str(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse comparison snapshot file: {error}"))
    })?;
    snapshot.validate()?;

    Ok(PreparedComparisonSnapshotLoad { snapshot })
}

impl PreparedComparisonSnapshotLoad {
    pub fn apply(
        self,
        session_data: &mut SessionData,
    ) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
        self.snapshot.to_load_response(session_data)
    }
}

pub fn load_comparison_snapshot_workflow(
    session_data: &mut SessionData,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    prepare_comparison_snapshot_load(contents)?.apply(session_data)
}
