use axum::{
    body::{Body, to_bytes},
    http::{HeaderValue, Request, StatusCode, header},
};
use csv_align::api::{
    app::{build_app, frontend_dist_path_from},
    state::AppState,
};
use std::{io, path::PathBuf};
use tempfile::tempdir;
use tower::ServiceExt;

#[test]
fn frontend_dist_path_prefers_executable_relative_assets() {
    let exe_root = tempdir().expect("temp dir");
    let cwd_root = tempdir().expect("temp dir");
    let exe_path = exe_root.path().join("csv-align");
    let exe_dist = exe_root.path().join("frontend/dist");
    let cwd_dist = cwd_root.path().join("frontend/dist");

    std::fs::create_dir_all(&exe_dist).expect("create exe dist");
    std::fs::create_dir_all(&cwd_dist).expect("create cwd dist");

    let resolved = frontend_dist_path_from(&exe_path, cwd_root.path()).expect("resolved path");

    assert_eq!(resolved, exe_dist);
}

#[test]
fn frontend_dist_path_falls_back_to_current_directory_assets() {
    let exe_root = tempdir().expect("temp dir");
    let cwd_root = tempdir().expect("temp dir");
    let exe_path = exe_root.path().join("bin/csv-align");
    let cwd_dist = cwd_root.path().join("frontend/dist");

    std::fs::create_dir_all(&cwd_dist).expect("create cwd dist");

    let resolved = frontend_dist_path_from(&exe_path, cwd_root.path()).expect("resolved path");

    assert_eq!(resolved, cwd_dist);
}

#[test]
fn frontend_dist_path_reports_all_checked_locations_when_missing() {
    let exe_root = tempdir().expect("temp dir");
    let cwd_root = tempdir().expect("temp dir");
    let exe_path = exe_root.path().join("bin/csv-align");

    let error = frontend_dist_path_from(&exe_path, cwd_root.path()).expect_err("missing assets");
    let message = error.to_string();

    assert_eq!(error.kind(), io::ErrorKind::NotFound);
    assert!(message.contains("Build the frontend first"));
    assert!(
        message.contains(
            &PathBuf::from(exe_root.path())
                .join("bin/frontend/dist")
                .display()
                .to_string()
        )
    );
    assert!(message.contains(&cwd_root.path().join("frontend/dist").display().to_string()));
}

#[tokio::test]
async fn build_app_prefers_api_routes_over_static_fallback() {
    let frontend_root = tempdir().expect("temp dir");
    let frontend_dist = frontend_root.path().join("dist");
    std::fs::create_dir_all(&frontend_dist).expect("create dist");
    std::fs::write(
        frontend_dist.join("index.html"),
        "<html>static index</html>",
    )
    .expect("write index");

    let app = build_app(AppState::new(), &frontend_dist);
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .header("host", "127.0.0.1:3001")
                .header("origin", "http://127.0.0.1:3001")
                .header("sec-fetch-site", "same-origin")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body bytes");
    let body_text = String::from_utf8(body.to_vec()).expect("utf8");

    assert!(body_text.contains("\"status\":\"ok\""));
    assert!(!body_text.contains("static index"));
}

#[tokio::test]
async fn build_app_serves_index_html_from_static_fallback() {
    let frontend_root = tempdir().expect("temp dir");
    let frontend_dist = frontend_root.path().join("dist");
    std::fs::create_dir_all(&frontend_dist).expect("create dist");
    std::fs::write(
        frontend_dist.join("index.html"),
        "<html>static index</html>",
    )
    .expect("write index");

    let app = build_app(AppState::new(), &frontend_dist);
    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .header("host", "127.0.0.1:3001")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body bytes");
    let body_text = String::from_utf8(body.to_vec()).expect("utf8");

    assert!(body_text.contains("static index"));
}

