use axum::{
    Json,
    body::to_bytes,
    extract::{Path, State},
    http::StatusCode,
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

fn minimal_snapshot_contents() -> serde_json::Value {
    serde_json::json!({
        "version": 2,
        "file_a": {
            "name": "left.csv",
            "headers": ["id", "name"],
            "columns": [
                { "index": 0, "name": "id", "data_type": "string" },
                { "index": 1, "name": "name", "data_type": "string" }
            ],
            "row_count": 0
        },
        "file_b": {
            "name": "right.csv",
            "headers": ["record_id", "display_name"],
            "columns": [
                { "index": 0, "name": "record_id", "data_type": "string" },
                { "index": 1, "name": "display_name", "data_type": "string" }
            ],
            "row_count": 0
        },
        "selection": {
            "key_columns_a": ["id"],
            "key_columns_b": ["record_id"],
            "comparison_columns_a": ["name"],
            "comparison_columns_b": ["display_name"]
        },
        "mappings": [{
            "file_a_column": "name",
            "file_b_column": "display_name",
            "mapping_type": "manual",
            "similarity": null
        }],
        "normalization": ComparisonNormalizationConfig::default(),
        "results": [],
        "summary": {
            "total_rows_a": 0,
            "total_rows_b": 0,
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
}

async fn load_snapshot_contents(contents: serde_json::Value) -> axum::response::Response {
    let state = AppState::new();
    let session_id = state.create_session();

    handlers::load_comparison_snapshot(
        State(state),
        Path(session_id),
        Json(LoadComparisonSnapshotRequest {
            contents: contents.to_string(),
        }),
    )
    .await
}

#[tokio::test]
async fn comparison_snapshot_persistence_round_trips_through_http_handlers() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(
        csv_data(
            &["id", "full_name"],
            &[&["1", "Alice"], &["2", "Bob"]],
            "left.csv",
        )
        .into(),
    );
    session.csv_b = Some(
        csv_data(
            &["record_id", "display_name"],
            &[&["1", "Alice"], &["2", "Robert"]],
            "right.csv",
        )
        .into(),
    );
    assert!(state.update_session(&session_id, session));

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
            normalization: ComparisonNormalizationConfig {
                flexible_key_matching: true,
                ..ComparisonNormalizationConfig::default()
            },
        }),
    )
    .await;

    assert_eq!(compare_response.status(), StatusCode::OK);

    let save_response =
        handlers::save_comparison_snapshot(State(state.clone()), Path(session_id.clone())).await;

    assert_eq!(save_response.status(), StatusCode::OK);
    let contents = response_text(save_response).await;
    let saved: serde_json::Value = serde_json::from_str(&contents).unwrap();
    assert_eq!(saved["version"], 2);
    assert_eq!(saved["file_a"]["name"], "left.csv");
    assert_eq!(saved["file_a"]["virtual_headers"], serde_json::json!([]));
    assert_eq!(saved["file_b"]["virtual_headers"], serde_json::json!([]));
    assert_eq!(saved["normalization"]["flexible_key_matching"], true);
    assert_eq!(saved["summary"]["mismatches"], 1);

    let loaded_session_id = state.create_session();
    let load_response = handlers::load_comparison_snapshot(
        State(state.clone()),
        Path(loaded_session_id.clone()),
        Json(LoadComparisonSnapshotRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["file_b"]["name"], "right.csv");
    assert_eq!(json["file_a"]["virtual_headers"], serde_json::json!([]));
    assert_eq!(json["file_b"]["virtual_headers"], serde_json::json!([]));
    assert_eq!(json["normalization"]["flexible_key_matching"], true);
    assert_eq!(json["summary"]["mismatches"], 1);

    let export_response = handlers::export_csv(State(state), Path(loaded_session_id)).await;
    assert_eq!(export_response.status(), StatusCode::OK);
    let exported = response_text(export_response).await;
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[tokio::test]
async fn comparison_snapshot_persistence_defaults_missing_flexible_key_matching_to_false() {
    let state = AppState::new();
    let session_id = state.create_session();

    let contents = serde_json::json!({
        "version": 2,
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
        "results": [],
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

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["normalization"]["flexible_key_matching"], false);
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_column_metadata_count_mismatches() {
    let mut contents = minimal_snapshot_contents();
    contents["file_a"]["columns"] = serde_json::json!([
        { "index": 0, "name": "id", "data_type": "string" }
    ]);

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(body.contains("Saved snapshot File A column metadata must match the header count"));
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_column_metadata_index_mismatches() {
    let mut contents = minimal_snapshot_contents();
    contents["file_b"]["columns"][1]["index"] = serde_json::json!(5);

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(body.contains(
        "Saved snapshot File B column metadata has index 5 for header display_name, expected 1"
    ));
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_column_metadata_name_mismatches() {
    let mut contents = minimal_snapshot_contents();
    contents["file_a"]["columns"][1]["name"] = serde_json::json!("stale_name");

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(body.contains(
        "Saved snapshot File A column metadata name stale_name does not match header name"
    ));
}

#[tokio::test]
async fn comparison_snapshot_load_response_uses_canonical_result_fields() {
    let state = AppState::new();
    let session_id = state.create_session();

    let contents = serde_json::json!({
        "version": 2,
        "file_a": {
            "name": "left.csv",
            "headers": ["id", "name"],
            "columns": [
                { "index": 0, "name": "id", "data_type": "string" },
                { "index": 1, "name": "name", "data_type": "string" }
            ],
            "row_count": 1
        },
        "file_b": {
            "name": "right.csv",
            "headers": ["record_id", "display_name"],
            "columns": [
                { "index": 0, "name": "record_id", "data_type": "string" },
                { "index": 1, "name": "display_name", "data_type": "string" }
            ],
            "row_count": 0
        },
        "selection": {
            "key_columns_a": ["id"],
            "key_columns_b": ["record_id"],
            "comparison_columns_a": ["name"],
            "comparison_columns_b": ["display_name"]
        },
        "mappings": [{
            "file_a_column": "name",
            "file_b_column": "display_name",
            "mapping_type": "manual",
            "similarity": null
        }],
        "normalization": ComparisonNormalizationConfig::default(),
        "results": [{
            "result_type": "missing_right",
            "key": ["1"],
            "values_a": ["Alice"],
            "values_b": ["stale response-only value"],
            "duplicate_values_a": [["duplicate-only"]],
            "duplicate_values_b": [["duplicate-only"]],
            "differences": [{
                "column_a": "name",
                "column_b": "display_name",
                "value_a": "Alice",
                "value_b": "stale"
            }]
        }],
        "summary": {
            "total_rows_a": 1,
            "total_rows_b": 0,
            "matches": 0,
            "mismatches": 0,
            "missing_left": 0,
            "missing_right": 1,
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

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["results"][0]["values_a"], serde_json::json!(["Alice"]));
    assert_eq!(json["results"][0]["values_b"], serde_json::json!([]));
    assert_eq!(
        json["results"][0]["duplicate_values_a"],
        serde_json::json!([])
    );
    assert_eq!(
        json["results"][0]["duplicate_values_b"],
        serde_json::json!([])
    );
    assert_eq!(json["results"][0]["differences"], serde_json::json!([]));
}

#[tokio::test]
async fn comparison_snapshot_persistence_rejects_legacy_version() {
    let state = AppState::new();
    let session_id = state.create_session();

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
        "results": [],
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
        "Unsupported comparison snapshot version 1 — this file was produced by an older csv-align release. Re-run the comparison in v2."
    );
}

#[tokio::test]
async fn comparison_snapshot_persistence_rejects_tampered_results() {
    let state = AppState::new();
    let session_id = state.create_session();

    let contents = serde_json::json!({
        "version": 2,
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
