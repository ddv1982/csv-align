use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};

use super::state::AppState;
use crate::comparison::{engine, mapping};
use crate::data::{csv_loader, export as csv_export, types::*};
use crate::presentation::{compare_response, suggest_mappings_response, upload_response};

/// Response for health check
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

/// Response for session creation
#[derive(Serialize)]
pub struct SessionResponse {
    pub session_id: String,
}

/// Request body for comparison
#[derive(Debug, Deserialize)]
pub struct CompareRequest {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
    pub column_mappings: Vec<MappingRequest>,
    #[serde(default)]
    pub normalization: ComparisonNormalizationConfig,
}

/// Column mapping in request
#[derive(Debug, Clone, Deserialize)]
pub struct MappingRequest {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: String,
    pub similarity: Option<f64>,
}

/// Request body for suggested mappings
#[derive(Debug, Deserialize)]
pub struct SuggestMappingsRequest {
    pub columns_a: Vec<String>,
    pub columns_b: Vec<String>,
}

/// Error response
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Health check endpoint
pub async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Create a new session
pub async fn create_session(State(state): State<AppState>) -> impl IntoResponse {
    let session_id = state.create_session().await;
    Json(SessionResponse { session_id })
}

/// Delete a session
pub async fn delete_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Response {
    if state.delete_session(&session_id).await {
        StatusCode::NO_CONTENT.into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Session not found".to_string(),
            }),
        )
            .into_response()
    }
}

/// Upload a CSV file (file_a or file_b)
pub async fn upload_csv(
    State(state): State<AppState>,
    Path((session_id, file_letter)): Path<(String, String)>,
    mut multipart: Multipart,
) -> Response {
    // Validate file letter
    if file_letter != "a" && file_letter != "b" {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "File letter must be 'a' or 'b'".to_string(),
            }),
        )
            .into_response();
    }

    // Get session
    let mut session_data = match state.get_session(&session_id).await {
        Some(data) => data,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Session not found".to_string(),
                }),
            )
                .into_response()
        }
    };

    // Get the file from multipart
    let field = match multipart.next_field().await {
        Ok(Some(field)) => field,
        Ok(None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "No file provided".to_string(),
                }),
            )
                .into_response()
        }
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Failed to read multipart: {e}"),
                }),
            )
                .into_response()
        }
    };

    // Read file bytes
    let bytes = match field.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Failed to read file: {e}"),
                }),
            )
                .into_response()
        }
    };

    // Parse CSV from bytes
    let csv_data = match csv_loader::load_csv_from_bytes(&bytes) {
        Ok(data) => data,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Failed to parse CSV: {e}"),
                }),
            )
                .into_response()
        }
    };

    // Get headers before we move csv_data
    let headers = csv_data.headers.clone();

    // Detect columns
    let columns = csv_loader::detect_columns(&csv_data);

    let row_count = csv_data.rows.len();
    let response = upload_response(file_letter.clone(), headers, &columns, row_count);

    // Update session
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

    // Save session
    let _ = state.update_session(&session_id, session_data).await;

    Json(response).into_response()
}

/// Get suggested column mappings
pub async fn suggest_mappings(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<SuggestMappingsRequest>,
) -> Response {
    let mappings = mapping::suggest_mappings(&request.columns_a, &request.columns_b);
    let response = suggest_mappings_response(&mappings);

    // Update session with mappings
    if let Some(mut session_data) = state.get_session(&session_id).await {
        session_data.column_mappings = mappings;
        let _ = state.update_session(&session_id, session_data).await;
    }

    Json(response).into_response()
}

/// Run comparison
pub async fn compare(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<CompareRequest>,
) -> Response {
    // Get session
    let mut session_data = match state.get_session(&session_id).await {
        Some(data) => data,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Session not found".to_string(),
                }),
            )
                .into_response()
        }
    };

    // Check if both files are loaded
    let (csv_a, csv_b) = match (&session_data.csv_a, &session_data.csv_b) {
        (Some(a), Some(b)) => (a.clone(), b.clone()),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Both CSV files must be uploaded before comparing".to_string(),
                }),
            )
                .into_response()
        }
    };

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
    let results = engine::compare_csv_data(&csv_a, &csv_b, &config);
    let summary = engine::generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());
    let response = compare_response(&results, &summary);

    // Update session
    session_data.comparison_results = results;
    let _ = state.update_session(&session_id, session_data).await;

    Json(response).into_response()
}

/// Export comparison results as CSV
pub async fn export_csv(State(state): State<AppState>, Path(session_id): Path<String>) -> Response {
    // Get session
    let session_data = match state.get_session(&session_id).await {
        Some(data) => data,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Session not found".to_string(),
                }),
            )
                .into_response()
        }
    };

    // Check if comparison has been run
    if session_data.comparison_results.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "No comparison results to export. Run a comparison first.".to_string(),
            }),
        )
            .into_response();
    }

    let csv_content = match csv_export::export_results_to_bytes(&session_data.comparison_results) {
        Ok(bytes) => bytes,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to build CSV export: {e}"),
                }),
            )
                .into_response()
        }
    };

    // Return CSV as download
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/csv")
        .header(
            "Content-Disposition",
            "attachment; filename=\"comparison-results.csv\"",
        )
        .body(Body::from(csv_content))
        .unwrap()
}
