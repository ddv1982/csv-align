use std::borrow::Borrow;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

use super::comparison_snapshot::{
    prepare_comparison_snapshot_load, serialize_comparison_snapshot, snapshot_inputs_from_session,
};
use super::pair_order::{load_pair_order_workflow, save_pair_order_workflow};
use super::store::SessionStore;
use crate::backend::error::CsvAlignError;
use crate::backend::requests::{
    CompareExecution, CompareRequest, CompareValidationError, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, PairOrderSelection, SuggestMappingsRequest,
};
use crate::backend::session::SessionData;
use crate::backend::validation::build_comparison_config;
use crate::comparison::engine::{FlexibleKeyExcess, FlexibleKeyLimits};
use crate::comparison::{engine, mapping};
use crate::data::{
    csv_loader, export as csv_export,
    json_fields::discover_virtual_headers,
    types::{ColumnInfo, ComparisonConfig, CsvData, FileSide, RowComparisonResult},
};
use crate::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse, compare_response,
    file_load_response, suggest_mappings_response,
};

pub const MAX_CSV_FILE_BYTES: usize = 25 * 1024 * 1024;

pub enum CsvLoadSource {
    FilePath(String),
    Bytes(Vec<u8>),
}

#[derive(Debug)]
pub struct LoadedCsv {
    pub csv_data: CsvData,
    pub columns: Vec<ColumnInfo>,
    pub response: FileLoadResponse,
}

fn session_not_found() -> CsvAlignError {
    CsvAlignError::NotFound {
        resource: "Session".to_string(),
    }
}

fn base_file_name(value: &str) -> Option<String> {
    Path::new(value)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
}

fn file_name_from_source(file_name: Option<&str>, source: &CsvLoadSource) -> String {
    if let Some(name) = file_name.map(str::trim).filter(|value| !value.is_empty()) {
        return base_file_name(name).unwrap_or_else(|| name.to_owned());
    }

    match source {
        CsvLoadSource::FilePath(file_path) => {
            base_file_name(file_path).unwrap_or_else(|| file_path.clone())
        }
        CsvLoadSource::Bytes(_) => String::new(),
    }
}

pub fn validate_file_letter(file_letter: &str) -> Result<(), CsvAlignError> {
    parse_file_side(file_letter).map(|_| ())
}

pub fn parse_file_side(file_letter: &str) -> Result<FileSide, CsvAlignError> {
    match file_letter {
        "a" => Ok(FileSide::A),
        "b" => Ok(FileSide::B),
        _ => Err(CsvAlignError::BadInput(
            "File letter must be 'a' or 'b'".to_string(),
        )),
    }
}

pub fn load_csv_workflow(
    file_letter: &str,
    file_name: Option<String>,
    source: CsvLoadSource,
) -> Result<LoadedCsv, CsvAlignError> {
    let file_side = parse_file_side(file_letter)?;
    let response_file_name = file_name_from_source(file_name.as_deref(), &source);

    let mut csv_data = match source {
        CsvLoadSource::FilePath(file_path) => {
            validate_file_size(std::fs::metadata(&file_path).map(|metadata| metadata.len()))?;
            let mut file = std::fs::File::open(&file_path).map_err(|error| {
                CsvAlignError::Io(std::io::Error::new(
                    error.kind(),
                    format!("Failed to load CSV: {error}"),
                ))
            })?;
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes).map_err(|error| {
                CsvAlignError::Io(std::io::Error::new(
                    error.kind(),
                    format!("Failed to load CSV: {error}"),
                ))
            })?;
            csv_loader::load_csv_from_bytes(&bytes)
                .map_err(|error| CsvAlignError::Parse(format!("Failed to load CSV: {error}")))?
        }
        CsvLoadSource::Bytes(bytes) => {
            validate_file_size(Ok(bytes.len() as u64))?;
            csv_loader::load_csv_from_bytes(&bytes).map_err(|error| {
                CsvAlignError::Parse(format!("Failed to parse CSV bytes: {error}"))
            })?
        }
    };

    if let Some(file_name) = file_name.filter(|value| !value.trim().is_empty()) {
        csv_data.file_path = Some(file_name);
    }

    if csv_data.headers.is_empty() && csv_data.rows.is_empty() {
        return Err(CsvAlignError::BadInput("CSV file is empty".to_string()));
    }

    Ok(build_loaded_csv(file_side, response_file_name, csv_data))
}

