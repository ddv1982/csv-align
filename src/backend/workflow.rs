use std::borrow::Borrow;
use std::path::Path;
use std::sync::Arc;

use super::comparison_snapshot::{
    PreparedComparisonSnapshotLoad, prepare_comparison_snapshot_load,
    serialize_comparison_snapshot, snapshot_inputs_from_session,
};
use super::limits::{
    MAX_COMPARISON_RESULTS_BYTES, MAX_CSV_FILE_BYTES, MAX_RETAINED_CSV_BYTES,
    MAX_RETAINED_SESSION_BYTES,
};
use super::operation::{OperationKind, OperationToken};
use super::pair_order::{load_pair_order_workflow, save_pair_order_workflow};
use super::store::SessionStore;
use crate::backend::error::CsvAlignError;
use crate::backend::requests::{
    CompareExecution, CompareRequest, CompareValidationError, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, PairOrderSelection, SuggestMappingsRequest,
};
use crate::backend::session::{
    SessionData, ensure_comparison_results_size_limit, ensure_session_size_limit,
    ensure_session_size_limit_with_limit,
};
use crate::backend::validation::build_comparison_config;
use crate::comparison::engine::{FlexibleKeyExcess, FlexibleKeyLimits};
use crate::comparison::{engine, mapping};
use crate::data::{
    csv_loader, export as csv_export,
    types::{ColumnCatalog, ComparisonConfig, CsvData, FileSide, RowComparisonResult},
};
use crate::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse, compare_response,
    file_load_response, suggest_mappings_response,
};

pub enum CsvLoadSource {
    FilePath(String),
    Bytes(Vec<u8>),
}

#[derive(Debug)]
pub struct LoadedCsv {
    pub csv_data: CsvData,
    pub catalog: Arc<ColumnCatalog>,
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
            csv_loader::load_csv(&file_path)
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

    build_loaded_csv(file_side, response_file_name, csv_data)
}

/// Compute the response metadata (virtual headers, column types) for a CSV
/// exactly once; `LoadedCsv` carries it so applying the file to a session does
/// not repeat the discovery scans.
fn build_loaded_csv(
    file_side: FileSide,
    file_name: String,
    csv_data: CsvData,
) -> Result<LoadedCsv, CsvAlignError> {
    let retained_csv_bytes = csv_data.retained_size_bytes();
    if retained_csv_bytes > MAX_RETAINED_CSV_BYTES {
        tracing::warn!(
            limit_name = "retained CSV allocation bytes",
            actual = retained_csv_bytes,
            limit = MAX_RETAINED_CSV_BYTES,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Retained CSV allocation exceeds the {} byte limit",
            MAX_RETAINED_CSV_BYTES
        )));
    }

    let headers = csv_data.headers.clone();
    let catalog = Arc::new(
        csv_loader::detect_column_catalog(&csv_data).map_err(|error| {
            CsvAlignError::BadInput(format!("Failed to discover CSV columns: {error}"))
        })?,
    );
    let row_count = csv_data.rows.len();
    let response = file_load_response(
        file_side,
        file_name,
        headers,
        catalog.virtual_headers().to_vec(),
        &catalog,
        row_count,
    );

    Ok(LoadedCsv {
        csv_data,
        catalog,
        response,
    })
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
) -> Result<FileLoadResponse, CsvAlignError> {
    let file_name = csv_data
        .file_path
        .as_deref()
        .and_then(base_file_name)
        .unwrap_or_default();
    let loaded = build_loaded_csv(file_letter, file_name, csv_data)?;

    apply_loaded_csv_to_session(session_data, file_letter, loaded)
}

pub fn begin_file_load_for_session(
    store: &SessionStore,
    session_id: &str,
    file_letter: FileSide,
) -> Result<OperationToken, CsvAlignError> {
    let kind = match file_letter {
        FileSide::A => OperationKind::FileA,
        FileSide::B => OperationKind::FileB,
    };
    store
        .begin_operation(session_id, kind, |_| Ok(()))
        .map(|(token, ())| token)
}

pub fn commit_file_load_for_session(
    store: &SessionStore,
    session_id: &str,
    token: OperationToken,
    file_letter: FileSide,
    loaded: LoadedCsv,
) -> Result<FileLoadResponse, CsvAlignError> {
    store.commit_operation(session_id, token, |session_data| {
        apply_loaded_csv_to_session(session_data, file_letter, loaded)
    })
}

