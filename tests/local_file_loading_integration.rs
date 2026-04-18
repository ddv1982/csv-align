use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
    routing::post,
};
use csv_align::api::{handlers, state::AppState};
use serde_json::Value;
use tower::ServiceExt;

fn local_file_router(state: AppState) -> Router {
    Router::new()
        .route(
            "/api/sessions/{session_id}/files/{file_letter}",
            post(handlers::load_csv_file),
        )
        .with_state(state)
}

fn multipart_request(uri: &str, boundary: &str, body: Vec<u8>) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header(
            "content-type",
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .expect("multipart request should build")
}

fn multipart_body(boundary: &str, file_name: &str, contents: &[u8]) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\nContent-Type: text/csv\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(contents);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    serde_json::from_slice(&body).expect("response body should be valid json")
}

#[tokio::test]
async fn local_file_loading_rejects_invalid_file_letters() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";
    let request = multipart_request(
        &format!("/api/sessions/{session_id}/files/c"),
        boundary,
        multipart_body(boundary, "left.csv", b"id,name\n1,Alice\n"),
    );

    let response = local_file_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(json["error"], "File letter must be 'a' or 'b'");
}

#[tokio::test]
async fn local_file_loading_rejects_missing_multipart_files() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";
    let request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        format!("--{boundary}--\r\n").into_bytes(),
    );

    let response = local_file_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(json["error"], "No file provided");
}

#[tokio::test]
async fn local_file_loading_rejects_malformed_multipart_payloads() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";
    let request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        b"this is not a valid multipart body".to_vec(),
    );

    let response = local_file_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    let error = json["error"]
        .as_str()
        .expect("error should serialize as a string");
    assert!(
        error.starts_with("Failed to read multipart:"),
        "expected multipart parsing failure, got {error}"
    );
}

#[tokio::test]
async fn local_file_loading_rejects_empty_csv_files() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";
    let request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        multipart_body(boundary, "empty.csv", b""),
    );

    let response = local_file_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(json["code"], "bad_input");
    assert_eq!(json["error"], "CSV file is empty");
}

#[tokio::test]
async fn local_file_loading_rejects_csv_rows_with_missing_columns() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";
    let request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        multipart_body(
            boundary,
            "broken.csv",
            b"id,name,city\n1,Alice,Paris\n2,Bob\n",
        ),
    );

    let response = local_file_router(state).oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(response).await;
    assert_eq!(json["code"], "parse");
    assert_eq!(
        json["error"],
        "Failed to parse CSV bytes: Row 3 has 2 columns, expected 3 columns"
    );
}

#[tokio::test]
async fn local_file_loading_persists_file_names_on_the_session() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";

    let left_request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        multipart_body(boundary, "left.csv", b"id,name\n1,Alice\n"),
    );
    let left_response = local_file_router(state.clone())
        .oneshot(left_request)
        .await
        .unwrap();
    assert_eq!(left_response.status(), StatusCode::OK);
    let left_json = response_json(left_response).await;
    assert_eq!(left_json["file_name"], "left.csv");

    let right_request = multipart_request(
        &format!("/api/sessions/{session_id}/files/b"),
        boundary,
        multipart_body(boundary, "right.csv", b"id,full_name\n1,Alice\n"),
    );
    let right_response = local_file_router(state.clone())
        .oneshot(right_request)
        .await
        .unwrap();
    assert_eq!(right_response.status(), StatusCode::OK);
    let right_json = response_json(right_response).await;
    assert_eq!(right_json["file_name"], "right.csv");

    let session = state
        .get_session(&session_id)
        .expect("session should still exist");
    assert_eq!(
        session
            .csv_a
            .as_ref()
            .and_then(|csv| csv.file_path.as_deref()),
        Some("left.csv")
    );
    assert_eq!(
        session
            .csv_b
            .as_ref()
            .and_then(|csv| csv.file_path.as_deref()),
        Some("right.csv")
    );
}

#[tokio::test]
async fn loading_the_second_local_file_populates_auto_suggested_mappings() {
    let state = AppState::new();
    let session_id = state.create_session();
    let boundary = "csv-align-boundary";

    let left_request = multipart_request(
        &format!("/api/sessions/{session_id}/files/a"),
        boundary,
        multipart_body(boundary, "left.csv", b"id,name\n1,Alice\n"),
    );
    let left_response = local_file_router(state.clone())
        .oneshot(left_request)
        .await
        .unwrap();
    assert_eq!(left_response.status(), StatusCode::OK);

    let after_first = state
        .get_session(&session_id)
        .expect("session should exist after the first local file load");
    assert!(after_first.column_mappings.is_empty());

    let right_request = multipart_request(
        &format!("/api/sessions/{session_id}/files/b"),
        boundary,
        multipart_body(boundary, "right.csv", b"id,full_name\n1,Alice\n"),
    );
    let right_response = local_file_router(state.clone())
        .oneshot(right_request)
        .await
        .unwrap();
    assert_eq!(right_response.status(), StatusCode::OK);

    let after_second = state
        .get_session(&session_id)
        .expect("session should exist after the second local file load");
    assert!(
        after_second
            .column_mappings
            .iter()
            .any(|mapping| { mapping.file_a_column == "id" && mapping.file_b_column == "id" })
    );
}