/// Compute the response metadata (virtual headers, column types) for a CSV
/// exactly once; `LoadedCsv` carries it so applying the file to a session does
/// not repeat the discovery scans.
fn build_loaded_csv(file_side: FileSide, file_name: String, csv_data: CsvData) -> LoadedCsv {
    let headers = csv_data.headers.clone();
    let virtual_headers = discover_virtual_headers(&csv_data);
    let columns = csv_loader::detect_columns(&csv_data);
    let row_count = csv_data.rows.len();
    let response = file_load_response(
        file_side,
        file_name,
        headers,
        virtual_headers,
        &columns,
        row_count,
    );

    LoadedCsv {
        csv_data,
        columns,
        response,
    }
}

fn validate_file_size(size: std::io::Result<u64>) -> Result<(), CsvAlignError> {
    let size = size.map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to inspect CSV file: {error}"),
        ))
    })?;

    if size as usize > MAX_CSV_FILE_BYTES {
        return Err(CsvAlignError::BadInput(format!(
            "CSV file is too large; maximum supported size is {} MiB",
            MAX_CSV_FILE_BYTES / 1024 / 1024
        )));
    }

    Ok(())
}

pub fn apply_csv_to_session(
    session_data: &mut SessionData,
    file_letter: FileSide,
    csv_data: CsvData,
) -> FileLoadResponse {
    let file_name = csv_data
        .file_path
        .as_deref()
        .and_then(base_file_name)
        .unwrap_or_default();
    let loaded = build_loaded_csv(file_letter, file_name, csv_data);

    apply_loaded_csv_to_session(session_data, file_letter, loaded)
}

pub fn apply_loaded_csv_for_session(
    store: &SessionStore,
    session_id: &str,
    file_letter: FileSide,
    loaded: LoadedCsv,
) -> Result<FileLoadResponse, CsvAlignError> {
    store
        .with_session_mut(session_id, |session_data| {
            apply_loaded_csv_to_session(session_data, file_letter, loaded)
        })
        .ok_or_else(session_not_found)
}

fn apply_loaded_csv_to_session(
    session_data: &mut SessionData,
    file_letter: FileSide,
    loaded: LoadedCsv,
) -> FileLoadResponse {
    session_data.advance_data_revision();
    let LoadedCsv {
        csv_data,
        columns,
        response,
    } = loaded;

    store_csv_in_session(session_data, file_letter, csv_data, columns);

    response
}

fn store_csv_in_session(
    session_data: &mut SessionData,
    file_letter: FileSide,
    csv_data: CsvData,
    columns: Vec<ColumnInfo>,
) {
    if file_letter == FileSide::A {
        session_data.csv_a = Some(Arc::new(csv_data));
        session_data.columns_a = columns;
    } else {
        session_data.csv_b = Some(Arc::new(csv_data));
        session_data.columns_b = columns;
    }

    session_data.comparison_results.clear();
    session_data.comparison_config = None;

    if session_data.csv_a.is_some() && session_data.csv_b.is_some() {
        let col_names_a: Vec<String> = session_data
            .columns_a
            .iter()
            .map(|c| c.name.clone())
            .collect();
        let col_names_b: Vec<String> = session_data
            .columns_b
            .iter()
            .map(|c| c.name.clone())
            .collect();
        session_data.column_mappings = mapping::suggest_mappings_with_data(
            &col_names_a,
            &col_names_b,
            session_data.csv_a.as_deref(),
            session_data.csv_b.as_deref(),
        );
    }
}

