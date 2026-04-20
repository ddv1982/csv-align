use axum::{
    Router,
    routing::{delete, get, post},
};
use std::io;
use std::path::{Path, PathBuf};
use tower_http::services::ServeDir;

use super::{handlers, state::AppState};

/// Get the path to the built frontend assets directory.
pub fn frontend_dist_path() -> io::Result<PathBuf> {
    let current_exe = std::env::current_exe()?;
    let current_dir = std::env::current_dir()?;

    frontend_dist_path_from(&current_exe, &current_dir)
}

pub fn frontend_dist_path_from(current_exe: &Path, current_dir: &Path) -> io::Result<PathBuf> {
    let exe_dir = current_exe.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            format!(
                "Failed to determine the executable directory for {}",
                current_exe.display()
            ),
        )
    })?;

    let exe_relative = exe_dir.join("frontend").join("dist");
    if exe_relative.exists() {
        return Ok(exe_relative);
    }

    let cwd_relative = current_dir.join("frontend").join("dist");
    if cwd_relative.exists() {
        return Ok(cwd_relative);
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        format!(
            "Could not find built frontend assets. Looked in '{}' and '{}'. Build the frontend first with `cd frontend && npm run build`.",
            exe_relative.display(),
            cwd_relative.display()
        ),
    ))
}

pub fn build_api_router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(handlers::health_check))
        .route("/api/sessions", post(handlers::create_session))
        .route(
            "/api/sessions/{session_id}",
            delete(handlers::delete_session),
        )
        .route(
            "/api/sessions/{session_id}/files/{file_letter}",
            post(handlers::load_csv_file),
        )
        .route(
            "/api/sessions/{session_id}/mappings",
            post(handlers::suggest_mappings),
        )
        .route(
            "/api/sessions/{session_id}/compare",
            post(handlers::compare),
        )
        .route(
            "/api/sessions/{session_id}/pair-order/save",
            post(handlers::save_pair_order),
        )
        .route(
            "/api/sessions/{session_id}/pair-order/load",
            post(handlers::load_pair_order),
        )
        .route(
            "/api/sessions/{session_id}/comparison-snapshot/save",
            post(handlers::save_comparison_snapshot),
        )
        .route(
            "/api/sessions/{session_id}/comparison-snapshot/load",
            post(handlers::load_comparison_snapshot),
        )
        .route(
            "/api/sessions/{session_id}/export",
            get(handlers::export_csv),
        )
        .with_state(state)
}

pub fn build_app(state: AppState, frontend_path: &Path) -> Router {
    Router::new()
        .merge(build_api_router(state))
        .fallback_service(ServeDir::new(frontend_path).append_index_html_on_directories(true))
}
