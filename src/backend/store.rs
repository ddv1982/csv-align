use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use parking_lot::RwLock;

use crate::backend::SessionData;

const DEFAULT_MAX_SESSIONS: usize = 128;
const DEFAULT_IDLE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const DEFAULT_MAX_TOTAL_BYTES: usize = 512 * 1024 * 1024;

#[derive(Debug)]
struct SessionEntry {
    data: SessionData,
    last_accessed: Instant,
}

#[derive(Debug, Default)]
struct SessionStoreState {
    sessions: HashMap<String, SessionEntry>,
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
    idle_timeout: Duration,
    max_total_bytes: usize,
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::with_max_sessions(DEFAULT_MAX_SESSIONS)
    }
}

impl SessionStore {
    pub fn with_max_sessions(max_sessions: usize) -> Self {
        Self::with_limits(max_sessions, DEFAULT_IDLE_TIMEOUT, DEFAULT_MAX_TOTAL_BYTES)
    }

    pub fn with_limits(
        max_sessions: usize,
        idle_timeout: Duration,
        max_total_bytes: usize,
    ) -> Self {
        Self {
            state: RwLock::new(SessionStoreState::default()),
            max_sessions: max_sessions.max(1),
            idle_timeout,
            max_total_bytes: max_total_bytes.max(1),
        }
    }

    /// Creates a new empty session and returns its generated identifier.
    pub fn create(&self) -> String {
        let session_id = uuid::Uuid::new_v4().to_string();
        let mut state = self.state.write();
        let now = Instant::now();

        self.evict_idle_sessions(&mut state, now);

        while state.sessions.len() >= self.max_sessions {
            let Some(oldest_session_id) = state.insertion_order.pop_front() else {
                break;
            };
            state.sessions.remove(&oldest_session_id);
        }

        state.sessions.insert(
            session_id.clone(),
            SessionEntry {
                data: SessionData::new(),
                last_accessed: now,
            },
        );
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
        let mut state = self.state.write();
        self.evict_idle_sessions(&mut state, Instant::now());
        state.sessions.len()
    }

    /// Runs a read-only closure against the session identified by `id`.
    pub fn with_session<R>(&self, id: &str, f: impl FnOnce(&SessionData) -> R) -> Option<R> {
        let mut state = self.state.write();
        let now = Instant::now();
        self.evict_idle_sessions(&mut state, now);
        let entry = state.sessions.get_mut(id)?;
        entry.last_accessed = now;

        Some(f(&entry.data))
    }

    /// Runs a mutable closure against the session identified by `id`.
    pub fn with_session_mut<R>(
        &self,
        id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        let mut state = self.state.write();
        let now = Instant::now();
        self.evict_idle_sessions(&mut state, now);
        let result = {
            let entry = state.sessions.get_mut(id)?;
            entry.last_accessed = now;
            f(&mut entry.data)
        };
        self.evict_over_budget_sessions(&mut state, id);

        Some(result)
    }

    fn evict_idle_sessions(&self, state: &mut SessionStoreState, now: Instant) {
        if self.idle_timeout.is_zero() {
            return;
        }

        let idle_timeout = self.idle_timeout;
        state
            .sessions
            .retain(|_, entry| now.duration_since(entry.last_accessed) <= idle_timeout);
        state
            .insertion_order
            .retain(|session_id| state.sessions.contains_key(session_id));
    }

    fn evict_over_budget_sessions(&self, state: &mut SessionStoreState, protected_id: &str) {
        while total_session_bytes(state) > self.max_total_bytes {
            let Some(eviction_id) = state
                .sessions
                .iter()
                .filter(|(session_id, _)| session_id.as_str() != protected_id)
                .min_by_key(|(_, entry)| entry.last_accessed)
                .map(|(session_id, _)| session_id.clone())
            else {
                break;
            };

            state.sessions.remove(&eviction_id);
            state
                .insertion_order
                .retain(|session_id| session_id != &eviction_id);
        }
    }
}

fn total_session_bytes(state: &SessionStoreState) -> usize {
    state
        .sessions
        .values()
        .map(|entry| entry.data.estimated_size_bytes())
        .sum()
}
