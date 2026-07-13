use std::sync::Arc;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use tauri_plugin_dialog::{DialogExt, FilePath};
use tracing::instrument;

use csv_align::backend::limits::{MAX_HTML_EXPORT_DOCUMENT_BYTES, MAX_SNAPSHOT_BYTES};
use csv_align::backend::{
    CompareRequest, CsvAlignError, CsvLoadSource, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, OperationToken, PairOrderSelection, SessionResponse, SessionStore,
    SuggestMappingsRequest, begin_comparison_for_session,
    begin_comparison_snapshot_load_for_session, begin_file_load_for_session,
    commit_comparison_for_session, commit_comparison_snapshot_load_for_session,
    commit_file_load_for_session, ensure_snapshot_size, execute_comparison_for_session,
    load_csv_workflow, load_pair_order_for_session, parse_file_side,
    prepare_comparison_snapshot_load_bytes, save_comparison_snapshot_for_session,
    save_pair_order_for_session, suggest_mappings_for_session, validate_file_letter,
    write_export_results_for_session,
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

pub(crate) async fn run_blocking<T>(
    task: impl FnOnce() -> Result<T, CsvAlignError> + Send + 'static,
) -> Result<T, CsvAlignError>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| CsvAlignError::Internal(format!("Blocking task failed: {error}")))?
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
    write_export_results_for_session(state, session_id, output_path)
}

pub(crate) fn validate_html_export_document(html_contents: &str) -> Result<(), CsvAlignError> {
    let byte_length = html_contents.len();
    if byte_length > MAX_HTML_EXPORT_DOCUMENT_BYTES {
        return Err(CsvAlignError::BadInput(format!(
            "HTML export document exceeds the {} MiB limit ({byte_length} UTF-8 bytes). Use CSV export or reduce the result set.",
            MAX_HTML_EXPORT_DOCUMENT_BYTES / 1024 / 1024
        )));
    }

    Ok(())
}

pub(crate) fn export_results_html_to_path(
    output_path: &Path,
    html_contents: &str,
) -> Result<(), CsvAlignError> {
    validate_html_export_document(html_contents)?;
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

pub(crate) fn begin_comparison_snapshot_before_selection(
    state: &SessionStore,
    session_id: &str,
    select_file: impl FnOnce() -> Result<Option<PathBuf>, CsvAlignError>,
) -> Result<Option<(OperationToken, PathBuf)>, CsvAlignError> {
    let token = begin_comparison_snapshot_load_for_session(state, session_id)?;
    Ok(select_file()?.map(|file_path| (token, file_path)))
}

#[cfg(test)]
pub(crate) fn load_comparison_snapshot_from_path(
    state: &SessionStore,
    session_id: &str,
    file_path: &Path,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let selection = begin_comparison_snapshot_before_selection(state, session_id, || {
        Ok(Some(file_path.to_path_buf()))
    })?
    .expect("the test path is always selected");
    load_claimed_comparison_snapshot_from_path(state, session_id, selection.0, &selection.1)
}

fn load_claimed_comparison_snapshot_from_path(
    state: &SessionStore,
    session_id: &str,
    token: OperationToken,
    file_path: &Path,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let contents = read_comparison_snapshot_file(file_path)?;
    let prepared = prepare_comparison_snapshot_load_bytes(&contents)?;

    commit_comparison_snapshot_load_for_session(state, session_id, token, prepared)
}

fn snapshot_read_error(error: std::io::Error) -> CsvAlignError {
    CsvAlignError::Io(std::io::Error::new(
        error.kind(),
        format!("Failed to read comparison snapshot file: {error}"),
    ))
}

pub(crate) fn read_limited(mut reader: impl Read, limit: usize) -> Result<Vec<u8>, std::io::Error> {
    let mut contents = Vec::new();
    reader
        .by_ref()
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut contents)?;
    Ok(contents)
}

pub(crate) fn validate_snapshot_file_metadata(file: &fs::File) -> Result<(), CsvAlignError> {
    let metadata = file.metadata().map_err(snapshot_read_error)?;
    if metadata.len() > MAX_SNAPSHOT_BYTES as u64 {
        ensure_snapshot_size(MAX_SNAPSHOT_BYTES + 1)?;
    }
    Ok(())
}

pub(crate) fn read_comparison_snapshot_file(file_path: &Path) -> Result<Vec<u8>, CsvAlignError> {
    let file = fs::File::open(file_path).map_err(snapshot_read_error)?;
    validate_snapshot_file_metadata(&file)?;
    let contents = read_limited(file, MAX_SNAPSHOT_BYTES).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to read comparison snapshot file: {error}"),
        ))
    })?;
    ensure_snapshot_size(contents.len())?;
    Ok(contents)
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
pub(crate) async fn load_csv(
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_path: String,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let state = Arc::clone(state.inner());
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;
    run_blocking(move || {
        let loaded = load_csv_workflow(
            &file_letter,
            Some(file_path.clone()),
            CsvLoadSource::FilePath(file_path),
        )?;
        commit_file_load_for_session(state.as_ref(), &session_id, token, file_side, loaded)
    })
    .await
}

