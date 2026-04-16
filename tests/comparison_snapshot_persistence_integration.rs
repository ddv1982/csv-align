use axum::{
    body::to_bytes,
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use csv_align::{
    api::{handlers, state::AppState},
    backend::{CompareRequest, LoadComparisonSnapshotRequest, MappingRequest, SessionData},
    data::types::ComparisonNormalizationConfig,
};

fn csv_data(
    headers: &[&str],
    rows: &[&[&str]],
    file_name: &str,
) -> csv_align::data::types::CsvData {
    csv_align::data::types::CsvData {
        file_path: Some(file_name.to_string()),
        headers: headers.iter().map(|header| header.to_string()).collect(),
        rows: rows
            .iter()
            .map(|row| row.iter().map(|value| value.to_string()).collect())
            .collect(),
    }
}

async fn response_text(response: axum::response::Response) -> String {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    String::from_utf8(body.to_vec()).expect("response body should be utf-8")
}

async fn response_json(response: axum::response::Response) -> serde_json::Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    serde_json::from_slice(&body).expect("response body should be valid json")
}

#[tokio::test]
async fn comparison_snapshot_persistence_round_trips_through_http_handlers() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(
        &["id", "full_name"],
        &[&["1", "Alice"], &["2", "Bob"]],
        "left.csv",
    ));
    session.csv_b = Some(csv_data(
        &["record_id", "display_name"],
        &[&["1", "Alice"], &["2", "Robert"]],
        "right.csv",
    ));
    assert!(state.update_session(&session_id, session).await);

    let compare_response = handlers::compare(
        State(state.clone()),
        Path(session_id.clone()),
        Json(CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["record_id".to_string()],
            comparison_columns_a: vec!["full_name".to_string()],
            comparison_columns_b: vec!["display_name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "full_name".to_string(),
                file_b_column: "display_name".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        }),
    )
    .await;

    assert_eq!(compare_response.status(), StatusCode::OK);

    let save_response =
        handlers::save_comparison_snapshot(State(state.clone()), Path(session_id.clone())).await;

    assert_eq!(save_response.status(), StatusCode::OK);
    let contents = response_text(save_response).await;
    let saved: serde_json::Value = serde_json::from_str(&contents).unwrap();
    assert_eq!(saved["version"], 1);
    assert_eq!(saved["file_a"]["name"], "left.csv");
    assert_eq!(saved["summary"]["mismatches"], 1);

    let loaded_session_id = state.create_session().await;
    let load_response = handlers::load_comparison_snapshot(
        State(state.clone()),
        Path(loaded_session_id.clone()),
        Json(LoadComparisonSnapshotRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["file_b"]["name"], "right.csv");
    assert_eq!(json["summary"]["mismatches"], 1);

    let export_response = handlers::export_csv(State(state), Path(loaded_session_id)).await;
    assert_eq!(export_response.status(), StatusCode::OK);
    let exported = response_text(export_response).await;
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[tokio::test]
async fn comparison_snapshot_persistence_rejects_tampered_results() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let contents = serde_json::json!({
        "version": 1,
        "file_a": {
            "name": "left.csv",
            "headers": ["id"],
            "columns": [{ "index": 0, "name": "id", "data_type": "string" }],
            "row_count": 1
        },
        "file_b": {
            "name": "right.csv",
            "headers": ["record_id"],
            "columns": [{ "index": 0, "name": "record_id", "data_type": "string" }],
            "row_count": 1
        },
        "selection": {
            "key_columns_a": ["id"],
            "key_columns_b": ["record_id"],
            "comparison_columns_a": ["id"],
            "comparison_columns_b": ["record_id"]
        },
        "mappings": [],
        "normalization": {
            "treat_empty_as_null": false,
            "null_tokens": [],
            "null_token_case_insensitive": true,
            "case_insensitive": false,
            "trim_whitespace": false,
            "date_normalization": { "enabled": false, "formats": [] }
        },
        "results": [{
            "result_type": "match",
            "key": ["1"],
            "values_a": ["1"],
            "values_b": ["1"],
            "duplicate_values_a": [],
            "duplicate_values_b": [],
            "differences": []
        }],
        "summary": {
            "total_rows_a": 1,
            "total_rows_b": 1,
            "matches": 0,
            "mismatches": 0,
            "missing_left": 0,
            "missing_right": 0,
            "unkeyed_left": 0,
            "unkeyed_right": 0,
            "duplicates_a": 0,
            "duplicates_b": 0
        }
    })
    .to_string();

    let load_response = handlers::load_comparison_snapshot(
        State(state),
        Path(session_id),
        Json(LoadComparisonSnapshotRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(load_response).await;
    assert_eq!(
        json["error"],
        "Saved comparison snapshot summary does not match the persisted results"
    );
}
