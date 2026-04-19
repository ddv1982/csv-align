use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;
use tokio::task;

use super::state::AppState;
pub use crate::backend::{CompareRequest, MappingRequest, SessionResponse, SuggestMappingsRequest};
use crate::backend::{
    CsvAlignError, CsvLoadSource, LoadComparisonSnapshotRequest, LoadPairOrderRequest,
    SavePairOrderRequest, load_comparison_snapshot_workflow, load_csv_workflow,
    load_pair_order_workflow, save_comparison_snapshot_workflow, save_pair_order_workflow,
};
use crate::backend::{
    apply_csv_to_session, comparison_inputs, export_results_to_bytes,
    export_session_results_snapshot, parse_file_side, run_comparison, suggest_mappings_workflow,
};

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

async fn run_blocking<T>(
    f: impl FnOnce() -> Result<T, CsvAlignError> + Send + 'static,
) -> Result<T, CsvAlignError>
where
    T: Send + 'static,
{
    task::spawn_blocking(f)
        .await
        .map_err(|error| CsvAlignError::Internal(format!("Blocking task failed: {error}")))?
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
    let file_side = match parse_file_side(&file_letter) {
        Ok(file_side) => file_side,
        Err(error) => return error.into_response(),
    };

    if state.with_session(&session_id, |_| ()).is_none() {
        return session_not_found_response();
    }

    let field = match multipart.next_field().await {
        Ok(Some(field)) => field,
        Ok(None) => return bad_request_response("No file provided"),
        Err(error) => {
            return CsvAlignError::BadInput(format!("Failed to read multipart: {error}"))
                .into_response();
        }
    };

    let file_name = field.file_name().map(str::to_string);
    let bytes = match field.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            return CsvAlignError::BadInput(format!("Failed to read file: {error}"))
                .into_response();
        }
    };

    let load_file_letter = file_letter.clone();
    let loaded = match run_blocking(move || {
        load_csv_workflow(
            &load_file_letter,
            file_name,
            CsvLoadSource::Bytes(bytes.to_vec()),
        )
    })
    .await
    {
        Ok(loaded) => loaded,
        Err(error) => return error.into_response(),
    };

    let expected_response = loaded.response.clone();
    let update_state = state.clone();
    let update_session_id = session_id.clone();
    let response = match run_blocking(move || {
        update_state
            .with_session_mut(&update_session_id, |session_data| {
                apply_csv_to_session(session_data, file_side, loaded.csv_data)
            })
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })
    })
    .await
    {
        Ok(response) => response,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
    };

    debug_assert_eq!(response, expected_response);
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
    let compare_state = state.clone();
    let compare_session_id = session_id.clone();
    let execution = match run_blocking(move || {
        let (csv_a, csv_b) = compare_state
            .with_session(&compare_session_id, comparison_inputs)
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })??;

        run_comparison(csv_a.as_ref(), csv_b.as_ref(), request)
    })
    .await
    {
        Ok(execution) => execution,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
    };

    let response = execution.response.clone();
    let results = execution.results;
    let config = execution.config;
    let update_state = state.clone();
    let update_session_id = session_id.clone();
    if let Err(error) = run_blocking(move || {
        update_state
            .with_session_mut(&update_session_id, |session_data| {
                session_data.comparison_results = results;
                session_data.comparison_config = Some(config);
            })
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })
            .map(|_| ())
    })
    .await
    {
        return match error {
            CsvAlignError::NotFound { .. } => session_not_found_response(),
            other => other.into_response(),
        };
    }

    Json(response).into_response()
}

/// Export comparison results as CSV
#[tracing::instrument(skip(state), fields(session_id = %session_id))]
pub async fn export_csv(State(state): State<AppState>, Path(session_id): Path<String>) -> Response {
    let export_state = state.clone();
    let export_session_id = session_id.clone();
    let csv_content = match run_blocking(move || {
        let (results, comparison_config) = export_state
            .with_session(&export_session_id, export_session_results_snapshot)
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })??;

        export_results_to_bytes(&results, comparison_config.as_ref())
    })
    .await
    {
        Ok(bytes) => bytes,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
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
    let save_state = state.clone();
    let save_session_id = session_id.clone();
    let contents = match run_blocking(move || {
        save_state
            .with_session(&save_session_id, |session_data| {
                save_pair_order_workflow(session_data, request.selection)
            })
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })?
    })
    .await
    {
        Ok(contents) => contents,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
    };

    attachment("text/plain; charset=utf-8", "pair-order.txt", contents)
}

#[tracing::instrument(skip(state, request), fields(session_id = %session_id))]
pub async fn load_pair_order(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<LoadPairOrderRequest>,
) -> Response {
    let load_state = state.clone();
    let load_session_id = session_id.clone();
    let response = match run_blocking(move || {
        load_state
            .with_session(&load_session_id, |session_data| {
                load_pair_order_workflow(session_data, &request.contents)
            })
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })?
    })
    .await
    {
        Ok(response) => response,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
    };

    Json(response).into_response()
}

#[tracing::instrument(skip(state), fields(session_id = %session_id))]
pub async fn save_comparison_snapshot(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Response {
    let save_state = state.clone();
    let save_session_id = session_id.clone();
    let contents = match run_blocking(move || {
        save_state
            .with_session(&save_session_id, save_comparison_snapshot_workflow)
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })?
    })
    .await
    {
        Ok(contents) => contents,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
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
    let load_state = state.clone();
    let load_session_id = session_id.clone();
    let response = match run_blocking(move || {
        load_state
            .with_session_mut(&load_session_id, |session_data| {
                load_comparison_snapshot_workflow(session_data, &request.contents)
            })
            .ok_or_else(|| CsvAlignError::NotFound {
                resource: "Session".to_string(),
            })?
    })
    .await
    {
        Ok(response) => response,
        Err(CsvAlignError::NotFound { .. }) => return session_not_found_response(),
        Err(error) => return error.into_response(),
    };

    Json(response).into_response()
}
