use axum::{
    Json,
    body::{Body, to_bytes},
    extract::{Path, State},
    http::{Request, StatusCode},
};
use csv_align::{
    api::{app::build_api_router, handlers, state::AppState},
    backend::{
        CsvAlignError, LoadPairOrderRequest, PairOrderSelection, SavePairOrderRequest, SessionData,
        ensure_pair_order_size,
        limits::{MAX_CSV_COLUMNS, MAX_PAIR_ORDER_BYTES, MAX_PAIR_ORDER_REQUEST_BYTES},
        load_pair_order_workflow, save_pair_order_workflow,
    },
};
use serde_json::Value;
use tower::ServiceExt;

fn csv_data(headers: &[&str]) -> csv_align::data::types::CsvData {
    csv_align::data::types::CsvData {
        file_path: None,
        headers: headers.iter().map(|header| header.to_string()).collect(),
        rows: vec![headers.iter().map(|header| header.to_string()).collect()],
    }
}

fn selection() -> PairOrderSelection {
    PairOrderSelection {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string(), "value".to_string()],
        comparison_columns_b: vec!["full_name".to_string(), "amount".to_string()],
    }
}

fn loaded_session() -> SessionData {
    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]).into());
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]).into());
    session.data_revision = 17;
    session
}

fn padded_contents(session: &SessionData, padding: char) -> String {
    let mut contents = save_pair_order_workflow(session, selection()).unwrap();
    contents.extend(std::iter::repeat_n(
        padding,
        MAX_PAIR_ORDER_BYTES - contents.len(),
    ));
    contents
}

#[test]
fn pair_order_exact_limit_loads_and_one_extra_byte_is_rejected_without_mutation() {
    let session = loaded_session();
    let before = format!("{session:?}");
    let mut contents = padded_contents(&session, ' ');
    assert_eq!(contents.len(), MAX_PAIR_ORDER_BYTES);
    assert_eq!(
        load_pair_order_workflow(&session, &contents)
            .unwrap()
            .selection,
        selection()
    );
    contents.push(' ');
    let error = load_pair_order_workflow(&session, &contents).unwrap_err();
    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert!(
        error
            .to_string()
            .contains(&format!("{} UTF-8 bytes", contents.len()))
    );
    assert_eq!(format!("{session:?}"), before);
    assert!(ensure_pair_order_size(MAX_PAIR_ORDER_BYTES).is_ok());
    assert!(ensure_pair_order_size(MAX_PAIR_ORDER_BYTES + 1).is_err());
}

#[test]
fn pair_order_limit_counts_utf8_bytes_not_characters() {
    let session = loaded_session();
    let saved = save_pair_order_workflow(&session, selection()).unwrap();
    let mut value: Value = serde_json::from_str(&saved).unwrap();
    value["extra"] = Value::String("é".repeat(MAX_PAIR_ORDER_BYTES / 2));
    let contents = value.to_string();
    assert!(contents.chars().count() < MAX_PAIR_ORDER_BYTES);
    assert!(contents.len() > MAX_PAIR_ORDER_BYTES);
    let error = load_pair_order_workflow(&session, &contents).unwrap_err();
    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert!(
        error
            .to_string()
            .contains(&format!("{} UTF-8 bytes", contents.len()))
    );
}

#[test]
fn pair_order_oversized_save_is_rejected_and_normal_save_reloads() {
    let session = loaded_session();
    let contents = save_pair_order_workflow(&session, selection()).unwrap();
    assert_eq!(
        load_pair_order_workflow(&session, &contents)
            .unwrap()
            .selection,
        selection()
    );

    let mut oversized = session;
    let header = "é".repeat(MAX_PAIR_ORDER_BYTES / 2);
    oversized.csv_a = Some(csv_data(&["id", "name", "value", &header]).into());
    let before = format!("{oversized:?}");
    let error = save_pair_order_workflow(&oversized, selection()).unwrap_err();
    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert!(
        error
            .to_string()
            .contains("pair-order file exceeds the 2 MiB limit")
    );
    assert_eq!(format!("{oversized:?}"), before);
}

