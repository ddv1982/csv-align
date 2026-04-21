use axum::{
    Router,
    routing::{delete, get, post},
};
use std::io;
use std::path::{Path, PathBuf};
use tower_http::services::ServeDir;

use super::{handlers, state::AppState};

pub const CREATE_SESSION_ROUTE: &str = "/api/sessions";
pub const DELETE_SESSION_ROUTE: &str = "/api/sessions/{session_id}";
pub const LOAD_CSV_ROUTE: &str = "/api/sessions/{session_id}/files/{file_letter}";
pub const SUGGEST_MAPPINGS_ROUTE: &str = "/api/sessions/{session_id}/mappings";
pub const COMPARE_ROUTE: &str = "/api/sessions/{session_id}/compare";
pub const EXPORT_RESULTS_ROUTE: &str = "/api/sessions/{session_id}/export";
pub const SAVE_PAIR_ORDER_ROUTE: &str = "/api/sessions/{session_id}/pair-order/save";
pub const LOAD_PAIR_ORDER_ROUTE: &str = "/api/sessions/{session_id}/pair-order/load";
pub const SAVE_COMPARISON_SNAPSHOT_ROUTE: &str =
    "/api/sessions/{session_id}/comparison-snapshot/save";
pub const LOAD_COMPARISON_SNAPSHOT_ROUTE: &str =
    "/api/sessions/{session_id}/comparison-snapshot/load";

pub const TRANSPORT_PARITY_ROUTE_PATHS: &[&str] = &[
    CREATE_SESSION_ROUTE,
    DELETE_SESSION_ROUTE,
    LOAD_CSV_ROUTE,
    SUGGEST_MAPPINGS_ROUTE,
    COMPARE_ROUTE,
    EXPORT_RESULTS_ROUTE,
    SAVE_PAIR_ORDER_ROUTE,
    LOAD_PAIR_ORDER_ROUTE,
    SAVE_COMPARISON_SNAPSHOT_ROUTE,
    LOAD_COMPARISON_SNAPSHOT_ROUTE,
];

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
        .route(CREATE_SESSION_ROUTE, post(handlers::create_session))
        .route(DELETE_SESSION_ROUTE, delete(handlers::delete_session))
        .route(LOAD_CSV_ROUTE, post(handlers::load_csv_file))
        .route(SUGGEST_MAPPINGS_ROUTE, post(handlers::suggest_mappings))
        .route(COMPARE_ROUTE, post(handlers::compare))
        .route(SAVE_PAIR_ORDER_ROUTE, post(handlers::save_pair_order))
        .route(LOAD_PAIR_ORDER_ROUTE, post(handlers::load_pair_order))
        .route(
            SAVE_COMPARISON_SNAPSHOT_ROUTE,
            post(handlers::save_comparison_snapshot),
        )
        .route(
            LOAD_COMPARISON_SNAPSHOT_ROUTE,
            post(handlers::load_comparison_snapshot),
        )
        .route(EXPORT_RESULTS_ROUTE, get(handlers::export_csv))
        .with_state(state)
}

pub fn build_app(state: AppState, frontend_path: &Path) -> Router {
    Router::new()
        .merge(build_api_router(state))
        .fallback_service(ServeDir::new(frontend_path).append_index_html_on_directories(true))
}
