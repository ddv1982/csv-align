use std::collections::BTreeMap;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use csv_align::{
    api::{
        app::{HTTP_TRANSPORT_OPERATIONS, TRANSPORT_PARITY_ROUTE_PATHS, build_api_router},
        state::AppState,
    },
    backend::limits,
};
use serde::Deserialize;
use tower::ServiceExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransportContract {
    operations: Vec<TransportOperation>,
    limits: BTreeMap<String, usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransportOperation {
    key: String,
    http: Option<HttpOperation>,
    tauri_command: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpOperation {
    method: String,
    path: String,
    #[serde(default)]
    request_body: Option<String>,
}

fn transport_contract() -> TransportContract {
    serde_json::from_str(include_str!("../contracts/transport-contract.json"))
        .expect("transport contract should be valid JSON")
}

fn frontend_transport_route_templates() -> Vec<&'static str> {
    include_str!("../frontend/src/services/apiRoutes.ts")
        .lines()
        .filter_map(|line| {
            line.split("path: '")
                .nth(1)
                .and_then(|path| path.split('\'').next())
        })
        .collect()
}

fn backend_transport_route_templates() -> Vec<String> {
    TRANSPORT_PARITY_ROUTE_PATHS
        .iter()
        .map(|route| frontend_path_template(route))
        .collect()
}

fn frontend_path_template(path: &str) -> String {
    path.replace("{session_id}", "{sessionId}")
        .replace("{file_letter}", "{fileLetter}")
}

#[test]
fn frontend_transport_routes_match_backend_transport_routes() {
    assert_eq!(
        frontend_transport_route_templates(),
        backend_transport_route_templates()
    );
}

#[test]
fn checked_contract_matches_backend_http_operations() {
    let contract_operations = transport_contract()
        .operations
        .into_iter()
        .filter_map(|operation| {
            operation.http.map(|http| {
                (
                    operation.key,
                    http.method,
                    http.path,
                    operation.tauri_command,
                )
            })
        })
        .collect::<Vec<_>>();

    let backend_operations = HTTP_TRANSPORT_OPERATIONS
        .iter()
        .map(|operation| {
            (
                operation.key.to_string(),
                operation.method.to_string(),
                frontend_path_template(operation.path),
            )
        })
        .collect::<Vec<_>>();

    assert_eq!(
        contract_operations
            .iter()
            .map(|(key, method, path, _)| (key.clone(), method.clone(), path.clone()))
            .collect::<Vec<_>>(),
        backend_operations
    );
    assert!(
        contract_operations
            .iter()
            .all(|(_, _, _, command)| !command.is_empty()),
        "every HTTP operation must also declare its Tauri command"
    );
    let load_snapshot = transport_contract()
        .operations
        .into_iter()
        .find(|operation| operation.key == "loadComparisonSnapshot")
        .and_then(|operation| operation.http)
        .expect("snapshot load HTTP operation should exist");
    assert_eq!(
        load_snapshot.request_body.as_deref(),
        Some("rawSnapshotJson")
    );
}

#[test]
fn checked_contract_matches_authoritative_backend_limits() {
    let expected = BTreeMap::from([
        ("rawCsvBytes".to_string(), limits::MAX_RAW_CSV_BYTES),
        ("decodedCsvBytes".to_string(), limits::MAX_DECODED_CSV_BYTES),
        ("csvColumns".to_string(), limits::MAX_CSV_COLUMNS),
        ("csvRows".to_string(), limits::MAX_CSV_ROWS),
        ("csvCells".to_string(), limits::MAX_CSV_CELLS),
        (
            "retainedCsvBytes".to_string(),
            limits::MAX_RETAINED_CSV_BYTES,
        ),
        (
            "comparisonResultsBytes".to_string(),
            limits::MAX_COMPARISON_RESULTS_BYTES,
        ),
        ("virtualLabels".to_string(), limits::MAX_VIRTUAL_LABELS),
        ("jsonPathDepth".to_string(), limits::MAX_JSON_PATH_DEPTH),
        (
            "retainedSessionBytes".to_string(),
            limits::MAX_RETAINED_SESSION_BYTES,
        ),
        ("snapshotBytes".to_string(), limits::MAX_SNAPSHOT_BYTES),
        ("htmlExportRows".to_string(), limits::MAX_HTML_EXPORT_ROWS),
        (
            "htmlExportDataBytes".to_string(),
            limits::MAX_HTML_EXPORT_DATA_BYTES,
        ),
        (
            "htmlExportDocumentBytes".to_string(),
            limits::MAX_HTML_EXPORT_DOCUMENT_BYTES,
        ),
    ]);

    assert_eq!(transport_contract().limits, expected);
    assert_eq!(limits::MAX_CSV_FILE_BYTES, limits::MAX_RAW_CSV_BYTES);
}

#[tokio::test]
async fn declared_http_methods_match_router_registration() {
    let router = build_api_router(AppState::new());

    for operation in HTTP_TRANSPORT_OPERATIONS {
        let path = operation
            .path
            .replace("{session_id}", "missing-session")
            .replace("{file_letter}", "a");
        let method = Method::from_bytes(operation.method.as_bytes())
            .expect("declared method should be valid");

        let response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(&path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_ne!(
            response.status(),
            StatusCode::METHOD_NOT_ALLOWED,
            "{} {} is not registered",
            operation.method,
            operation.path
        );

        let wrong_method_response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::PATCH)
                    .uri(&path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            wrong_method_response.status(),
            StatusCode::METHOD_NOT_ALLOWED,
            "unexpected PATCH registration for {}",
            operation.path
        );
    }
}
