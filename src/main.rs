use axum::{
    routing::{delete, get, post},
    Router,
};
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::services::ServeDir;

use csv_align::api::{handlers, state::AppState};

/// Get the path to the frontend dist directory
fn frontend_dist_path() -> PathBuf {
    // Look for frontend/dist relative to the executable or current directory
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    // Try relative to executable first (for installed apps)
    let exe_relative = exe_dir.join("frontend").join("dist");
    if exe_relative.exists() {
        return exe_relative;
    }

    // Try relative to current directory (for development)
    let cwd_relative = std::env::current_dir()
        .unwrap_or_default()
        .join("frontend")
        .join("dist");
    if cwd_relative.exists() {
        return cwd_relative;
    }

    // Fallback - just use the relative path
    PathBuf::from("frontend/dist")
}

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init();

    // Create shared state
    let state = AppState::new();

    // Get frontend dist path
    let frontend_path = frontend_dist_path();

    println!("Frontend path: {frontend_path:?}");

    // Build the API router
    let api_routes = Router::new()
        // Health check
        .route("/api/health", get(handlers::health_check))
        // Session management
        .route("/api/sessions", post(handlers::create_session))
        .route(
            "/api/sessions/:session_id",
            delete(handlers::delete_session),
        )
        // CSV file loading
        .route(
            "/api/sessions/:session_id/files/:file_letter",
            post(handlers::load_csv_file),
        )
        // Column mappings
        .route(
            "/api/sessions/:session_id/mappings",
            post(handlers::suggest_mappings),
        )
        // Comparison
        .route("/api/sessions/:session_id/compare", post(handlers::compare))
        .route(
            "/api/sessions/:session_id/pair-order/save",
            post(handlers::save_pair_order),
        )
        .route(
            "/api/sessions/:session_id/pair-order/load",
            post(handlers::load_pair_order),
        )
        .route(
            "/api/sessions/:session_id/comparison-snapshot/save",
            post(handlers::save_comparison_snapshot),
        )
        .route(
            "/api/sessions/:session_id/comparison-snapshot/load",
            post(handlers::load_comparison_snapshot),
        )
        // Export
        .route(
            "/api/sessions/:session_id/export",
            get(handlers::export_csv),
        )
        .with_state(state);

    // Build the full app with static file serving
    // API routes take priority, then fall back to static files
    let app = Router::new()
        .merge(api_routes)
        // Serve static files from frontend/dist
        .fallback_service(ServeDir::new(frontend_path).append_index_html_on_directories(true));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("CSV Align server listening on http://{addr}");
    println!("Open http://{addr} in your browser to use the app");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