fn apply_loaded_csv_to_session(
    session_data: &mut SessionData,
    file_letter: FileSide,
    loaded: LoadedCsv,
) -> Result<FileLoadResponse, CsvAlignError> {
    let LoadedCsv {
        csv_data,
        catalog,
        response,
    } = loaded;
    let csv_data = Arc::new(csv_data);

    let (csv_a, csv_b, columns_a, columns_b) = match file_letter {
        FileSide::A => (
            Some(csv_data),
            session_data.csv_b.clone(),
            catalog,
            Arc::clone(&session_data.columns_b),
        ),
        FileSide::B => (
            session_data.csv_a.clone(),
            Some(csv_data),
            Arc::clone(&session_data.columns_a),
            catalog,
        ),
    };

    let mut prospective = SessionData {
        csv_a,
        csv_b,
        columns_a,
        columns_b,
        column_mappings: Vec::new(),
        comparison_results: Vec::new(),
        comparison_config: None,
        data_revision: session_data.data_revision.wrapping_add(1),
    };

    if prospective.csv_a.is_some() && prospective.csv_b.is_some() {
        let col_names_a: Vec<String> = prospective
            .columns_a
            .iter()
            .map(|column| column.name.clone())
            .collect();
        let col_names_b: Vec<String> = prospective
            .columns_b
            .iter()
            .map(|column| column.name.clone())
            .collect();
        prospective.column_mappings = mapping::suggest_mappings_with_data(
            &col_names_a,
            &col_names_b,
            prospective.csv_a.as_deref(),
            prospective.csv_b.as_deref(),
        );
    }

    prospective.ensure_retained_size_limit()?;
    *session_data = prospective;

    Ok(response)
}

pub fn suggest_mappings_workflow(
    session_data: Option<&mut SessionData>,
    request: &SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
    suggest_mappings_workflow_with_limit(session_data, request, MAX_RETAINED_SESSION_BYTES)
}

fn suggest_mappings_workflow_with_limit(
    session_data: Option<&mut SessionData>,
    request: &SuggestMappingsRequest,
    session_limit: usize,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
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
        let previous_mappings = std::mem::replace(&mut session_data.column_mappings, mappings);
        if let Err(error) =
            ensure_session_size_limit_with_limit(session_data.retained_size_bytes(), session_limit)
        {
            session_data.column_mappings = previous_mappings;
            return Err(error);
        }
    }

    Ok(response)
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
        .ok_or_else(session_not_found)?
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
    let catalog_a = csv_loader::detect_column_catalog(csv_a).map_err(|error| {
        CsvAlignError::BadInput(format!("Failed to discover File A columns: {error}"))
    })?;
    let catalog_b = csv_loader::detect_column_catalog(csv_b).map_err(|error| {
        CsvAlignError::BadInput(format!("Failed to discover File B columns: {error}"))
    })?;

    run_comparison_with_catalogs(csv_a, csv_b, &catalog_a, &catalog_b, request)
}

fn run_comparison_with_catalogs(
    csv_a: &CsvData,
    csv_b: &CsvData,
    catalog_a: &ColumnCatalog,
    catalog_b: &ColumnCatalog,
    request: CompareRequest,
) -> Result<CompareExecution, CsvAlignError> {
    let config = build_comparison_config(catalog_a, catalog_b, request)?;
    run_comparison_with_config(csv_a, csv_b, config)
}

fn run_comparison_with_config(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: ComparisonConfig,
) -> Result<CompareExecution, CsvAlignError> {
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

    let results = plan
        .execute_bounded(csv_a, csv_b, &config, MAX_COMPARISON_RESULTS_BYTES)
        .map_err(|error| {
            CsvAlignError::BadInput(format!(
                "Comparison results retained allocation {} exceeds the {} byte limit",
                error.retained_bytes, error.limit
            ))
        })?;
    ensure_comparison_results_size_limit(&results, results.capacity())?;
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
    catalog_a: &Arc<ColumnCatalog>,
    catalog_b: &Arc<ColumnCatalog>,
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

    ensure_comparison_results_size_limit(&execution.results, execution.results.capacity())?;
    let prospective = SessionData {
        csv_a: Some(Arc::clone(csv_a)),
        csv_b: Some(Arc::clone(csv_b)),
        columns_a: Arc::clone(catalog_a),
        columns_b: Arc::clone(catalog_b),
        column_mappings: session_data.column_mappings.clone(),
        comparison_results: execution.results,
        comparison_config: Some(execution.config),
        data_revision: session_data.data_revision,
    };
    ensure_session_size_limit(prospective.retained_size_bytes())?;
    *session_data = prospective;
    Ok(())
}

pub struct PendingComparison {
    token: OperationToken,
    csv_a: Arc<CsvData>,
    csv_b: Arc<CsvData>,
    catalog_a: Arc<ColumnCatalog>,
    catalog_b: Arc<ColumnCatalog>,
    input_revision: u64,
    config: ComparisonConfig,
}