#[tokio::test]
async fn loopback_security_allows_browser_vite_proxy_and_cli_requests() {
    let frontend_root = tempdir().expect("temp dir");
    let frontend_dist = frontend_root.path().join("dist");
    std::fs::create_dir_all(&frontend_dist).expect("create dist");
    std::fs::write(
        frontend_dist.join("index.html"),
        "<html>static index</html>",
    )
    .expect("write index");

    let app = build_app(AppState::new(), &frontend_dist);
    let accepted_headers = [
        vec![("host", "127.0.0.1:3001")],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "http://127.0.0.1:3001"),
            ("sec-fetch-site", "same-origin"),
        ],
        vec![
            ("host", "localhost:3001"),
            ("origin", "http://localhost:5173"),
            ("sec-fetch-site", "same-origin"),
        ],
        vec![
            ("host", "localhost:3001"),
            ("origin", "http://127.0.0.1:5173"),
            ("sec-fetch-site", "same-site"),
        ],
        vec![
            ("host", "[::1]:3001"),
            ("origin", "http://[::1]:3001"),
            ("sec-fetch-site", "none"),
        ],
    ];

    for headers in accepted_headers {
        let mut request = Request::builder().uri("/api/health");
        for (name, value) in headers {
            request = request.header(name, value);
        }

        let response = app
            .clone()
            .oneshot(request.body(Body::empty()).expect("request"))
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
    }
}

#[tokio::test]
async fn loopback_security_rejects_untrusted_requests_before_session_mutation() {
    let frontend_root = tempdir().expect("temp dir");
    let frontend_dist = frontend_root.path().join("dist");
    std::fs::create_dir_all(&frontend_dist).expect("create dist");
    std::fs::write(
        frontend_dist.join("index.html"),
        "<html>static index</html>",
    )
    .expect("write index");

    let state = AppState::new();
    let app = build_app(state.clone(), &frontend_dist);
    let rejected_headers = [
        vec![],
        vec![("host", "example.com:3001")],
        vec![("host", "localhost")],
        vec![("host", "127.0.0.1:3002")],
        vec![("host", "not an authority")],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "https://example.com"),
        ],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "https://127.0.0.1:3001"),
        ],
        vec![("host", "127.0.0.1:3001"), ("origin", "null")],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "http://127.0.0.1:3001/"),
        ],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "http://127.0.0.1:3001/path"),
        ],
        vec![("host", "127.0.0.1:3001"), ("sec-fetch-site", "cross-site")],
        vec![("host", "127.0.0.1:3001"), ("sec-fetch-site", "CROSS-SITE")],
        vec![
            ("host", "127.0.0.1:3001"),
            ("origin", "http://127.0.0.1:5174"),
        ],
    ];

    for headers in rejected_headers {
        let mut request = Request::builder().method("POST").uri("/api/sessions");
        for (name, value) in headers {
            request = request.header(name, value);
        }

        let response = app
            .clone()
            .oneshot(request.body(Body::empty()).expect("request"))
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("forbidden body");
        assert_eq!(body.as_ref(), b"Forbidden");
    }

    let mut duplicate_host = Request::builder()
        .method("POST")
        .uri("/api/sessions")
        .header(header::HOST, "127.0.0.1:3001")
        .body(Body::empty())
        .expect("request");
    duplicate_host
        .headers_mut()
        .append(header::HOST, HeaderValue::from_static("localhost:3001"));

    let mut duplicate_origin = Request::builder()
        .method("POST")
        .uri("/api/sessions")
        .header(header::HOST, "127.0.0.1:3001")
        .header(header::ORIGIN, "http://127.0.0.1:3001")
        .body(Body::empty())
        .expect("request");
    duplicate_origin.headers_mut().append(
        header::ORIGIN,
        HeaderValue::from_static("http://localhost:3001"),
    );

    for request in [duplicate_host, duplicate_origin] {
        let response = app.clone().oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    assert_eq!(state.store.session_count(), 0);
}
