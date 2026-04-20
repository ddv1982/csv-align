use std::error::Error;
use std::net::SocketAddr;
use tracing::info;

use csv_align::api::{
    app::{build_app, frontend_dist_path},
    state::AppState,
};

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

    // Build the full app with static file serving.
    // API routes take priority, then fall back to static files.
    let app = build_app(state, &frontend_path);

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!(listen_url = %format!("http://{addr}"), "csv-align server starting");
    info!(frontend_path = %frontend_path.display(), "serving built frontend assets");
    info!(open_url = %format!("http://{addr}"), "open the app in your browser");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
