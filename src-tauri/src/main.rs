use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use csv_align::comparison::{engine, mapping};
use csv_align::data::{csv_loader, export as csv_export, types::*};
use csv_align::presentation::{
    compare_response, file_load_response, suggest_mappings_response, CompareResponse,
    FileLoadResponse, SuggestMappingsResponse,
};

/// Application state to hold session data
struct AppState {
    sessions: Mutex<HashMap<String, SessionData>>,
}

#[derive(Clone)]
struct SessionData {
    csv_a: Option<CsvData>,
    csv_b: Option<CsvData>,
    columns_a: Vec<ColumnInfo>,
    columns_b: Vec<ColumnInfo>,
    column_mappings: Vec<ColumnMapping>,
    comparison_results: Vec<RowComparisonResult>,
}

impl SessionData {
    fn new() -> Self {
        Self {
            csv_a: None,
            csv_b: None,
            columns_a: Vec::new(),
            columns_b: Vec::new(),
            column_mappings: Vec::new(),
            comparison_results: Vec::new(),
        }
    }
}

/// Column mapping in request
#[derive(Debug, Clone, Deserialize)]
struct MappingRequest {
    file_a_column: String,
    file_b_column: String,
    mapping_type: String,
    similarity: Option<f64>,
}

/// Request body for comparison
#[derive(Debug, Deserialize)]
struct CompareRequest {
    key_columns_a: Vec<String>,
    key_columns_b: Vec<String>,
    comparison_columns_a: Vec<String>,
    comparison_columns_b: Vec<String>,
    column_mappings: Vec<MappingRequest>,
    #[serde(default)]
    normalization: ComparisonNormalizationConfig,
}

/// Request for suggested mappings
#[derive(Debug, Deserialize)]
struct SuggestMappingsRequest {
    columns_a: Vec<String>,
    columns_b: Vec<String>,
}

/// Response for session creation
#[derive(Serialize)]
struct SessionResponse {
    session_id: String,
}

fn apply_csv_to_session(
    session_data: &mut SessionData,
    file_letter: &str,
    csv_data: CsvData,
) -> FileLoadResponse {
    let headers = csv_data.headers.clone();
    let columns = csv_loader::detect_columns(&csv_data);
    let row_count = csv_data.rows.len();
    let response = file_load_response(file_letter, headers, &columns, row_count);

    if file_letter == "a" {
        session_data.csv_a = Some(csv_data);
        session_data.columns_a = columns;
    } else {
        session_data.csv_b = Some(csv_data);
        session_data.columns_b = columns;
    }

    // Auto-suggest mappings if both files are loaded
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
        session_data.column_mappings = mapping::suggest_mappings(&col_names_a, &col_names_b);
    }

    response
}

fn validate_file_letter(file_letter: &str) -> Result<(), String> {
    if file_letter == "a" || file_letter == "b" {
        Ok(())
    } else {
        Err("File letter must be 'a' or 'b'".to_string())
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

    let csv_data =
        csv_loader::load_csv(&file_path).map_err(|e| format!("Failed to load CSV: {}", e))?;

    let mut sessions = state.sessions.lock().unwrap();
    let session_data = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(apply_csv_to_session(session_data, &file_letter, csv_data))
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

    let mut csv_data = csv_loader::load_csv_from_bytes(&file_bytes)
        .map_err(|e| format!("Failed to parse CSV bytes: {}", e))?;

    if !file_name.trim().is_empty() {
        csv_data.file_path = Some(file_name);
    }

    let mut sessions = state.sessions.lock().unwrap();
    let session_data = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(apply_csv_to_session(session_data, &file_letter, csv_data))
}

/// Get suggested column mappings
#[tauri::command]
fn suggest_mappings(
    state: tauri::State<AppState>,
    session_id: String,
    request: SuggestMappingsRequest,
) -> Result<SuggestMappingsResponse, String> {
    let mappings = mapping::suggest_mappings(&request.columns_a, &request.columns_b);
    let response = suggest_mappings_response(&mappings);

    // Update session with mappings
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session_data) = sessions.get_mut(&session_id) {
        session_data.column_mappings = mappings;
    }

    Ok(response)
}

/// Run comparison
#[tauri::command]
fn compare(
    state: tauri::State<AppState>,
    session_id: String,
    request: CompareRequest,
) -> Result<CompareResponse, String> {
    let mut sessions = state.sessions.lock().unwrap();

    let session_data = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| "File A not selected or loaded".to_string())?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| "File B not selected or loaded".to_string())?;

    // Build comparison config
    let column_mappings: Vec<ColumnMapping> = request
        .column_mappings
        .iter()
        .map(|m| {
            let mapping_type = match m.mapping_type.as_str() {
                "exact" => MappingType::ExactMatch,
                "manual" => MappingType::ManualMatch,
                "fuzzy" => MappingType::FuzzyMatch(m.similarity.unwrap_or(0.0)),
                _ => MappingType::ManualMatch,
            };
            ColumnMapping {
                file_a_column: m.file_a_column.clone(),
                file_b_column: m.file_b_column.clone(),
                mapping_type,
            }
        })
        .collect();

    let config = ComparisonConfig {
        key_columns_a: request.key_columns_a,
        key_columns_b: request.key_columns_b,
        comparison_columns_a: request.comparison_columns_a,
        comparison_columns_b: request.comparison_columns_b,
        column_mappings,
        normalization: request.normalization,
    };

    // Run comparison
    let results = engine::compare_csv_data(csv_a, csv_b, &config);
    let summary = engine::generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());
    session_data.comparison_results = results.clone();

    Ok(compare_response(&results, &summary))
}

/// Export comparison results to a CSV file path
#[tauri::command]
fn export_results(
    state: tauri::State<AppState>,
    session_id: String,
    output_path: String,
) -> Result<(), String> {
    let results = {
        let sessions = state.sessions.lock().unwrap();
        let session_data = sessions
            .get(&session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        if session_data.comparison_results.is_empty() {
            return Err("No comparison results to export. Run a comparison first.".to_string());
        }

        session_data.comparison_results.clone()
    };

    csv_export::export_results(&results, &output_path)
        .map_err(|e| format!("Failed to export results: {}", e))
}

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
