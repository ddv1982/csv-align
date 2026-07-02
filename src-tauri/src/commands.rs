use std::sync::Arc;
use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri_plugin_dialog::{DialogExt, FilePath};
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

/// Result of a save/export command that goes through a native save dialog.
///
/// `Option<()>` cannot express this over IPC: serde serializes both `Some(())`
/// and `None` to `null`, so the frontend could not tell saved from cancelled.
#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SaveDialogOutcome {
    Saved,
    Cancelled,
}

fn write_output_file(
    output_path: &Path,
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

fn selected_dialog_path(path: FilePath, file_kind: &str) -> Result<PathBuf, CsvAlignError> {
    path.into_path()
        .map_err(|error| CsvAlignError::BadInput(format!("Unsupported {file_kind} path: {error}")))
}

fn pick_file_path(
    app: &tauri::AppHandle,
    title: &str,
    filter_name: &str,
    extensions: &[&str],
    file_kind: &str,
) -> Result<Option<PathBuf>, CsvAlignError> {
    app.dialog()
        .file()
        .set_title(title)
        .add_filter(filter_name, extensions)
        .blocking_pick_file()
        .map(|path| selected_dialog_path(path, file_kind))
        .transpose()
}

fn save_file_path(
    app: &tauri::AppHandle,
    default_name: &str,
    filter_name: &str,
    extensions: &[&str],
    file_kind: &str,
) -> Result<Option<PathBuf>, CsvAlignError> {
    app.dialog()
        .file()
        .set_file_name(default_name)
        .add_filter(filter_name, extensions)
        .blocking_save_file()
        .map(|path| selected_dialog_path(path, file_kind))
        .transpose()
}

pub(crate) fn export_results_to_path(
    state: &SessionStore,
    session_id: &str,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    let csv_content = export_results_for_session(state, session_id)?;
    write_output_file(output_path, csv_content, "CSV export")
}

pub(crate) fn export_results_html_to_path(
    output_path: &Path,
    html_contents: &str,
) -> Result<(), CsvAlignError> {
    write_output_file(output_path, html_contents, "HTML export")
}

pub(crate) fn save_pair_order_to_path(
    state: &SessionStore,
    session_id: &str,
    selection: PairOrderSelection,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    let contents = save_pair_order_for_session(state, session_id, selection)?;
    write_output_file(output_path, contents, "pair-order")
}

pub(crate) fn load_pair_order_from_path(
    state: &SessionStore,
    session_id: &str,
    file_path: &Path,
) -> Result<LoadPairOrderResponse, CsvAlignError> {
    let contents = fs::read_to_string(file_path).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read pair-order file: {error}"),
        ))
    })?;

    load_pair_order_for_session(state, session_id, &contents)
}

pub(crate) fn save_comparison_snapshot_to_path(
    state: &SessionStore,
    session_id: &str,
    output_path: &Path,
) -> Result<(), CsvAlignError> {
    let contents = save_comparison_snapshot_for_session(state, session_id)?;
    write_output_file(output_path, contents, "comparison snapshot")
}

pub(crate) fn load_comparison_snapshot_from_path(
    state: &SessionStore,
    session_id: &str,
    file_path: &Path,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let contents = fs::read_to_string(file_path).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read comparison snapshot file: {error}"),
        ))
    })?;

    load_comparison_snapshot_for_session(state, session_id, &contents)
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
#[cfg(test)]
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
pub(crate) async fn export_results(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) = save_file_path(
        &app,
        "comparison-results.csv",
        "CSV Files",
        &["csv"],
        "CSV export",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    export_results_to_path(state.inner().as_ref(), &session_id, &output_path)?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, html_contents))]
pub(crate) async fn export_results_html(
    app: tauri::AppHandle,
    html_contents: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) = save_file_path(
        &app,
        "comparison-results.html",
        "HTML Files",
        &["html"],
        "HTML export",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    export_results_html_to_path(&output_path, &html_contents)?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state, selection), fields(session_id = %session_id))]
pub(crate) async fn save_pair_order(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    selection: PairOrderSelection,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) =
        save_file_path(&app, "pair-order.txt", "Text Files", &["txt"], "pair-order")?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    save_pair_order_to_path(state.inner().as_ref(), &session_id, selection, &output_path)?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn load_pair_order(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<Option<LoadPairOrderResponse>, CsvAlignError> {
    let Some(file_path) = pick_file_path(
        &app,
        "Load pair-order file",
        "Text Files",
        &["txt"],
        "pair-order",
    )?
    else {
        return Ok(None);
    };

    load_pair_order_from_path(state.inner().as_ref(), &session_id, &file_path).map(Some)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn save_comparison_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    let Some(output_path) = save_file_path(
        &app,
        "comparison-snapshot.json",
        "JSON Files",
        &["json"],
        "comparison snapshot",
    )?
    else {
        return Ok(SaveDialogOutcome::Cancelled);
    };

    save_comparison_snapshot_to_path(state.inner().as_ref(), &session_id, &output_path)?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn load_comparison_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<Option<LoadComparisonSnapshotResponse>, CsvAlignError> {
    let Some(file_path) = pick_file_path(
        &app,
        "Load comparison snapshot",
        "JSON Files",
        &["json"],
        "comparison snapshot",
    )?
    else {
        return Ok(None);
    };

    load_comparison_snapshot_from_path(state.inner().as_ref(), &session_id, &file_path).map(Some)
}
