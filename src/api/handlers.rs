use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;

use super::state::AppState;
pub use crate::backend::{CompareRequest, MappingRequest, SessionResponse, SuggestMappingsRequest};
use crate::backend::{
    CsvAlignError, LoadComparisonSnapshotRequest, LoadPairOrderRequest, SavePairOrderRequest,
    load_comparison_snapshot_workflow, load_pair_order_workflow, save_comparison_snapshot_workflow,
    save_pair_order_workflow,
};
use crate::backend::{
    apply_csv_to_session, comparison_inputs, export_results_to_bytes,
    export_session_results_snapshot, parse_file_side, run_comparison, suggest_mappings_workflow,
    validate_file_letter,
};
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

fn error_response(status: StatusCode, error: impl Into<String>) -> Response {
    (
        status,
        Json(ErrorResponse {
            error: error.into(),
        }),
    )
        .into_response()
}

fn bad_request_response(error: impl Into<String>) -> Response {
    error_response(StatusCode::BAD_REQUEST, error)
}

fn session_not_found_response() -> Response {
    CsvAlignError::NotFound {
        resource: "Session".to_string(),
    }
    .into_response()
}

fn attachment(content_type: &str, filename: &str, body: impl Into<Body>) -> Response {
    let mut response = Response::new(body.into());
    *response.status_mut() = StatusCode::OK;
    let headers = response.headers_mut();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/octet-stream"),
    );
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_str(content_type)
            .unwrap_or_else(|_| axum::http::HeaderValue::from_static("application/octet-stream")),
    );
    if let Ok(disposition) =
        axum::http::HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
    {
        headers.insert(axum::http::header::CONTENT_DISPOSITION, disposition);
    }
    response
}

/// Health check endpoint
#[tracing::instrument]
pub async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Create a new session
#[tracing::instrument(skip(state))]
pub async fn create_session(State(state): State<AppState>) -> impl IntoResponse {
    let session_id = state.create_session();
    Json(SessionResponse { session_id })
}

/// Delete a session
#[tracing::instrument(skip(state), fields(session_id = %session_id))]
pub async fn delete_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Response {
    if state.delete_session(&session_id) {
        StatusCode::NO_CONTENT.into_response()
    } else {
        session_not_found_response()
    }
}

/// Load a CSV file (file_a or file_b)
#[tracing::instrument(skip(state, multipart), fields(session_id = %session_id))]
pub async fn load_csv_file(
    State(state): State<AppState>,
    Path((session_id, file_letter)): Path<(String, String)>,
    mut multipart: Multipart,
) -> Response {
    if let Err(error) = validate_file_letter(&file_letter) {
        return error.into_response();
    }

    if state.with_session(&session_id, |_| ()).is_none() {
        return session_not_found_response();
    }

    let field = match multipart.next_field().await {
        Ok(Some(field)) => field,
        Ok(None) => return bad_request_response("No file provided"),
        Err(e) => {
            return CsvAlignError::BadInput(format!("Failed to read multipart: {e}"))
                .into_response();
        }
    };

    let file_name = field.file_name().map(str::to_string);

    let bytes = match field.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            return CsvAlignError::BadInput(format!("Failed to read file: {e}")).into_response();
        }
    };

    let mut csv_data = match csv_loader::load_csv_from_bytes(&bytes) {
        Ok(data) => data,
        Err(e) => return CsvAlignError::Parse(format!("Failed to parse CSV: {e}")).into_response(),
    };

    if let Some(file_name) = file_name {
        csv_data.file_path = Some(file_name);
    }

    let response = match state.with_session_mut(&session_id, |session_data| {
        let file_side = parse_file_side(&file_letter)
            .expect("validated file letter should parse into a file side");
        apply_csv_to_session(session_data, file_side, csv_data)
    }) {
        Some(response) => response,
        None => return session_not_found_response(),
    };

    Json(response).into_response()
}

/// Get suggested column mappings
#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn suggest_mappings(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<SuggestMappingsRequest>,
) -> Response {
    let response = state
        .with_session_mut(&session_id, |session_data| {
            suggest_mappings_workflow(Some(session_data), &request)
        })
        .unwrap_or_else(|| suggest_mappings_workflow(None, &request));

    Json(response).into_response()
}

/// Run comparison
#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn compare(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<CompareRequest>,
) -> Response {
    let comparison_input = match state.with_session(&session_id, comparison_inputs) {
        Some(Ok(input)) => input,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    let (csv_a, csv_b) = comparison_input;
    let execution = match run_comparison(csv_a.as_ref(), csv_b.as_ref(), request) {
        Ok(execution) => execution,
        Err(error) => return error.into_response(),
    };

    let _ = state.with_session_mut(&session_id, |session_data| {
        session_data.comparison_results = execution.results.clone();
        session_data.comparison_config = Some(execution.config.clone());
    });

    Json(execution.response).into_response()
}

/// Export comparison results as CSV
#[tracing::instrument(skip(state), fields(session_id = %session_id))]
pub async fn export_csv(State(state): State<AppState>, Path(session_id): Path<String>) -> Response {
    let snapshot = match state.with_session(&session_id, export_session_results_snapshot) {
        Some(Ok(snapshot)) => snapshot,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    let (results, comparison_config) = snapshot;
    let csv_content = match export_results_to_bytes(&results, comparison_config.as_ref()) {
        Ok(bytes) => bytes,
        Err(error) => return error.into_response(),
    };

    attachment("text/csv", "comparison-results.csv", csv_content)
}

#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn save_pair_order(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<SavePairOrderRequest>,
) -> Response {
    let contents = match state.with_session(&session_id, |session_data| {
        save_pair_order_workflow(session_data, request.selection)
    }) {
        Some(Ok(contents)) => contents,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    attachment("text/plain; charset=utf-8", "pair-order.txt", contents)
}

#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn load_pair_order(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<LoadPairOrderRequest>,
) -> Response {
    let response = match state.with_session(&session_id, |session_data| {
        load_pair_order_workflow(session_data, &request.contents)
    }) {
        Some(Ok(response)) => response,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    Json(response).into_response()
}

#[tracing::instrument(skip(state), fields(session_id = %session_id))]
pub async fn save_comparison_snapshot(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Response {
    let contents = match state.with_session(&session_id, save_comparison_snapshot_workflow) {
        Some(Ok(contents)) => contents,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    attachment(
        "application/json; charset=utf-8",
        "comparison-snapshot.json",
        contents,
    )
}

#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn load_comparison_snapshot(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<LoadComparisonSnapshotRequest>,
) -> Response {
    let response = match state.with_session_mut(&session_id, |session_data| {
        load_comparison_snapshot_workflow(session_data, &request.contents)
    }) {
        Some(Ok(response)) => response,
        Some(Err(error)) => return error.into_response(),
        None => return session_not_found_response(),
    };

    Json(response).into_response()
}
