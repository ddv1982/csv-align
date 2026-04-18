pub use crate::backend::SessionData;
use std::sync::Arc;

use crate::backend::SessionStore;

/// Shared application state for the API server
#[derive(Clone)]
pub struct AppState {
    pub store: Arc<SessionStore>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            store: Arc::new(SessionStore::default()),
        }
    }

    /// Create a new session and return its ID
    pub fn create_session(&self) -> String {
        self.store.create()
    }

    /// Read a session snapshot while holding the read lock briefly.
    pub fn with_session<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&SessionData) -> R,
    ) -> Option<R> {
        self.store.with_session(session_id, f)
    }

    /// Get session data.
    pub fn get_session(&self, session_id: &str) -> Option<SessionData> {
        self.with_session(session_id, Clone::clone)
    }

    /// Mutate a session in place while holding the write lock briefly.
    pub fn with_session_mut<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        self.store.with_session_mut(session_id, f)
    }

    /// Update session data.
    pub fn update_session(&self, session_id: &str, data: SessionData) -> bool {
        self.with_session_mut(session_id, |session| *session = data)
            .is_some()
    }

    /// Delete a session
    pub fn delete_session(&self, session_id: &str) -> bool {
        self.store.delete(session_id)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
