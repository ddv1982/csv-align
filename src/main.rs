use axum::{
    Router,
    routing::{delete, get, post},
};
use std::error::Error;
use std::io;
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::services::ServeDir;
use tracing::info;

use csv_align::api::{handlers, state::AppState};

/// Get the path to the frontend dist directory
fn frontend_dist_path() -> io::Result<PathBuf> {
    // Look for frontend/dist relative to the executable or current directory
    let current_exe = std::env::current_exe()?;
    let exe_dir = current_exe.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            format!(
                "Failed to determine the executable directory for {}",
                current_exe.display()
            ),
        )
    })?;

    // Try relative to executable first (for installed apps)
    let exe_relative = exe_dir.join("frontend").join("dist");
    if exe_relative.exists() {
        return Ok(exe_relative);
    }

    // Try relative to current directory (for development)
    let cwd_relative = std::env::current_dir()?.join("frontend").join("dist");
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()?;

    // Create shared state
    let state = AppState::new();

    // Get frontend dist path
    let frontend_path = frontend_dist_path()?;

    info!(frontend_path = %frontend_path.display(), "resolved frontend dist path");

    // Build the API router
    let api_routes = Router::new()
        // Health check
        .route("/api/health", get(handlers::health_check))
        // Session management
        .route("/api/sessions", post(handlers::create_session))
        .route(
            "/api/sessions/{session_id}",
            delete(handlers::delete_session),
        )
        // CSV file loading
        .route(
            "/api/sessions/{session_id}/files/{file_letter}",
            post(handlers::load_csv_file),
        )
        // Column mappings
        .route(
            "/api/sessions/{session_id}/mappings",
            post(handlers::suggest_mappings),
        )
        // Comparison
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
        // Export
        .route(
            "/api/sessions/{session_id}/export",
            get(handlers::export_csv),
        )
        .with_state(state);

    // Build the full app with static file serving
    // API routes take priority, then fall back to static files
    let app = Router::new()
        .merge(api_routes)
        // Serve static files from frontend/dist
        .fallback_service(ServeDir::new(&frontend_path).append_index_html_on_directories(true));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!(listen_url = %format!("http://{addr}"), "csv-align server starting");
    info!(frontend_path = %frontend_path.display(), "serving built frontend assets");
    info!(open_url = %format!("http://{addr}"), "open the app in your browser");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