pub fn suggest_mappings_workflow(
    session_data: Option<&mut SessionData>,
    request: &SuggestMappingsRequest,
) -> SuggestMappingsResponse {
    let mappings = match session_data.as_deref() {
        Some(session_data) => mapping::suggest_mappings_with_data(
            &request.columns_a,
            &request.columns_b,
            session_data.csv_a.as_deref(),
            session_data.csv_b.as_deref(),
        ),
        None => mapping::suggest_mappings(&request.columns_a, &request.columns_b),
    };
    let response = suggest_mappings_response(&mappings);

    if let Some(session_data) = session_data {
        session_data.column_mappings = mappings;
    }

    response
}

pub fn suggest_mappings_for_session(
    store: &SessionStore,
    session_id: &str,
    request: &SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
    store
        .with_session_mut(session_id, |session_data| {
            suggest_mappings_workflow(Some(session_data), request)
        })
        .ok_or_else(session_not_found)
}

pub fn comparison_inputs(
    session_data: &SessionData,
) -> Result<(Arc<CsvData>, Arc<CsvData>), CsvAlignError> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File A not selected or loaded".to_string()))?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File B not selected or loaded".to_string()))?;

    Ok((Arc::clone(csv_a), Arc::clone(csv_b)))
}

pub fn run_comparison(
    csv_a: impl Borrow<CsvData>,
    csv_b: impl Borrow<CsvData>,
    request: CompareRequest,
) -> Result<CompareExecution, CsvAlignError> {
    let csv_a = csv_a.borrow();
    let csv_b = csv_b.borrow();
    let config = build_comparison_config(csv_a, csv_b, request)?;
    let plan = engine::ComparisonPlan::build(csv_a, csv_b, &config, FlexibleKeyLimits::DEFAULT)
        .map_err(|error| CsvAlignError::Internal(format!("Comparison setup failed: {error}")))?;

    match plan.flexible_excess() {
        Some(FlexibleKeyExcess::Comparisons(comparison_count)) => {
            return Err(CompareValidationError::TooManyFlexibleKeyComparisons {
                comparison_count,
                limit: engine::MAX_FLEXIBLE_KEY_COMPARISONS,
            }
            .into());
        }
        Some(FlexibleKeyExcess::Candidates(candidate_count)) => {
            return Err(CompareValidationError::TooManyFlexibleKeyCandidates {
                candidate_count,
                limit: engine::MAX_FLEXIBLE_KEY_CANDIDATES,
            }
            .into());
        }
        None => {}
    }

    let results = plan.execute(csv_a, csv_b, &config);
    let summary = engine::generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());

    Ok(CompareExecution {
        response: compare_response(&results, &summary),
        results,
        config,
    })
}

fn write_comparison_if_inputs_current(
    session_data: &mut SessionData,
    csv_a: &Arc<CsvData>,
    csv_b: &Arc<CsvData>,
    input_revision: u64,
    execution: CompareExecution,
) -> Result<(), CsvAlignError> {
    let inputs_changed = session_data.data_revision != input_revision
        || !session_data
            .csv_a
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, csv_a))
        || !session_data
            .csv_b
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, csv_b));

    if inputs_changed {
        return Err(CsvAlignError::BadInput(
            "Comparison inputs changed before results could be stored. Run the comparison again."
                .to_string(),
        ));
    }

    session_data.comparison_results = execution.results;
    session_data.comparison_config = Some(execution.config);
    Ok(())
}

pub fn run_comparison_for_session(
    store: &SessionStore,
    session_id: &str,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    let (csv_a, csv_b, input_revision) = store
        .with_session(session_id, |session_data| {
            let (csv_a, csv_b) = comparison_inputs(session_data)?;
            Ok::<_, CsvAlignError>((csv_a, csv_b, session_data.data_revision))
        })
        .ok_or_else(session_not_found)??;

    let execution = run_comparison(csv_a.as_ref(), csv_b.as_ref(), request)?;
    let response = execution.response.clone();

    store
        .with_session_mut(session_id, |session_data| {
            write_comparison_if_inputs_current(
                session_data,
                &csv_a,
                &csv_b,
                input_revision,
                execution,
            )
        })
        .ok_or_else(session_not_found)??;

    Ok(response)
}

