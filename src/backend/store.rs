use std::collections::{HashMap, VecDeque};

use parking_lot::RwLock;

use crate::backend::SessionData;

const DEFAULT_MAX_SESSIONS: usize = 128;

#[derive(Debug, Default)]
struct SessionStoreState {
    sessions: HashMap<String, SessionData>,
    insertion_order: VecDeque<String>,
}

/// In-memory session storage shared by the app transports.
///
/// This synchronous API is intentionally transport-agnostic so Axum can wrap it
/// in blocking helpers while Tauri can call it directly.
#[derive(Debug)]
pub struct SessionStore {
    state: RwLock<SessionStoreState>,
    max_sessions: usize,
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::with_max_sessions(DEFAULT_MAX_SESSIONS)
    }
}

impl SessionStore {
    pub fn with_max_sessions(max_sessions: usize) -> Self {
        Self {
            state: RwLock::new(SessionStoreState::default()),
            max_sessions: max_sessions.max(1),
        }
    }

    /// Creates a new empty session and returns its generated identifier.
    pub fn create(&self) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        let mut state = self.state.write();

        while state.sessions.len() >= self.max_sessions {
            let Some(oldest_session_id) = state.insertion_order.pop_front() else {
                break;
            };
            state.sessions.remove(&oldest_session_id);
        }

        state
            .sessions
            .insert(session_id.clone(), SessionData::new());
        state.insertion_order.push_back(session_id.clone());

        session_id
    }

    /// Deletes a session if it exists.
    pub fn delete(&self, id: &str) -> bool {
        let mut state = self.state.write();
        let removed = state.sessions.remove(id).is_some();

        if removed {
            state.insertion_order.retain(|session_id| session_id != id);
        }

        removed
    }

    pub fn session_count(&self) -> usize {
        self.state.read().sessions.len()
    }

    /// Runs a read-only closure against the session identified by `id`.
    pub fn with_session<R>(&self, id: &str, f: impl FnOnce(&SessionData) -> R) -> Option<R> {
        let state = self.state.read();
        state.sessions.get(id).map(f)
    }

    /// Runs a mutable closure against the session identified by `id`.
    pub fn with_session_mut<R>(
        &self,
        id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        let mut state = self.state.write();
        state.sessions.get_mut(id).map(f)
    }
}
