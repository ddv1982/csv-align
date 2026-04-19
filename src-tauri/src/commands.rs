use std::fs;
use std::sync::Arc;

use tracing::instrument;

use csv_align::backend::{
    CompareRequest, CsvAlignError, CsvLoadSource, LoadComparisonSnapshotResponse,
    LoadPairOrderResponse, PairOrderSelection, SessionResponse, SessionStore,
    SuggestMappingsRequest, apply_csv_to_session, comparison_inputs,
    export_session_results_snapshot, load_comparison_snapshot_workflow, load_csv_workflow,
    load_pair_order_workflow, parse_file_side, run_comparison, save_comparison_snapshot_workflow,
    save_pair_order_workflow, suggest_mappings_workflow, validate_file_letter,
    write_export_results,
};
use csv_align::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse,
};

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

    state
        .with_session_mut(&session_id, |session_data| {
            apply_csv_to_session(session_data, file_side, loaded.csv_data)
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })
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

    state
        .with_session_mut(&session_id, |session_data| {
            apply_csv_to_session(session_data, file_side, loaded.csv_data)
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })
}

/// Get suggested column mappings
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) fn suggest_mappings(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    request: SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, CsvAlignError> {
    Ok(state
        .with_session_mut(&session_id, |session_data| {
            suggest_mappings_workflow(Some(session_data), &request)
        })
        .unwrap_or_else(|| suggest_mappings_workflow(None, &request)))
}

/// Run comparison
#[tauri::command]
#[instrument(skip(state, request), fields(session_id = %session_id))]
pub(crate) fn compare(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, CsvAlignError> {
    let (csv_a, csv_b) = state
        .with_session(&session_id, comparison_inputs)
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })??;

    let execution = run_comparison(csv_a.as_ref(), csv_b.as_ref(), request)?;

    let response = execution.response.clone();
    state
        .with_session_mut(&session_id, |session_data| {
            session_data.comparison_results = execution.results;
            session_data.comparison_config = Some(execution.config);
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })?;

    Ok(response)
}

/// Export comparison results to a CSV file path
#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn export_results(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let (results, comparison_config) = state
        .with_session(&session_id, export_session_results_snapshot)
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })??;

    write_export_results(&results, comparison_config.as_ref(), &output_path)
}

#[tauri::command]
#[instrument(skip(state, selection), fields(session_id = %session_id))]
pub(crate) fn save_pair_order(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    selection: PairOrderSelection,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let contents = state
        .with_session(&session_id, |session_data| {
            save_pair_order_workflow(session_data, selection)
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })??;

    fs::write(&output_path, contents).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to save pair-order file: {error}"),
        ))
    })
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

    state
        .with_session(&session_id, |session_data| {
            load_pair_order_workflow(session_data, &contents)
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })?
}

#[tauri::command]
#[instrument(skip(state), fields(session_id = %session_id))]
pub(crate) fn save_comparison_snapshot(
    state: tauri::State<Arc<SessionStore>>,
    session_id: String,
    output_path: String,
) -> Result<(), CsvAlignError> {
    let contents = state
        .with_session(&session_id, save_comparison_snapshot_workflow)
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })??;

    fs::write(&output_path, contents).map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to save comparison snapshot file: {error}"),
        ))
    })
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

    state
        .with_session_mut(&session_id, |session_data| {
            load_comparison_snapshot_workflow(session_data, &contents)
        })
        .ok_or_else(|| CsvAlignError::NotFound {
            resource: "Session".to_string(),
        })?
}