pub fn begin_comparison_for_session(
    store: &SessionStore,
    session_id: &str,
    request: CompareRequest,
) -> Result<PendingComparison, CsvAlignError> {
    let (token, (csv_a, csv_b, catalog_a, catalog_b, input_revision, config)) = store
        .begin_operation(session_id, OperationKind::Compare, |session_data| {
            let (csv_a, csv_b) = comparison_inputs(session_data)?;
            let catalog_a = if session_data.columns_a.is_empty() {
                Arc::new(csv_loader::detect_column_catalog(&csv_a).map_err(|error| {
                    CsvAlignError::BadInput(format!("Failed to discover File A columns: {error}"))
                })?)
            } else {
                Arc::clone(&session_data.columns_a)
            };
            let catalog_b = if session_data.columns_b.is_empty() {
                Arc::new(csv_loader::detect_column_catalog(&csv_b).map_err(|error| {
                    CsvAlignError::BadInput(format!("Failed to discover File B columns: {error}"))
                })?)
            } else {
                Arc::clone(&session_data.columns_b)
            };
            let config = build_comparison_config(&catalog_a, &catalog_b, request)?;
            Ok((
                csv_a,
                csv_b,
                catalog_a,
                catalog_b,
                session_data.data_revision,
                config,
            ))
        })?;

    Ok(PendingComparison {
        token,
        csv_a,
        csv_b,
        catalog_a,
        catalog_b,
        input_revision,
        config,
    })
}

pub fn execute_comparison_for_session(
    pending: &PendingComparison,
) -> Result<CompareExecution, CsvAlignError> {
    run_comparison_with_config(
        pending.csv_a.as_ref(),
        pending.csv_b.as_ref(),
        pending.config.clone(),
    )
}

pub fn commit_comparison_for_session(
    store: &SessionStore,
    session_id: &str,
    pending: PendingComparison,
    execution: CompareExecution,
) -> Result<CompareResponse, CsvAlignError> {
    let response = execution.response.clone();
    store.commit_operation(session_id, pending.token, |session_data| {
        write_comparison_if_inputs_current(
            session_data,
            &pending.csv_a,
            &pending.csv_b,
            &pending.catalog_a,
            &pending.catalog_b,
            pending.input_revision,
            execution,
        )
    })?;
    Ok(response)
}

pub fn run_comparison_for_session(
    store: &SessionStore,
    session_id: &str,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    let pending = begin_comparison_for_session(store, session_id, request)?;
    let execution = execute_comparison_for_session(&pending)?;
    commit_comparison_for_session(store, session_id, pending, execution)
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

pub fn write_export_results_for_session(
    store: &SessionStore,
    session_id: &str,
    output_path: impl AsRef<Path>,
) -> Result<(), CsvAlignError> {
    let (results, comparison_config) = store
        .with_session(session_id, export_session_results_snapshot)
        .ok_or_else(session_not_found)??;

    write_export_results(&results, comparison_config.as_ref(), output_path)
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

pub fn begin_comparison_snapshot_load_for_session(
    store: &SessionStore,
    session_id: &str,
) -> Result<OperationToken, CsvAlignError> {
    store
        .begin_operation(session_id, OperationKind::SnapshotRestore, |_| Ok(()))
        .map(|(token, ())| token)
}

pub fn commit_comparison_snapshot_load_for_session(
    store: &SessionStore,
    session_id: &str,
    token: OperationToken,
    prepared: PreparedComparisonSnapshotLoad,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    store.commit_operation(session_id, token, |session_data| {
        prepared.apply(session_data)
    })
}

pub fn load_comparison_snapshot_for_session(
    store: &SessionStore,
    session_id: &str,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let token = begin_comparison_snapshot_load_for_session(store, session_id)?;
    let prepared = prepare_comparison_snapshot_load(contents)?;
    commit_comparison_snapshot_load_for_session(store, session_id, token, prepared)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::requests::MappingRequest;
    use crate::data::csv_loader;
    use crate::data::types::{ColumnMapping, ComparisonNormalizationConfig, MappingType};

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
        )
        .unwrap();
        apply_csv_to_session(
            &mut session,
            FileSide::B,
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        )
        .unwrap();

        let (csv_a, csv_b) = comparison_inputs(&session).unwrap();
        let input_revision = session.data_revision;
        let execution = run_comparison(csv_a.as_ref(), csv_b.as_ref(), compare_request()).unwrap();

        apply_csv_to_session(
            &mut session,
            FileSide::A,
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alicia\n").unwrap(),
        )
        .unwrap();
        let catalog_a = Arc::clone(&session.columns_a);
        let catalog_b = Arc::clone(&session.columns_b);

        let error = write_comparison_if_inputs_current(
            &mut session,
            &csv_a,
            &csv_b,
            &catalog_a,
            &catalog_b,
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

    #[test]
    fn mapping_limit_failure_preserves_previous_mappings() {
        let mut session = SessionData::new();
        session.column_mappings = vec![ColumnMapping {
            file_a_column: "previous_a".to_string(),
            file_b_column: "previous_b".to_string(),
            mapping_type: MappingType::ManualMatch,
        }];
        let request = SuggestMappingsRequest {
            columns_a: vec!["id".to_string()],
            columns_b: vec!["id".to_string()],
        };

        let error = suggest_mappings_workflow_with_limit(Some(&mut session), &request, 0)
            .expect_err("zero retained-session limit should reject the suggestion");

        assert!(error.to_string().contains("Retained session allocation"));
        assert_eq!(session.column_mappings.len(), 1);
        assert_eq!(session.column_mappings[0].file_a_column, "previous_a");
        assert_eq!(session.column_mappings[0].file_b_column, "previous_b");
    }
}
