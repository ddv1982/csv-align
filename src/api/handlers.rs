use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};

use super::state::AppState;
use crate::comparison::{engine, mapping};
use crate::data::{csv_loader, types::*};

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

/// Response for CSV upload
#[derive(Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub file_letter: String,
    pub headers: Vec<String>,
    pub columns: Vec<ColumnResponse>,
    pub row_count: usize,
}

/// Column info for API response
#[derive(Debug, Clone, Serialize)]
pub struct ColumnResponse {
    pub index: usize,
    pub name: String,
    pub data_type: String,
}

/// Request body for comparison
#[derive(Debug, Deserialize)]
pub struct CompareRequest {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
    pub column_mappings: Vec<MappingRequest>,
}

/// Column mapping in request
#[derive(Debug, Clone, Deserialize)]
pub struct MappingRequest {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: String,
    pub similarity: Option<f64>,
}

/// Response for comparison
#[derive(Serialize)]
pub struct CompareResponse {
    pub success: bool,
    pub results: Vec<ResultResponse>,
    pub summary: SummaryResponse,
}

/// Single comparison result
#[derive(Debug, Clone, Serialize)]
pub struct ResultResponse {
    pub result_type: String,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
    pub differences: Vec<DifferenceResponse>,
}

/// Value difference
#[derive(Debug, Clone, Serialize)]
pub struct DifferenceResponse {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

/// Summary statistics
#[derive(Debug, Clone, Serialize)]
pub struct SummaryResponse {
    pub total_rows_a: usize,
    pub total_rows_b: usize,
    pub matches: usize,
    pub mismatches: usize,
    pub missing_left: usize,
    pub missing_right: usize,
    pub duplicates_a: usize,
    pub duplicates_b: usize,
}

/// Request body for suggested mappings
#[derive(Debug, Deserialize)]
pub struct SuggestMappingsRequest {
    pub columns_a: Vec<String>,
    pub columns_b: Vec<String>,
}

/// Response for suggested mappings
#[derive(Serialize)]
pub struct SuggestMappingsResponse {
    pub mappings: Vec<MappingResponse>,
}

/// Mapping in response
#[derive(Debug, Clone, Serialize)]
pub struct MappingResponse {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: String,
    pub similarity: Option<f64>,
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

    // Create response
    let column_responses: Vec<ColumnResponse> = columns
        .iter()
        .map(|c| ColumnResponse {
            index: c.index,
            name: c.name.clone(),
            data_type: format!("{:?}", c.data_type),
        })
        .collect();

    let row_count = csv_data.rows.len();

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

    Json(UploadResponse {
        success: true,
        file_letter,
        headers,
        columns: column_responses,
        row_count,
    })
    .into_response()
}

/// Get suggested column mappings
pub async fn suggest_mappings(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<SuggestMappingsRequest>,
) -> Response {
    let mappings = mapping::suggest_mappings(&request.columns_a, &request.columns_b);

    let mapping_responses: Vec<MappingResponse> = mappings
        .iter()
        .map(|m| {
            let (mapping_type, similarity) = match &m.mapping_type {
                MappingType::ExactMatch => ("exact".to_string(), None),
                MappingType::ManualMatch => ("manual".to_string(), None),
                MappingType::FuzzyMatch(score) => ("fuzzy".to_string(), Some(*score)),
            };
            MappingResponse {
                file_a_column: m.file_a_column.clone(),
                file_b_column: m.file_b_column.clone(),
                mapping_type,
                similarity,
            }
        })
        .collect();

    // Update session with mappings
    if let Some(mut session_data) = state.get_session(&session_id).await {
        session_data.column_mappings = mappings;
        let _ = state.update_session(&session_id, session_data).await;
    }

    Json(SuggestMappingsResponse {
        mappings: mapping_responses,
    })
    .into_response()
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
    };