/// Load a CSV file from raw bytes (desktop/webview file selection)
///
/// The frontend sends the file contents as a raw IPC body with metadata in
/// request headers. Serializing 25 MiB of bytes as a JSON number array made
/// desktop uploads allocate and parse an order of magnitude more data.
#[tauri::command]
#[instrument(skip(state, request))]
pub(crate) async fn load_csv_bytes(
    state: tauri::State<'_, Arc<SessionStore>>,
    request: tauri::ipc::Request<'_>,
) -> Result<FileLoadResponse, CsvAlignError> {
    let tauri::ipc::InvokeBody::Raw(file_bytes) = request.body() else {
        return Err(CsvAlignError::BadInput(
            "CSV upload must send the file contents as a raw request body".to_string(),
        ));
    };

    let session_id = required_request_header(&request, "session-id")?;
    let file_letter = required_request_header(&request, "file-letter")?;
    let encoded_file_name = required_request_header(&request, "file-name")?;
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let state = Arc::clone(state.inner());
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;

    load_csv_bytes_async_with_claim(
        state,
        session_id,
        file_letter,
        percent_decode(&encoded_file_name),
        file_side,
        token,
        file_bytes.clone(),
    )
    .await
}

#[cfg(test)]
pub(crate) async fn load_csv_bytes_async_with_args(
    state: Arc<SessionStore>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let token = begin_file_load_for_session(state.as_ref(), &session_id, file_side)?;

    load_csv_bytes_async_with_claim(
        state,
        session_id,
        file_letter,
        file_name,
        file_side,
        token,
        file_bytes,
    )
    .await
}

async fn load_csv_bytes_async_with_claim(
    state: Arc<SessionStore>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_side: csv_align::data::types::FileSide,
    token: OperationToken,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    run_blocking(move || {
        let loaded = load_csv_workflow(
            &file_letter,
            Some(file_name),
            CsvLoadSource::Bytes(file_bytes),
        )?;
        commit_file_load_for_session(state.as_ref(), &session_id, token, file_side, loaded)
    })
    .await
}

#[cfg(test)]
pub(crate) fn load_csv_bytes_with_args(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, CsvAlignError> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;
    let token = begin_file_load_for_session(state.inner().as_ref(), &session_id, file_side)?;
    let loaded = load_csv_workflow(
        &file_letter,
        Some(file_name),
        CsvLoadSource::Bytes(file_bytes),
    )?;

    commit_file_load_for_session(
        state.inner().as_ref(),
        &session_id,
        token,
        file_side,
        loaded,
    )
}

fn required_request_header(
    request: &tauri::ipc::Request<'_>,
    name: &'static str,
) -> Result<String, CsvAlignError> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .ok_or_else(|| CsvAlignError::BadInput(format!("Missing {name} header on CSV upload")))
}

/// Decode the percent-encoded file-name header; HTTP header values are
/// ASCII-only while CSV file names are not.
pub(crate) fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        let is_escape = bytes[index] == b'%' && index + 2 < bytes.len();
        let escaped = is_escape
            .then(|| u8::from_str_radix(&value[index + 1..index + 3], 16).ok())
            .flatten();

        match escaped {
            Some(byte) => {
                decoded.push(byte);
                index += 3;
            }
            None => {
                decoded.push(bytes[index]);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&decoded).into_owned()
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
pub(crate) async fn compare(
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    let state = Arc::clone(state.inner());
    let pending = begin_comparison_for_session(state.as_ref(), &session_id, request)?;
    run_blocking(move || {
        let execution = execute_comparison_for_session(&pending)?;
        commit_comparison_for_session(state.as_ref(), &session_id, pending, execution)
    })
    .await
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

    let state = Arc::clone(state.inner());
    run_blocking(move || export_results_to_path(state.as_ref(), &session_id, &output_path)).await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, html_contents))]
pub(crate) async fn export_results_html(
    app: tauri::AppHandle,
    html_contents: String,
) -> Result<SaveDialogOutcome, CsvAlignError> {
    validate_html_export_document(&html_contents)?;

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

    run_blocking(move || export_results_html_to_path(&output_path, &html_contents)).await?;
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

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        save_pair_order_to_path(state.as_ref(), &session_id, selection, &output_path)
    })
    .await?;
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

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        load_pair_order_from_path(state.as_ref(), &session_id, &file_path).map(Some)
    })
    .await
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

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        save_comparison_snapshot_to_path(state.as_ref(), &session_id, &output_path)
    })
    .await?;
    Ok(SaveDialogOutcome::Saved)
}

#[tauri::command]
#[instrument(skip(app, state), fields(session_id = %session_id))]
pub(crate) async fn load_comparison_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<SessionStore>>,
    session_id: String,
) -> Result<Option<LoadComparisonSnapshotResponse>, CsvAlignError> {
    let Some((token, file_path)) =
        begin_comparison_snapshot_before_selection(state.inner().as_ref(), &session_id, || {
            pick_file_path(
                &app,
                "Load comparison snapshot",
                "JSON Files",
                &["json"],
                "comparison snapshot",
            )
        })?
    else {
        return Ok(None);
    };

    let state = Arc::clone(state.inner());
    run_blocking(move || {
        load_claimed_comparison_snapshot_from_path(state.as_ref(), &session_id, token, &file_path)
            .map(Some)
    })
    .await
}
