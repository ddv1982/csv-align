use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;

use super::state::AppState;
use crate::backend::{
    apply_csv_to_session, comparison_inputs, export_results_to_bytes,
    export_session_results_snapshot, parse_file_side, run_comparison, suggest_mappings_workflow,
    validate_file_letter,
};
pub use crate::backend::{CompareRequest, MappingRequest, SessionResponse, SuggestMappingsRequest};
use crate::data::csv_loader;

/// Response for health check
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
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

/// Load a CSV file (file_a or file_b)
pub async fn load_csv_file(
    State(state): State<AppState>,
    Path((session_id, file_letter)): Path<(String, String)>,
    mut multipart: Multipart,
) -> Response {
    if let Err(error) = validate_file_letter(&file_letter) {
        return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error })).into_response();
    }

    if state.with_session(&session_id, |_| ()).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Session not found".to_string(),
            }),
        )
            .into_response();
    }

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

    let response = match state
        .with_session_mut(&session_id, |session_data| {
            let file_side = parse_file_side(&file_letter)
                .expect("validated file letter should parse into a file side");
            apply_csv_to_session(session_data, file_side, csv_data)
        })
        .await
    {
        Some(response) => response,
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

    Json(response).into_response()
}

/// Get suggested column mappings
pub async fn suggest_mappings(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<SuggestMappingsRequest>,
) -> Response {
    let response = state
        .with_session_mut(&session_id, |session_data| {
            suggest_mappings_workflow(Some(session_data), &request)
        })
        .await
        .unwrap_or_else(|| suggest_mappings_workflow(None, &request));

    Json(response).into_response()
}

/// Run comparison
pub async fn compare(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<CompareRequest>,
) -> Response {
    let comparison_input = match state.with_session(&session_id, comparison_inputs).await {
        Some(Ok(input)) => input,
        Some(Err(error)) => {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error })).into_response()
        }
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

    let (csv_a, csv_b) = comparison_input;
    let execution = match run_comparison(&csv_a, &csv_b, request) {
        Ok(execution) => execution,
        Err(error) => {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error })).into_response()
        }
    };

    let _ = state
        .with_session_mut(&session_id, |session_data| {
            session_data.comparison_results = execution.results.clone();
            session_data.comparison_config = Some(execution.config.clone());
        })
        .await;

    Json(execution.response).into_response()
}

/// Export comparison results as CSV
pub async fn export_csv(State(state): State<AppState>, Path(session_id): Path<String>) -> Response {
    let snapshot = match state
        .with_session(&session_id, export_session_results_snapshot)
        .await
    {
        Some(Ok(snapshot)) => snapshot,
        Some(Err(error)) => {
            return (StatusCode::BAD_REQUEST, Json(ErrorResponse { error })).into_response()
        }
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

    let (results, comparison_config) = snapshot;
    let csv_content = match export_results_to_bytes(&results, comparison_config.as_ref()) {
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