    // Run comparison
    let results = engine::compare_csv_data(&csv_a, &csv_b, &config);
    let summary = engine::generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());

    // Build response
    let result_responses: Vec<ResultResponse> = results
        .iter()
        .map(|r| match r {
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } => ResultResponse {
                result_type: "match".to_string(),
                key: key.clone(),
                values_a: values_a.clone(),
                values_b: values_b.clone(),
                differences: Vec::new(),
            },
            RowComparisonResult::Mismatch {
                key,
                values_a,
                values_b,
                differences,
            } => ResultResponse {
                result_type: "mismatch".to_string(),
                key: key.clone(),
                values_a: values_a.clone(),
                values_b: values_b.clone(),
                differences: differences
                    .iter()
                    .map(|d| DifferenceResponse {
                        column_a: d.column_a.clone(),
                        column_b: d.column_b.clone(),
                        value_a: d.value_a.clone(),
                        value_b: d.value_b.clone(),
                    })
                    .collect(),
            },
            RowComparisonResult::MissingLeft { key, values_b } => ResultResponse {
                result_type: "missing_left".to_string(),
                key: key.clone(),
                values_a: Vec::new(),
                values_b: values_b.clone(),
                differences: Vec::new(),
            },
            RowComparisonResult::MissingRight { key, values_a } => ResultResponse {
                result_type: "missing_right".to_string(),
                key: key.clone(),
                values_a: values_a.clone(),
                values_b: Vec::new(),
                differences: Vec::new(),
            },
            RowComparisonResult::Duplicate {
                key,
                source,
                values,
            } => ResultResponse {
                result_type: format!("duplicate_{source:?}").to_lowercase(),
                key: key.clone(),
                values_a: values.first().cloned().unwrap_or_default(),
                values_b: values.get(1).cloned().unwrap_or_default(),
                differences: Vec::new(),
            },
        })
        .collect();

    // Update session
    session_data.comparison_config = Some(config);
    session_data.comparison_results = results;
    session_data.comparison_summary = Some(summary.clone());
    let _ = state.update_session(&session_id, session_data).await;

    Json(CompareResponse {
        success: true,
        results: result_responses,
        summary: SummaryResponse {
            total_rows_a: summary.total_rows_a,
            total_rows_b: summary.total_rows_b,
            matches: summary.matches,
            mismatches: summary.mismatches,
            missing_left: summary.missing_left,
            missing_right: summary.missing_right,
            duplicates_a: summary.duplicates_a,
            duplicates_b: summary.duplicates_b,
        },
    })
    .into_response()
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

    // Generate CSV
    let mut csv_content = String::new();
    csv_content.push_str("Result Type,Key,File A Values,File B Values,Differences\n");

    for result in &session_data.comparison_results {
        match result {
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } => {
                csv_content.push_str(&format!(
                    "Match,{},{},{},\n",
                    escape_csv(&key.join(";")),
                    escape_csv(&values_a.join(";")),
                    escape_csv(&values_b.join(";"))
                ));
            }
            RowComparisonResult::Mismatch {
                key,
                values_a,
                values_b,
                differences,
            } => {
                let diff_str: Vec<String> = differences
                    .iter()
                    .map(|d| format!("{}: {} vs {}", d.column_a, d.value_a, d.value_b))
                    .collect();
                csv_content.push_str(&format!(
                    "Mismatch,{},{},{},{}\n",
                    escape_csv(&key.join(";")),
                    escape_csv(&values_a.join(";")),
                    escape_csv(&values_b.join(";")),
                    escape_csv(&diff_str.join("; "))
                ));
            }
            RowComparisonResult::MissingLeft { key, values_b } => {
                csv_content.push_str(&format!(
                    "Missing Left,{},{},{},\n",
                    escape_csv(&key.join(";")),
                    "",
                    escape_csv(&values_b.join(";"))
                ));
            }
            RowComparisonResult::MissingRight { key, values_a } => {
                csv_content.push_str(&format!(
                    "Missing Right,{},{},{},\n",
                    escape_csv(&key.join(";")),
                    escape_csv(&values_a.join(";")),
                    ""
                ));
            }
            RowComparisonResult::Duplicate {
                key,
                source,
                values,
            } => {
                let source_str = match source {
                    DuplicateSource::FileA => "File A",
                    DuplicateSource::FileB => "File B",
                    DuplicateSource::Both => "Both Files",
                };
                let values_str: Vec<String> = values.iter().map(|v| v.join(",")).collect();
                csv_content.push_str(&format!(
                    "Duplicate ({}),{},{},{},\n",
                    source_str,
                    escape_csv(&key.join(";")),
                    escape_csv(&values_str.join(" | ")),
                    ""
                ));
            }
        }
    }

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

/// Escape a string for CSV
fn escape_csv(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
