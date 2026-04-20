use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
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
