use std::collections::HashMap;
use std::sync::Mutex;

use csv_align::backend::{
    apply_csv_to_session, comparison_inputs, export_session_results_snapshot, parse_file_side,
    run_comparison, suggest_mappings_workflow, validate_file_letter, write_export_results,
    CompareRequest, SessionData, SessionResponse, SuggestMappingsRequest,
};
use csv_align::data::csv_loader;
use csv_align::presentation::responses::{
    CompareResponse, FileLoadResponse, SuggestMappingsResponse,
};

/// Application state to hold session data
struct AppState {
    sessions: Mutex<HashMap<String, SessionData>>,
}

impl AppState {
    fn with_session<R>(&self, session_id: &str, f: impl FnOnce(&SessionData) -> R) -> Option<R> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(session_id).map(f)
    }

    fn with_session_mut<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.get_mut(session_id).map(f)
    }
}

/// Create a new session
#[tauri::command]
fn create_session(state: tauri::State<AppState>) -> SessionResponse {
    let session_id = uuid::Uuid::new_v4().to_string();
    let mut sessions = state.sessions.lock().unwrap();
    sessions.insert(session_id.clone(), SessionData::new());
    SessionResponse { session_id }
}

/// Load a CSV file from a local path
#[tauri::command]
fn load_csv(
    state: tauri::State<AppState>,
    session_id: String,
    file_letter: String,
    file_path: String,
) -> Result<FileLoadResponse, String> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;

    let csv_data =
        csv_loader::load_csv(&file_path).map_err(|e| format!("Failed to load CSV: {}", e))?;

    let mut sessions = state.sessions.lock().unwrap();
    let session_data = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(apply_csv_to_session(session_data, file_side, csv_data))
}

/// Load a CSV file from raw bytes (desktop/webview file selection)
#[tauri::command]
fn load_csv_bytes(
    state: tauri::State<AppState>,
    session_id: String,
    file_letter: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<FileLoadResponse, String> {
    validate_file_letter(&file_letter)?;
    let file_side = parse_file_side(&file_letter)?;

    let mut csv_data = csv_loader::load_csv_from_bytes(&file_bytes)
        .map_err(|e| format!("Failed to parse CSV bytes: {}", e))?;

    if !file_name.trim().is_empty() {
        csv_data.file_path = Some(file_name);
    }

    let mut sessions = state.sessions.lock().unwrap();
    let session_data = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(apply_csv_to_session(session_data, file_side, csv_data))
}

/// Get suggested column mappings
#[tauri::command]
fn suggest_mappings(
    state: tauri::State<AppState>,
    session_id: String,
    request: SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, String> {
    Ok(state
        .with_session_mut(&session_id, |session_data| {
            suggest_mappings_workflow(Some(session_data), &request)
        })
        .unwrap_or_else(|| suggest_mappings_workflow(None, &request)))
}

/// Run comparison
#[tauri::command]
fn compare(
    state: tauri::State<AppState>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, String> {
    let (csv_a, csv_b) = state
        .with_session(&session_id, comparison_inputs)
        .ok_or_else(|| "Session not found".to_string())??;

    let execution = run_comparison(&csv_a, &csv_b, request)?;

    let response = execution.response.clone();
    state
        .with_session_mut(&session_id, |session_data| {
            session_data.comparison_results = execution.results;
            session_data.comparison_config = Some(execution.config);
        })
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(response)
}

/// Export comparison results to a CSV file path
#[tauri::command]
fn export_results(
    state: tauri::State<AppState>,
    session_id: String,
    output_path: String,
) -> Result<(), String> {
    let (results, comparison_config) = state
        .with_session(&session_id, export_session_results_snapshot)
        .ok_or_else(|| "Session not found".to_string())??;

    write_export_results(&results, comparison_config.as_ref(), &output_path)
}

#[cfg(test)]
mod tests;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            create_session,
            load_csv,
            load_csv_bytes,
            suggest_mappings,
            compare,
            export_results,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