pub fn export_session_results_snapshot(
    session_data: &SessionData,
) -> Result<(Vec<RowComparisonResult>, Option<ComparisonConfig>), CsvAlignError> {
    if session_data.comparison_config.is_none() {
        return Err(CsvAlignError::BadInput(
            "No comparison results to export. Run a comparison first.".to_string(),
        ));
    }

    Ok((
        session_data.comparison_results.clone(),
        session_data.comparison_config.clone(),
    ))
}

pub fn export_results_to_bytes(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
) -> Result<Vec<u8>, CsvAlignError> {
    csv_export::export_results_to_bytes(results, comparison_config)
        .map_err(|error| CsvAlignError::Internal(format!("Failed to build CSV export: {error}")))
}

pub fn write_export_results(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
    output_path: impl AsRef<Path>,
) -> Result<(), CsvAlignError> {
    csv_export::write_export_results(results, comparison_config, output_path)
        .map_err(|error| CsvAlignError::Internal(format!("Failed to export results: {error}")))
}

pub fn export_results_for_session(
    store: &SessionStore,
    session_id: &str,
) -> Result<Vec<u8>, CsvAlignError> {
    let (results, comparison_config) = store
        .with_session(session_id, export_session_results_snapshot)
        .ok_or_else(session_not_found)??;

    export_results_to_bytes(&results, comparison_config.as_ref())
}

pub fn save_pair_order_for_session(
    store: &SessionStore,
    session_id: &str,
    selection: PairOrderSelection,
) -> Result<String, CsvAlignError> {
    store
        .with_session(session_id, |session_data| {
            save_pair_order_workflow(session_data, selection)
        })
        .ok_or_else(session_not_found)?
}

pub fn load_pair_order_for_session(
    store: &SessionStore,
    session_id: &str,
    contents: &str,
) -> Result<LoadPairOrderResponse, CsvAlignError> {
    store
        .with_session(session_id, |session_data| {
            load_pair_order_workflow(session_data, contents)
        })
        .ok_or_else(session_not_found)?
}

pub fn save_comparison_snapshot_for_session(
    store: &SessionStore,
    session_id: &str,
) -> Result<String, CsvAlignError> {
    // Clone the Arc-backed inputs under the lock; serialize outside it so a
    // large snapshot cannot stall unrelated sessions.
    let inputs = store
        .with_session(session_id, snapshot_inputs_from_session)
        .ok_or_else(session_not_found)??;

    serialize_comparison_snapshot(&inputs)
}

pub fn load_comparison_snapshot_for_session(
    store: &SessionStore,
    session_id: &str,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    // Parse and validate outside the lock; only applying the loaded snapshot
    // to the session needs exclusive access.
    let prepared = prepare_comparison_snapshot_load(contents)?;

    store
        .with_session_mut(session_id, |session_data| prepared.apply(session_data))
        .ok_or_else(session_not_found)?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::requests::MappingRequest;
    use crate::data::csv_loader;
    use crate::data::types::ComparisonNormalizationConfig;

    fn compare_request() -> CompareRequest {
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        }
    }

    #[test]
    fn stale_comparison_writeback_is_rejected_after_file_replacement() {
        let mut session = SessionData::new();
        apply_csv_to_session(
            &mut session,
            FileSide::A,
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        );
        apply_csv_to_session(
            &mut session,
            FileSide::B,
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        );

        let (csv_a, csv_b) = comparison_inputs(&session).unwrap();
        let input_revision = session.data_revision;
        let execution = run_comparison(csv_a.as_ref(), csv_b.as_ref(), compare_request()).unwrap();

        apply_csv_to_session(
            &mut session,
            FileSide::A,
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alicia\n").unwrap(),
        );

        let error = write_comparison_if_inputs_current(
            &mut session,
            &csv_a,
            &csv_b,
            input_revision,
            execution,
        )
        .unwrap_err();

        assert!(matches!(error, CsvAlignError::BadInput(_)));
        assert_eq!(
            error.to_string(),
            "Comparison inputs changed before results could be stored. Run the comparison again."
        );
        assert!(session.comparison_results.is_empty());
        assert!(session.comparison_config.is_none());
    }
}
