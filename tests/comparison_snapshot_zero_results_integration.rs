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

fn csv_data(headers: &[&str], file_name: &str) -> csv_align::data::types::CsvData {
    csv_align::data::types::CsvData {
        file_path: Some(file_name.to_string()),
        headers: headers.iter().map(|header| header.to_string()).collect(),
        rows: Vec::new(),
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
async fn comparison_snapshot_persistence_round_trips_zero_result_comparisons() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "full_name"], "left.csv").into());
    session.csv_b = Some(csv_data(&["record_id", "display_name"], "right.csv").into());
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
            normalization: ComparisonNormalizationConfig::default(),
        }),
    )
    .await;

    assert_eq!(compare_response.status(), StatusCode::OK);

    let export_response =
        handlers::export_csv(State(state.clone()), Path(session_id.clone())).await;
    assert_eq!(export_response.status(), StatusCode::OK);
    let exported_csv = response_text(export_response).await;
    assert!(exported_csv.contains("Key: id / record_id"));
    assert!(exported_csv.contains("File A: full_name"));
    assert!(exported_csv.contains("File B: display_name"));

    let save_response =
        handlers::save_comparison_snapshot(State(state.clone()), Path(session_id.clone())).await;

    assert_eq!(save_response.status(), StatusCode::OK);
    let contents = response_text(save_response).await;
    let saved: serde_json::Value = serde_json::from_str(&contents).unwrap();
    assert_eq!(saved["results"], serde_json::json!([]));
    assert_eq!(saved["summary"]["total_rows_a"], 0);
    assert_eq!(saved["summary"]["total_rows_b"], 0);
    assert_eq!(saved["summary"]["matches"], 0);
    assert_eq!(saved["summary"]["mismatches"], 0);

    let loaded_session_id = state.create_session();
    let load_response = handlers::load_comparison_snapshot(
        State(state.clone()),
        Path(loaded_session_id.clone()),
        Json(LoadComparisonSnapshotRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(json["file_a"]["name"], "left.csv");
    assert_eq!(json["file_b"]["name"], "right.csv");
    assert_eq!(json["results"], serde_json::json!([]));
    assert_eq!(json["summary"]["total_rows_a"], 0);
    assert_eq!(json["summary"]["total_rows_b"], 0);

    let restored_session = state
        .get_session(&loaded_session_id)
        .expect("loaded session should still exist");
    assert!(restored_session.comparison_results.is_empty());
    let comparison_config = restored_session
        .comparison_config
        .expect("loaded snapshot should restore the comparison config");
    assert_eq!(comparison_config.key_columns_a, vec!["id"]);
    assert_eq!(comparison_config.key_columns_b, vec!["record_id"]);
    assert_eq!(comparison_config.comparison_columns_a, vec!["full_name"]);
    assert_eq!(comparison_config.comparison_columns_b, vec!["display_name"]);
}
