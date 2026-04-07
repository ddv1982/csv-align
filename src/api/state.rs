use crate::data::types::{ColumnInfo, ColumnMapping, ComparisonConfig, CsvData, RowComparisonResult, ComparisonSummary};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared application state for the API server
#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<RwLock<HashMap<String, SessionData>>>,
}

/// Data for a single comparison session
#[derive(Debug, Clone)]
pub struct SessionData {
    pub csv_a: Option<CsvData>,
    pub csv_b: Option<CsvData>,
    pub columns_a: Vec<ColumnInfo>,
    pub columns_b: Vec<ColumnInfo>,
    pub column_mappings: Vec<ColumnMapping>,
    pub comparison_config: Option<ComparisonConfig>,
    pub comparison_results: Vec<RowComparisonResult>,
    pub comparison_summary: Option<ComparisonSummary>,
}

impl SessionData {
    pub fn new() -> Self {
        Self {
            csv_a: None,
            csv_b: None,
            columns_a: Vec::new(),
            columns_b: Vec::new(),
            column_mappings: Vec::new(),
            comparison_config: None,
            comparison_results: Vec::new(),
            comparison_summary: None,
        }
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new session and return its ID
    pub async fn create_session(&self) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), SessionData::new());
        session_id
    }

    /// Get session data
    pub async fn get_session(&self, session_id: &str) -> Option<SessionData> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    /// Update session data
    pub async fn update_session(&self, session_id: &str, data: SessionData) -> bool {
        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(session_id) {
            sessions.insert(session_id.to_string(), data);
            true
        } else {
            false
        }
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id).is_some()
    }
}
