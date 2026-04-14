mod common;

use axum::{
    body::to_bytes,
    extract::{Path, State},
    http::StatusCode,
    response::Response,
    Json,
};
use csv_align::api::{
    handlers::{self, CompareRequest, MappingRequest, SuggestMappingsRequest},
    state::{AppState, SessionData},
};
use csv_align::data::types::{ComparisonNormalizationConfig, CsvData};
use serde_json::Value;

use common::csv_data;

fn build_compare_request() -> CompareRequest {
    CompareRequest {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string(), "value".to_string()],
        comparison_columns_b: vec!["name".to_string(), "amount".to_string()],
        column_mappings: vec![
            MappingRequest {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: "exact".to_string(),
                similarity: None,
            },
            MappingRequest {
                file_a_column: "value".to_string(),
                file_b_column: "amount".to_string(),
                mapping_type: "exact".to_string(),
                similarity: None,
            },
        ],
        normalization: ComparisonNormalizationConfig::default(),
    }
}

fn build_csv_a() -> CsvData {
    csv_data(
        "left.csv",
        &["id", "name", "value"],
        &[
            &["1", "Alice", "100"],
            &["2", "Bob", "200"],
            &["3", "Charlie", "300"],
            &["5", "Dupe One", "500"],
            &["5", "Dupe Two", "501"],
        ],
    )
}

fn build_csv_b() -> CsvData {
    csv_data(
        "right.csv",
        &["id", "name", "amount"],
        &[
            &["1", "Alice", "100"],
            &["2", "Robert", "200"],
            &["4", "Dana", "400"],
        ],
    )
}

async fn response_json(response: Response) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    serde_json::from_slice(&body).expect("response body should be valid JSON")
}

async fn response_text(response: Response) -> String {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    String::from_utf8(body.to_vec()).expect("response body should be valid utf-8")
}

fn result_by_type<'a>(results: &'a [Value], result_type: &str) -> &'a Value {
    results
        .iter()
        .find(|result| result.get("result_type") == Some(&Value::String(result_type.to_string())))
        .unwrap_or_else(|| panic!("missing result type {result_type}"))
}

#[tokio::test]
async fn response_contracts_suggest_mappings_serializes_exact_and_fuzzy_mappings() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let response = handlers::suggest_mappings(
        State(state),
        Path(session_id),
        Json(SuggestMappingsRequest {
            columns_a: vec!["FirstName".to_string(), "alpha_num_code".to_string()],
            columns_b: vec!["first_name".to_string(), "alpha_number_code".to_string()],
        }),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);

    let json = response_json(response).await;
    let mappings = json["mappings"]
        .as_array()
        .expect("mappings should be an array");
    assert_eq!(mappings.len(), 2);

    let exact = mappings
        .iter()
        .find(|mapping| mapping["mapping_type"] == "exact")
        .expect("expected exact mapping");
    assert_eq!(exact["file_a_column"], "FirstName");
    assert_eq!(exact["file_b_column"], "first_name");
    assert!(exact["similarity"].is_null());

    let fuzzy = mappings
        .iter()
        .find(|mapping| mapping["mapping_type"] == "fuzzy")
        .expect("expected fuzzy mapping");
    assert_eq!(fuzzy["file_a_column"], "alpha_num_code");
    assert_eq!(fuzzy["file_b_column"], "alpha_number_code");
    let similarity = fuzzy["similarity"]
        .as_f64()
        .expect("fuzzy similarity should serialize as a number");
    assert!(
        similarity >= 0.70,
        "expected fuzzy similarity >= 0.70, got {similarity}"
    );
    assert!(
        similarity <= 1.0,
        "expected fuzzy similarity <= 1.0, got {similarity}"
    );
}

