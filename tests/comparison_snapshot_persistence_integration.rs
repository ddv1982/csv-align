use axum::{
    Json,
    body::{Body, to_bytes},
    extract::{Path, Request, State},
    http::StatusCode,
};
use csv_align::{
    api::{handlers, state::AppState},
    backend::{CompareRequest, MappingRequest, SessionData, limits::MAX_CSV_ROWS},
    data::types::{ComparisonNormalizationConfig, DecimalRoundingConfig},
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
        Request::new(Body::from(contents.to_string())),
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
        Request::new(Body::from(contents)),
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
            "matches": 1,
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
        Request::new(Body::from(contents)),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["normalization"]["flexible_key_matching"], false);
}

#[tokio::test]
async fn comparison_snapshot_load_defaults_partial_decimal_rounding_from_the_domain_contract() {
    let mut contents = minimal_snapshot_contents();
    contents["normalization"]["decimal_rounding"] = serde_json::json!({"enabled": true});

    let response = load_snapshot_contents(contents).await;

    assert_eq!(response.status(), StatusCode::OK);
    let json = response_json(response).await;
    assert_eq!(json["normalization"]["decimal_rounding"]["enabled"], true);
    assert_eq!(
        json["normalization"]["decimal_rounding"]["decimals"],
        DecimalRoundingConfig::default().decimals
    );
}

