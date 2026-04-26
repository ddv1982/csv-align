use std::fs;
use std::sync::Arc;

use tracing::instrument;

use csv_align::backend::{
    CompareRequest, CsvAlignError, CsvLoadSource, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, PairOrderSelection, SessionResponse, SessionStore,
    SuggestMappingsRequest, apply_loaded_csv_for_session, export_results_for_session,
    load_comparison_snapshot_for_session, load_csv_workflow, load_pair_order_for_session,
    parse_file_side, run_comparison_for_session, save_comparison_snapshot_for_session,
    save_pair_order_for_session, suggest_mappings_for_session, validate_file_letter,
};
use csv_align::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse,
};

fn write_output_file(
    output_path: &str,
    contents: impl AsRef<[u8]>,
    file_kind: &str,
) -> Result<(), CsvAlignError> {
    fs::write(output_path, contents).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to save {file_kind} file: {error}"),
        ))
    })
}

/// Create a new session
#[tauri::command]
#[instrument(skip(state))]
pub(crate) fn create_session(state: tauri::State<Arc<SessionStore>>) -> SessionResponse {
    SessionResponse {
        session_id: state.create(),
    }
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn delete_session(state: tauri::State<Arc<SessionStore>>, session_id: String) {
    state.delete(&session_id);
}

/// Load a CSV file from a local path
#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn load_csv(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_path: String,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let loaded = load_csv_workflow(
        &file_letter,
        Some(file_path.clone()),
        CsvLoadSource::FilePath(file_path),
    )?;

    apply_loaded_csv_for_session(state.inner().as_ref(), &session_id, file_side, loaded)
}

/// Load a CSV file from raw bytes (desktop/webview file selection)
#[tauri::command]
#[instrument(skip(state, file_bytes), fields(session_id = %session_id))]
pub(crate) fn load_csv_bytes(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let loaded = load_csv_workflow(
        &file_letter,
        Some(file_name),
        CsvLoadSource::Bytes(file_bytes),
    )?;

    apply_loaded_csv_for_session(state.inner().as_ref(), &session_id, file_side, loaded)
}

/// Get suggested column mappings
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) fn suggest_mappings(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    request: SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
    suggest_mappings_for_session(state.inner().as_ref(), &session_id, &request)
}

/// Run comparison
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) fn compare(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    run_comparison_for_session(state.inner().as_ref(), &session_id, request)
}

/// Export comparison results to a CSV file path
#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn export_results(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let csv_content = export_results_for_session(state.inner().as_ref(), &session_id)?;
    write_output_file(&output_path, csv_content, "CSV export")
}

#[tauri::command]
#[instrument(skip(html_contents), fields(output_path = %output_path))]
pub(crate) fn export_results_html(
    output_path: String,
    html_contents: String,
) -> Result<(), CsvAlignError> {
    write_output_file(&output_path, html_contents, "HTML export")
}

#[tauri::command]
#[instrument(skip(state, selection), fields(session_id = %session_id))]
pub(crate) fn save_pair_order(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    selection: PairOrderSelection,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let contents = save_pair_order_for_session(state.inner().as_ref(), &session_id, selection)?;

    write_output_file(&output_path, contents, "pair-order")
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn load_pair_order(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_path: String,
) -> Result<LoadPairOrderResponse, CsvAlignError> {
    let contents = fs::read_to_string(&file_path).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read pair-order file: {error}"),
        ))
    })?;

    load_pair_order_for_session(state.inner().as_ref(), &session_id, &contents)
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn save_comparison_snapshot(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let contents = save_comparison_snapshot_for_session(state.inner().as_ref(), &session_id)?;

    write_output_file(&output_path, contents, "comparison snapshot")
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn load_comparison_snapshot(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_path: String,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let contents = fs::read_to_string(&file_path).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read comparison snapshot file: {error}"),
        ))
    })?;

    load_comparison_snapshot_for_session(state.inner().as_ref(), &session_id, &contents)
}
