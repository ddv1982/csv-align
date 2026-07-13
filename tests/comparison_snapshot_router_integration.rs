use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use csv_align::{
    api::{app::build_api_router, state::AppState},
    backend::{SessionData, ensure_snapshot_size, limits::MAX_SNAPSHOT_BYTES},
};
use tower::ServiceExt;

fn snapshot_router(state: AppState) -> Router {
    build_api_router(state)
}

fn minimal_snapshot_with_file_name(file_name: String) -> serde_json::Value {
    serde_json::json!({
        "version": 2,
        "file_a": {
            "name": file_name,
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
        "normalization": {},
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

#[tokio::test]
async fn router_loads_snapshot_json_larger_than_axum_default_body_limit() {
    let state = AppState::new();
    let session_id = state.create_session();
    let snapshot = minimal_snapshot_with_file_name("left.csv".repeat(300_000));
    let request_body = snapshot.to_string();

    assert!(
        request_body.len() > 2 * 1024 * 1024,
        "request should exceed Axum's default JSON body limit"
    );

    let request = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/sessions/{session_id}/comparison-snapshot/load"
        ))
        .header("content-type", "application/json")
        .body(Body::from(request_body))
        .expect("snapshot request should build");

    let response = snapshot_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[test]
fn shared_snapshot_limit_accepts_exactly_128_mib_and_rejects_one_byte_more() {
    assert!(ensure_snapshot_size(MAX_SNAPSHOT_BYTES).is_ok());
    assert!(ensure_snapshot_size(MAX_SNAPSHOT_BYTES + 1).is_err());
}

#[tokio::test]
async fn router_rejects_snapshot_content_length_above_the_shared_limit_without_mutation() {
    let state = AppState::new();
    let session_id = state.create_session();
    let mut sentinel = SessionData::new();
    sentinel.data_revision = 17;
    assert!(state.update_session(&session_id, sentinel));

    let request = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/sessions/{session_id}/comparison-snapshot/load"
        ))
        .header("content-type", "application/json")
        .header("content-length", (MAX_SNAPSHOT_BYTES + 1).to_string())
        .body(Body::empty())
        .unwrap();
    let response = snapshot_router(state.clone())
        .oneshot(request)
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let current = state.get_session(&session_id).unwrap();
    assert_eq!(current.data_revision, 17);
    assert!(current.comparison_config.is_none());
}

#[tokio::test]
async fn router_rejects_the_removed_contents_envelope() {
    let state = AppState::new();
    let session_id = state.create_session();
    let raw_snapshot = minimal_snapshot_with_file_name("left.csv".to_string()).to_string();
    let envelope = serde_json::json!({"contents": raw_snapshot}).to_string();
    let request = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/sessions/{session_id}/comparison-snapshot/load"
        ))
        .header("content-type", "application/json")
        .body(Body::from(envelope))
        .unwrap();

    let response = snapshot_router(state).oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