#[tokio::test]
async fn comparison_snapshot_load_accepts_the_exact_csv_row_limit() {
    let mut contents = minimal_snapshot_contents();
    contents["file_a"]["row_count"] = serde_json::json!(MAX_CSV_ROWS);
    contents["file_b"]["row_count"] = serde_json::json!(MAX_CSV_ROWS);
    contents["summary"]["total_rows_a"] = serde_json::json!(MAX_CSV_ROWS);
    contents["summary"]["total_rows_b"] = serde_json::json!(MAX_CSV_ROWS);
    contents["summary"]["duplicates_a"] = serde_json::json!(1);
    contents["summary"]["duplicates_b"] = serde_json::json!(1);
    let duplicate_rows = (0..MAX_CSV_ROWS)
        .map(|_| serde_json::json!([]))
        .collect::<Vec<_>>();
    contents["results"] = serde_json::json!([{
        "result_type": "duplicate_both",
        "key": ["duplicate-key"],
        "values_a": [],
        "values_b": [],
        "duplicate_values_a": duplicate_rows,
        "duplicate_values_b": (0..MAX_CSV_ROWS)
            .map(|_| serde_json::json!([]))
            .collect::<Vec<_>>(),
        "differences": []
    }]);

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_csv_row_limit_plus_one() {
    let mut contents = minimal_snapshot_contents();
    contents["file_b"]["row_count"] = serde_json::json!(MAX_CSV_ROWS + 1);
    contents["summary"]["total_rows_b"] = serde_json::json!(MAX_CSV_ROWS + 1);

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(body.contains(&format!(
        "Saved snapshot File B exceeds the {MAX_CSV_ROWS} row limit"
    )));
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
async fn comparison_snapshot_load_rejects_virtual_labels_missing_from_virtual_headers() {
    let mut contents = minimal_snapshot_contents();
    contents["selection"]["comparison_columns_a"] = serde_json::json!(["name.first"]);
    contents["mappings"][0]["file_a_column"] = serde_json::json!("name.first");

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(
        body.contains("name.first"),
        "expected the unknown virtual label to be reported, got: {body}"
    );
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_virtual_headers_without_source_column() {
    let mut contents = minimal_snapshot_contents();
    contents["file_a"]["virtual_headers"] = serde_json::json!(["missing_column.field"]);

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let body = response_text(load_response).await;
    assert!(
        body.contains("missing_column.field"),
        "expected the malformed virtual header to be reported, got: {body}"
    );
}

#[tokio::test]
async fn comparison_snapshot_load_accepts_virtual_labels_listed_in_virtual_headers() {
    let mut contents = minimal_snapshot_contents();
    contents["file_a"]["virtual_headers"] = serde_json::json!(["name.first"]);
    contents["selection"]["comparison_columns_a"] = serde_json::json!(["name.first"]);
    contents["mappings"][0]["file_a_column"] = serde_json::json!("name.first");

    let load_response = load_snapshot_contents(contents).await;

    assert_eq!(load_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_irrelevant_result_fields_instead_of_discarding_them() {
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
        Request::new(Body::from(contents)),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(load_response).await;
    assert!(
        json["error"]
            .as_str()
            .unwrap()
            .contains("missing_right result has contradictory fields")
    );
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
        Request::new(Body::from(contents)),
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
        Request::new(Body::from(contents)),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(load_response).await;
    assert_eq!(
        json["error"],
        "Saved comparison snapshot summary does not match the persisted results"
    );
}

#[tokio::test]
async fn comparison_snapshot_load_preserves_every_valid_prior_release_v2_result_variant() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../contracts/fixtures/compare-response.json")).unwrap();
    let mut snapshot = minimal_snapshot_contents();
    snapshot["file_a"]["row_count"] = fixture["summary"]["total_rows_a"].clone();
    snapshot["file_b"]["row_count"] = fixture["summary"]["total_rows_b"].clone();
    snapshot["results"] = fixture["results"].clone();
    snapshot["summary"] = fixture["summary"].clone();

    let response = load_snapshot_contents(snapshot).await;

    assert_eq!(response.status(), StatusCode::OK);
    let json = response_json(response).await;
    assert_eq!(json["results"].as_array().unwrap().len(), 9);
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_differences_outside_configured_mappings() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../contracts/fixtures/compare-response.json")).unwrap();
    let mut snapshot = minimal_snapshot_contents();
    snapshot["file_a"]["row_count"] = fixture["summary"]["total_rows_a"].clone();
    snapshot["file_b"]["row_count"] = fixture["summary"]["total_rows_b"].clone();
    snapshot["results"] = fixture["results"].clone();
    snapshot["summary"] = fixture["summary"].clone();
    snapshot["results"][1]["differences"][0]["column_a"] = serde_json::json!("unknown_name");

    let response = load_snapshot_contents(snapshot).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(
        json["error"],
        "Saved snapshot mismatch difference unknown_name -> display_name is outside the configured mappings"
    );
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_row_totals_not_represented_by_results() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../contracts/fixtures/compare-response.json")).unwrap();
    let mut snapshot = minimal_snapshot_contents();
    snapshot["file_a"]["row_count"] = serde_json::json!(9);
    snapshot["file_b"]["row_count"] = fixture["summary"]["total_rows_b"].clone();
    snapshot["results"] = fixture["results"].clone();
    snapshot["summary"] = fixture["summary"].clone();
    snapshot["summary"]["total_rows_a"] = serde_json::json!(9);

    let response = load_snapshot_contents(snapshot).await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(
        json["error"],
        "Saved snapshot results represent 8/8 File A/File B rows, but metadata declares 9/8"
    );
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_the_exact_result_conflict_matrix() {
    let difference = serde_json::json!({
        "column_a": "name",
        "column_b": "display_name",
        "value_a": "Alice",
        "value_b": "Alicia"
    });
    let cases = vec![
        (
            "match differences",
            serde_json::json!({
                "result_type":"match","key":["1"],"values_a":["Alice"],"values_b":["Alice"],
                "duplicate_values_a":[],"duplicate_values_b":[],"differences":[difference.clone()]
            }),
        ),
        (
            "mismatch duplicates",
            serde_json::json!({
                "result_type":"mismatch","key":["1"],"values_a":["Alice"],"values_b":["Alicia"],
                "duplicate_values_a":[["Alice"]],"duplicate_values_b":[],"differences":[difference]
            }),
        ),
        (
            "missing left values a",
            serde_json::json!({
                "result_type":"missing_left","key":["1"],"values_a":["stale"],"values_b":["right"],
                "duplicate_values_a":[],"duplicate_values_b":[],"differences":[]
            }),
        ),
        (
            "missing right values b",
            serde_json::json!({
                "result_type":"missing_right","key":["1"],"values_a":["left"],"values_b":["stale"],
                "duplicate_values_a":[],"duplicate_values_b":[],"differences":[]
            }),
        ),
        (
            "unkeyed left values a",
            serde_json::json!({
                "result_type":"unkeyed_left","key":[""],"values_a":["stale"],"values_b":["right"],
                "duplicate_values_a":[],"duplicate_values_b":[],"differences":[]
            }),
        ),
        (
            "unkeyed right values b",
            serde_json::json!({
                "result_type":"unkeyed_right","key":[""],"values_a":["left"],"values_b":["stale"],
                "duplicate_values_a":[],"duplicate_values_b":[],"differences":[]
            }),
        ),
        (
            "duplicate file a has file b duplicates",
            serde_json::json!({
                "result_type":"duplicate_file_a","key":["1"],"values_a":["left"],"values_b":["right"],
                "duplicate_values_a":[["left"],["left 2"]],"duplicate_values_b":[["right"]],"differences":[]
            }),
        ),
        (
            "duplicate file b has file a duplicates",
            serde_json::json!({
                "result_type":"duplicate_file_b","key":["1"],"values_a":["left"],"values_b":["right"],
                "duplicate_values_a":[["left"]],"duplicate_values_b":[["right"],["right 2"]],"differences":[]
            }),
        ),
        (
            "duplicate both lacks one side",
            serde_json::json!({
                "result_type":"duplicate_both","key":["1"],"values_a":["left"],"values_b":[],
                "duplicate_values_a":[["left"],["left 2"]],"duplicate_values_b":[],"differences":[]
            }),
        ),
        (
            "duplicate first row disagrees",
            serde_json::json!({
                "result_type":"duplicate_both","key":["1"],"values_a":["stale"],"values_b":["right"],
                "duplicate_values_a":[["left"],["left 2"]],"duplicate_values_b":[["right"],["right 2"]],"differences":[]
            }),
        ),
    ];

    for (name, result) in cases {
        let mut snapshot = minimal_snapshot_contents();
        snapshot["results"] = serde_json::json!([result]);
        let response = load_snapshot_contents(snapshot).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{name}");
        let json = response_json(response).await;
        assert!(
            json["error"]
                .as_str()
                .unwrap()
                .contains("contradictory fields"),
            "{name}: {json}"
        );
    }
}

#[tokio::test]
async fn comparison_snapshot_load_rejects_unknown_fields_at_every_v2_object_level_without_mutation()
{
    let mut baseline = minimal_snapshot_contents();
    baseline["results"] = serde_json::json!([{
        "result_type":"mismatch","key":["1"],"values_a":["Alice"],"values_b":["Alicia"],
        "duplicate_values_a":[],"duplicate_values_b":[],
        "differences":[{"column_a":"name","column_b":"display_name","value_a":"Alice","value_b":"Alicia"}]
    }]);
    baseline["normalization"]["date_normalization"] =
        serde_json::json!({"enabled":false,"formats":[]});
    baseline["normalization"]["decimal_rounding"] =
        serde_json::json!({"enabled":false,"decimals":0});

    let object_paths = [
        "",
        "/file_a",
        "/file_a/columns/0",
        "/selection",
        "/mappings/0",
        "/normalization",
        "/normalization/date_normalization",
        "/normalization/decimal_rounding",
        "/results/0",
        "/results/0/differences/0",
        "/summary",
    ];
    let state = AppState::new();
    let session_id = state.create_session();
    let mut sentinel = SessionData::new();
    sentinel.data_revision = 41;
    assert!(state.update_session(&session_id, sentinel));

    for path in object_paths {
        let mut snapshot = baseline.clone();
        let object = if path.is_empty() {
            snapshot.as_object_mut().unwrap()
        } else {
            snapshot.pointer_mut(path).unwrap().as_object_mut().unwrap()
        };
        object.insert("future_field".to_string(), serde_json::json!(true));

        let response = handlers::load_comparison_snapshot(
            State(state.clone()),
            Path(session_id.clone()),
            Request::new(Body::from(snapshot.to_string())),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{path}");
        let current = state.get_session(&session_id).unwrap();
        assert_eq!(current.data_revision, 41, "{path}");
        assert!(current.comparison_config.is_none(), "{path}");
        assert!(current.comparison_results.is_empty(), "{path}");
    }
}