#[tokio::test]
async fn response_contracts_compare_serializes_each_result_variant_and_summary_shape() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(build_csv_a());
    session.csv_b = Some(build_csv_b());
    assert!(state.update_session(&session_id, session).await);

    let response = handlers::compare(
        State(state),
        Path(session_id),
        Json(build_compare_request()),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);

    let json = response_json(response).await;
    assert_eq!(json["success"], Value::Bool(true));

    let results = json["results"]
        .as_array()
        .expect("results should be an array");
    assert_eq!(results.len(), 5, "expected one response per result variant");

    let matched = result_by_type(results, "match");
    assert_eq!(matched["key"], serde_json::json!(["1"]));
    assert_eq!(matched["values_a"], serde_json::json!(["Alice", "100"]));
    assert_eq!(matched["values_b"], serde_json::json!(["Alice", "100"]));
    assert_eq!(matched["duplicate_values_a"], serde_json::json!([]));
    assert_eq!(matched["duplicate_values_b"], serde_json::json!([]));
    assert_eq!(matched["differences"], serde_json::json!([]));

    let mismatch = result_by_type(results, "mismatch");
    assert_eq!(mismatch["key"], serde_json::json!(["2"]));
    assert_eq!(mismatch["values_a"], serde_json::json!(["Bob", "200"]));
    assert_eq!(mismatch["values_b"], serde_json::json!(["Robert", "200"]));
    assert_eq!(
        mismatch["differences"],
        serde_json::json!([{
            "column_a": "name",
            "column_b": "name",
            "value_a": "Bob",
            "value_b": "Robert"
        }])
    );

    let missing_left = result_by_type(results, "missing_left");
    assert_eq!(missing_left["key"], serde_json::json!(["4"]));
    assert_eq!(missing_left["values_a"], serde_json::json!([]));
    assert_eq!(missing_left["values_b"], serde_json::json!(["Dana", "400"]));
    assert_eq!(missing_left["duplicate_values_a"], serde_json::json!([]));
    assert_eq!(missing_left["duplicate_values_b"], serde_json::json!([]));
    assert_eq!(missing_left["differences"], serde_json::json!([]));

    let missing_right = result_by_type(results, "missing_right");
    assert_eq!(missing_right["key"], serde_json::json!(["3"]));
    assert_eq!(
        missing_right["values_a"],
        serde_json::json!(["Charlie", "300"])
    );
    assert_eq!(missing_right["values_b"], serde_json::json!([]));
    assert_eq!(missing_right["differences"], serde_json::json!([]));

    let duplicate = result_by_type(results, "duplicate_filea");
    assert_eq!(duplicate["key"], serde_json::json!(["5"]));
    assert_eq!(
        duplicate["values_a"],
        serde_json::json!(["Dupe One", "500"])
    );
    assert_eq!(duplicate["values_b"], serde_json::json!([]));
    assert_eq!(
        duplicate["duplicate_values_a"],
        serde_json::json!([["Dupe One", "500"], ["Dupe Two", "501"]])
    );
    assert_eq!(duplicate["duplicate_values_b"], serde_json::json!([]));
    assert_eq!(duplicate["differences"], serde_json::json!([]));

    assert_eq!(
        json["summary"],
        serde_json::json!({
            "total_rows_a": 5,
            "total_rows_b": 3,
            "matches": 1,
            "mismatches": 1,
            "missing_left": 1,
            "missing_right": 1,
            "duplicates_a": 1,
            "duplicates_b": 0
        })
    );
}

#[tokio::test]
async fn response_contracts_export_uses_stored_comparison_labels_for_csv_headers() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(build_csv_a());
    session.csv_b = Some(build_csv_b());
    assert!(state.update_session(&session_id, session).await);

    let compare_response = handlers::compare(
        State(state.clone()),
        Path(session_id.clone()),
        Json(build_compare_request()),
    )
    .await;
    assert_eq!(compare_response.status(), StatusCode::OK);

    let export_response = handlers::export_csv(State(state), Path(session_id)).await;
    assert_eq!(export_response.status(), StatusCode::OK);

    let body = response_text(export_response).await;
    assert!(body.contains("Key: id"));
    assert!(body.contains("File A: name"));
    assert!(body.contains("File B: amount"));
    assert!(body.contains("Difference Summary"));
    assert!(body.contains("name: Bob -> Robert"));
}

#[tokio::test]
async fn response_contracts_compare_rejects_unknown_mapping_types() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(build_csv_a());
    session.csv_b = Some(build_csv_b());
    assert!(state.update_session(&session_id, session).await);

    let mut request = build_compare_request();
    request.column_mappings[0].mapping_type = "mystery".to_string();

    let response = handlers::compare(State(state), Path(session_id), Json(request)).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(
        json["error"],
        "Unknown mapping type 'mystery'. Expected one of: exact, manual, fuzzy"
    );
}

#[tokio::test]
async fn response_contracts_compare_rejects_missing_selected_columns() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(build_csv_a());
    session.csv_b = Some(build_csv_b());
    assert!(state.update_session(&session_id, session).await);

    let mut request = build_compare_request();
    request.comparison_columns_b = vec!["name".to_string()];

    let response = handlers::compare(State(state), Path(session_id), Json(request)).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(json["error"], "Comparison columns for File A and Comparison columns for File B must contain the same number of columns (got 2 and 1)");
}
