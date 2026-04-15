use axum::{
    body::to_bytes,
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use csv_align::{
    api::{handlers, state::AppState},
    backend::{LoadPairOrderRequest, PairOrderSelection, SavePairOrderRequest, SessionData},
};
use serde_json::Value;

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
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]));
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]));
    assert!(state.update_session(&session_id, session).await);

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
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["id", "name", "value"]));
    session.csv_b = Some(csv_data(&["id", "full_name", "amount"]));
    assert!(state.update_session(&session_id, session).await);

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
        "Saved pair order does not match the currently loaded File B columns"
    );
}

#[tokio::test]
async fn pair_order_persistence_loads_when_matching_headers_are_reordered() {
    let state = AppState::new();
    let session_id = state.create_session().await;

    let mut session = SessionData::new();
    session.csv_a = Some(csv_data(&["value", "id", "name"]));
    session.csv_b = Some(csv_data(&["amount", "full_name", "id"]));
    assert!(state.update_session(&session_id, session).await);

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
