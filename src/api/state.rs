pub use crate::backend::SessionData;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared application state for the API server
#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<RwLock<HashMap<String, SessionData>>>,
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

    /// Read a session snapshot while holding the read lock briefly.
    pub async fn with_session<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&SessionData) -> R,
    ) -> Option<R> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(f)
    }

    /// Get session data.
    pub async fn get_session(&self, session_id: &str) -> Option<SessionData> {
        self.with_session(session_id, Clone::clone).await
    }

    /// Mutate a session in place while holding the write lock briefly.
    pub async fn with_session_mut<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        let mut sessions = self.sessions.write().await;
        sessions.get_mut(session_id).map(f)
    }

    /// Update session data.
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

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
