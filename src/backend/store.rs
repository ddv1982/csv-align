use std::collections::HashMap;

use parking_lot::RwLock;

use crate::backend::SessionData;

/// In-memory session storage shared by the app transports.
///
/// This synchronous API is intentionally transport-agnostic so Axum can wrap it
/// in blocking helpers while Tauri can call it directly.
#[derive(Debug, Default)]
pub struct SessionStore {
    sessions: RwLock<HashMap<String, SessionData>>,
}

impl SessionStore {
    /// Creates a new empty session and returns its generated identifier.
    pub fn create(&self) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        self.sessions
            .write()
            .insert(session_id.clone(), SessionData::new());
        session_id
    }

    /// Deletes a session if it exists.
    pub fn delete(&self, id: &str) -> bool {
        self.sessions.write().remove(id).is_some()
    }

    /// Runs a read-only closure against the session identified by `id`.
    pub fn with_session<R>(&self, id: &str, f: impl FnOnce(&SessionData) -> R) -> Option<R> {
        let sessions = self.sessions.read();
        sessions.get(id).map(f)
    }

    /// Runs a mutable closure against the session identified by `id`.
    pub fn with_session_mut<R>(
        &self,
        id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        let mut sessions = self.sessions.write();
        sessions.get_mut(id).map(f)
    }
}