#[test]
fn pair_order_wide_4096_column_selection_fits_and_reloads() {
    let headers: Vec<String> = (0..MAX_CSV_COLUMNS)
        .map(|index| format!("column_{index}"))
        .collect();
    let csv = csv_align::data::types::CsvData {
        file_path: None,
        headers: headers.clone(),
        rows: vec![],
    };
    let mut session = SessionData::new();
    session.csv_a = Some(csv.clone().into());
    session.csv_b = Some(csv.into());
    let selection = PairOrderSelection {
        key_columns_a: headers.clone(),
        key_columns_b: headers.clone(),
        comparison_columns_a: headers.clone(),
        comparison_columns_b: headers,
    };
    let contents = save_pair_order_workflow(&session, selection.clone()).unwrap();
    assert!(contents.len() < MAX_PAIR_ORDER_BYTES);
    assert_eq!(
        load_pair_order_workflow(&session, &contents)
            .unwrap()
            .selection,
        selection
    );
}

#[test]
fn pair_order_within_limit_preserves_version_first_errors() {
    let error = load_pair_order_workflow(&SessionData::new(), r#"{"version":999}"#).unwrap_err();
    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(error.to_string(), "Unsupported pair-order file version 999");
}

async fn router_post(router: axum::Router, path: &str, body: String) -> axum::response::Response {
    router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap()
}

#[tokio::test]
async fn pair_order_router_accepts_escaped_envelope_above_file_limit() {
    let state = AppState::new();
    let session_id = state.create_session();
    let session = loaded_session();
    let contents = padded_contents(&session, '\t');
    assert_eq!(contents.len(), MAX_PAIR_ORDER_BYTES);
    assert!(state.update_session(&session_id, session));
    let before = format!("{:?}", state.get_session(&session_id).unwrap());
    let body = serde_json::json!({"contents": contents}).to_string();
    assert!(body.len() > MAX_PAIR_ORDER_BYTES);
    assert!(body.len() < MAX_PAIR_ORDER_REQUEST_BYTES);
    let router = build_api_router(state.clone());
    let path = format!("/api/sessions/{session_id}/pair-order/load");
    let response = router_post(router.clone(), &path, body).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["selection"],
        serde_json::json!(selection())
    );

    let oversized = format!("{contents} ");
    let response = router_post(
        router,
        &path,
        serde_json::json!({"contents": oversized}).to_string(),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(
        response_json(response).await["error"]
            .as_str()
            .unwrap()
            .contains("2 MiB limit")
    );
    assert_eq!(
        format!("{:?}", state.get_session(&session_id).unwrap()),
        before
    );
}

#[tokio::test]
async fn pair_order_router_explicit_request_ceiling_applies_to_load_and_save() {
    let state = AppState::new();
    let session_id = state.create_session();
    let session = loaded_session();
    let contents = save_pair_order_workflow(&session, selection()).unwrap();
    assert!(state.update_session(&session_id, session));
    let before = format!("{:?}", state.get_session(&session_id).unwrap());
    let router = build_api_router(state.clone());
    for (operation, value) in [
        ("load", serde_json::json!({"contents": contents})),
        ("save", serde_json::json!({"selection": selection()})),
    ] {
        let path = format!("/api/sessions/{session_id}/pair-order/{operation}");
        let mut body = value.to_string();
        body.extend(std::iter::repeat_n(
            ' ',
            MAX_PAIR_ORDER_REQUEST_BYTES - body.len(),
        ));
        assert_eq!(body.len(), MAX_PAIR_ORDER_REQUEST_BYTES);
        let response = router_post(router.clone(), &path, body.clone()).await;
        assert_eq!(
            response.status(),
            StatusCode::OK,
            "{operation} at request ceiling"
        );
        if operation == "save" {
            let saved = response_text(response).await;
            assert!(saved.len() <= MAX_PAIR_ORDER_BYTES);
            assert_eq!(
                load_pair_order_workflow(&state.get_session(&session_id).unwrap(), &saved)
                    .unwrap()
                    .selection,
                selection()
            );
        }
        body.push(' ');
        let response = router_post(router.clone(), &path, body).await;
        assert_eq!(
            response.status(),
            StatusCode::PAYLOAD_TOO_LARGE,
            "{operation} above request ceiling"
        );
    }
    assert_eq!(
        format!("{:?}", state.get_session(&session_id).unwrap()),
        before
    );
}

#[test]
fn oversized_pair_order_is_rejected_before_json_parsing() {
    let error = csv_align::backend::load_pair_order_workflow(
        &SessionData::new(),
        &" ".repeat(2 * 1024 * 1024 + 1),
    )
    .unwrap_err();
    assert!(
        matches!(error, csv_align::backend::CsvAlignError::BadInput(_)),
        "{error}"
    );
    assert!(error.to_string().contains("pair-order"));
    assert!(error.to_string().contains("limit"));
}

async fn response_text(response: axum::response::Response) -> String {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    String::from_utf8(body.to_vec()).expect("response body should be utf-8")
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should be readable");
    serde_json::from_slice(&body).expect("response body should be valid json")
}

#[tokio::test]
async fn pair_order_persistence_round_trips_saved_selection_through_http_handlers() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]).into());
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]).into());
    assert!(state.update_session(&session_id, session));

    let save_response = handlers::save_pair_order(
        State(state.clone()),
        Path(session_id.clone()),
        Json(SavePairOrderRequest {
            selection: selection(),
        }),
    )
    .await;

    assert_eq!(save_response.status(), StatusCode::OK);
    let contents = response_text(save_response).await;
    let saved: Value = serde_json::from_str(&contents).expect("saved text should be valid json");
    assert_eq!(saved["version"], 1);
    assert_eq!(
        saved["headers_a"],
        serde_json::json!(["id", "name", "value"])
    );
    assert_eq!(
        saved["headers_b"],
        serde_json::json!(["id", "full_name", "amount"])
    );

    let load_response = handlers::load_pair_order(
        State(state),
        Path(session_id),
        Json(LoadPairOrderRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(
        json["selection"]["comparison_columns_a"],
        serde_json::json!(["name", "value"])
    );
    assert_eq!(
        json["selection"]["comparison_columns_b"],
        serde_json::json!(["full_name", "amount"])
    );
}

#[tokio::test]
async fn pair_order_persistence_rejects_saved_data_for_different_loaded_files() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]).into());
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]).into());
    assert!(state.update_session(&session_id, session));

    let contents = serde_json::json!({
        "version": 1,
        "headers_a": ["id", "name", "value"],
        "headers_b": ["id", "full_name", "other_amount"],
        "selection": selection(),
    })
    .to_string();

    let load_response = handlers::load_pair_order(
        State(state),
        Path(session_id),
        Json(LoadPairOrderRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(load_response).await;
    assert_eq!(
        json["error"],
        "Saved pair order does not match the currently loaded File B columns: missing from saved: amount; unexpected in saved: other_amount"
    );
}

#[tokio::test]
async fn pair_order_persistence_loads_when_matching_headers_are_reordered() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["value", "id", "name"]).into());
    session.csv_b = Some(csv_data(&["amount", "full_name", "id"]).into());
    assert!(state.update_session(&session_id, session));

    let contents = serde_json::json!({
        "version": 1,
        "headers_a": ["id", "name", "value"],
        "headers_b": ["id", "full_name", "amount"],
        "selection": selection(),
    })
    .to_string();

    let load_response = handlers::load_pair_order(
        State(state),
        Path(session_id),
        Json(LoadPairOrderRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::OK);
    let json = response_json(load_response).await;
    assert_eq!(
        json["selection"]["comparison_columns_a"],
        serde_json::json!(["name", "value"])
    );
    assert_eq!(
        json["selection"]["comparison_columns_b"],
        serde_json::json!(["full_name", "amount"])
    );
}

#[tokio::test]
async fn pair_order_persistence_rejects_unknown_version_with_contract_message() {
    let state = AppState::new();
    let session_id = state.create_session();

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]).into());
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]).into());
    assert!(state.update_session(&session_id, session));

    let contents = serde_json::json!({
        "version": 999,
        "headers_a": ["id", "name", "value"],
        "headers_b": ["id", "full_name", "amount"],
        "selection": selection(),
    })
    .to_string();

    let load_response = handlers::load_pair_order(
        State(state),
        Path(session_id),
        Json(LoadPairOrderRequest { contents }),
    )
    .await;

    assert_eq!(load_response.status(), StatusCode::BAD_REQUEST);
    let json = response_json(load_response).await;
    assert_eq!(json["error"], "Unsupported pair-order file version 999");
}
