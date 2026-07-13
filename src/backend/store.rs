use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
};
use std::time::{Duration, Instant};

use parking_lot::{RwLock, RwLockWriteGuard};

use crate::backend::operation::{OperationState, OperationStateError};
use crate::backend::{CsvAlignError, OperationKind, OperationToken, SessionData};

const DEFAULT_MAX_SESSIONS: usize = 128;
const DEFAULT_IDLE_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const DEFAULT_MAX_TOTAL_BYTES: usize = 512 * 1024 * 1024;

#[derive(Debug, Default)]
struct EntryControl {
    operations: OperationState,
}

#[derive(Debug)]
struct SessionEntry {
    id: u64,
    creation_sequence: u64,
    control: RwLock<EntryControl>,
    data: RwLock<SessionData>,
    last_activity_ns: AtomicU64,
    last_activity_sequence: AtomicU64,
    retained_size_bytes: AtomicUsize,
    cleanup_retry: AtomicBool,
}

impl SessionEntry {
    fn new(id: u64, creation_sequence: u64, data: SessionData) -> Self {
        let retained_size_bytes = data.retained_size_bytes();
        Self {
            id,
            creation_sequence,
            control: RwLock::new(EntryControl::default()),
            data: RwLock::new(data),
            last_activity_ns: AtomicU64::new(0),
            last_activity_sequence: AtomicU64::new(0),
            retained_size_bytes: AtomicUsize::new(retained_size_bytes),
            cleanup_retry: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Default)]
struct SessionIndex {
    sessions: HashMap<String, Arc<SessionEntry>>,
}

/// Publishes retained-size metadata even if a mutation callback unwinds.
struct SessionDataWrite<'a> {
    guard: RwLockWriteGuard<'a, SessionData>,
    retained_size_bytes: &'a AtomicUsize,
}

impl Deref for SessionDataWrite<'_> {
    type Target = SessionData;

    fn deref(&self) -> &Self::Target {
        &self.guard
    }
}

impl DerefMut for SessionDataWrite<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.guard
    }
}

impl Drop for SessionDataWrite<'_> {
    fn drop(&mut self) {
        self.retained_size_bytes
            .store(self.guard.retained_size_bytes(), Ordering::Release);
    }
}

/// In-memory session storage shared by the app transports.
///
/// Lock ordering is strict:
/// 1. clone an entry under the short-held index lock, then release the index;
/// 2. acquire that entry's control lock;
/// 3. briefly reacquire the index only to revalidate Arc identity;
/// 4. release the index before acquiring the entry data lock.
///
/// No path waits for an entry lock while holding the index, and eviction reads
/// only atomic entry metadata. Callbacks must not re-enter this store for the
/// same session because entry locks are intentionally not reentrant.
#[derive(Debug)]
pub struct SessionStore {
    index: RwLock<SessionIndex>,
    max_sessions: usize,
    idle_timeout: Duration,
    max_total_bytes: usize,
    clock_origin: Instant,
    next_entry_id: AtomicU64,
    next_activity_sequence: AtomicU64,
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
            index: RwLock::new(SessionIndex::default()),
            max_sessions: max_sessions.max(1),
            idle_timeout,
            max_total_bytes: max_total_bytes.max(1),
            clock_origin: Instant::now(),
            next_entry_id: AtomicU64::new(0),
            next_activity_sequence: AtomicU64::new(0),
        }
    }

    /// Creates a new empty session and returns its generated identifier.
    pub fn create(&self) -> String {
        self.evict_idle_sessions();

        let session_id = uuid::Uuid::new_v4().to_string();
        let entry_id = next_saturating(&self.next_entry_id);
        let entry = Arc::new(SessionEntry::new(entry_id, entry_id, SessionData::new()));
        self.touch(&entry);

        loop {
            let candidate = {
                let mut index = self.index.write();
                if index.sessions.len() < self.max_sessions {
                    index
                        .sessions
                        .insert(session_id.clone(), Arc::clone(&entry));
                    None
                } else {
                    oldest_created(&index.sessions)
                }
            };

            let Some((candidate_id, candidate_entry)) = candidate else {
                break;
            };
            let _candidate_control = candidate_entry.control.write();
            let mut index = self.index.write();

            if index.sessions.len() < self.max_sessions {
                index
                    .sessions
                    .insert(session_id.clone(), Arc::clone(&entry));
                break;
            }

            let current_oldest = oldest_created(&index.sessions);
            if current_oldest.as_ref().is_some_and(|(id, current)| {
                id == &candidate_id && Arc::ptr_eq(current, &candidate_entry)
            }) {
                index.sessions.remove(&candidate_id);
                index
                    .sessions
                    .insert(session_id.clone(), Arc::clone(&entry));
                break;
            }
        }

        self.evict_over_budget_sessions(Some((&session_id, &entry)));
        session_id
    }

    /// Deletes a session if it exists. Removal waits for active work on that
    /// entry, then revalidates identity so a stale Arc cannot remove a newer one.
    pub fn delete(&self, id: &str) -> bool {
        let Some(entry) = self.lookup_without_eviction(id) else {
            return false;
        };
        self.delete_after_lookup(id, entry)
    }

    fn delete_after_lookup(&self, id: &str, entry: Arc<SessionEntry>) -> bool {
        let _control = entry.control.write();
        let mut index = self.index.write();
        if is_current(&index, id, &entry) {
            index.sessions.remove(id);
            true
        } else {
            false
        }
    }

    pub fn session_count(&self) -> usize {
        self.evict_idle_sessions();
        self.index.read().sessions.len()
    }

    /// Runs a read-only closure against the session identified by `id`.
    pub fn with_session<R>(&self, id: &str, f: impl FnOnce(&SessionData) -> R) -> Option<R> {
        self.evict_idle_sessions();
        let entry = self.lookup_without_eviction(id)?;
        let _control = entry.control.read();
        if !self.revalidate_and_touch(id, &entry) {
            return None;
        }

        let data = entry.data.read();
        let result = f(&data);
        drop(data);
        drop(_control);
        self.retry_cleanup_after_release(&entry);
        Some(result)
    }

    /// Runs a mutable closure against the session identified by `id`.
    pub fn with_session_mut<R>(
        &self,
        id: &str,
        f: impl FnOnce(&mut SessionData) -> R,
    ) -> Option<R> {
        self.evict_idle_sessions();
        let entry = self.lookup_without_eviction(id)?;
        let control = entry.control.read();
        if !self.revalidate_and_touch(id, &entry) {
            return None;
        }

        let mut data = SessionDataWrite {
            guard: entry.data.write(),
            retained_size_bytes: &entry.retained_size_bytes,
        };
        let result = f(&mut data);
        drop(data);
        drop(control);

        self.retry_cleanup_after_release(&entry);
        self.evict_over_budget_sessions(Some((id, &entry)));
        Some(result)
    }

    /// Atomically validates/snapshots committed session data and then issues a
    /// runtime-only operation claim.
    pub fn begin_operation<R>(
        &self,
        id: &str,
        kind: OperationKind,
        snapshot: impl FnOnce(&SessionData) -> Result<R, CsvAlignError>,
    ) -> Result<(OperationToken, R), CsvAlignError> {
        self.evict_idle_sessions();
        let entry = self
            .lookup_without_eviction(id)
            .ok_or_else(session_not_found)?;
        let mut control = entry.control.write();
        if !self.revalidate_and_touch(id, &entry) {
            return Err(session_not_found());
        }

        let data = entry.data.read();
        let outcome = snapshot(&data).and_then(|snapshot| {
            control
                .operations
                .issue(entry.id, kind)
                .map_err(operation_state_error)
                .map(|token| (token, snapshot))
        });
        drop(data);
        drop(control);
        self.retry_cleanup_after_release(&entry);
        outcome
    }

    /// Consumes an operation claim before running its guarded commit. The
    /// lookup and Arc identity check are fresh, so deleted/evicted entries are
    /// never mutated or reinserted. A failed commit remains single-use.
    pub fn commit_operation<R>(
        &self,
        id: &str,
        token: OperationToken,
        commit: impl FnOnce(&mut SessionData) -> Result<R, CsvAlignError>,
    ) -> Result<R, CsvAlignError> {
        self.evict_idle_sessions();
        let entry = self
            .lookup_without_eviction(id)
            .ok_or(CsvAlignError::Superseded)?;
        let mut control = entry.control.write();
        if !self.revalidate_and_touch(id, &entry) || token.entry_id() != entry.id {
            return Err(CsvAlignError::Superseded);
        }

        if control.operations.consume(token).is_err() {
            drop(control);
            self.retry_cleanup_after_release(&entry);
            return Err(CsvAlignError::Superseded);
        }

        let mut data = SessionDataWrite {
            guard: entry.data.write(),
            retained_size_bytes: &entry.retained_size_bytes,
        };
        let result = commit(&mut data);
        drop(data);
        drop(control);

        self.retry_cleanup_after_release(&entry);
        self.evict_over_budget_sessions(Some((id, &entry)));
        result
    }

    fn lookup_without_eviction(&self, id: &str) -> Option<Arc<SessionEntry>> {
        self.index.read().sessions.get(id).cloned()
    }

    fn revalidate_and_touch(&self, id: &str, entry: &Arc<SessionEntry>) -> bool {
        let index = self.index.read();
        if !is_current(&index, id, entry) {
            return false;
        }
        self.touch(entry);
        true
    }

    fn touch(&self, entry: &SessionEntry) {
        entry
            .last_activity_ns
            .fetch_max(self.now_ns(), Ordering::Release);
        entry.last_activity_sequence.fetch_max(
            next_saturating(&self.next_activity_sequence),
            Ordering::Release,
        );
    }

    fn now_ns(&self) -> u64 {
        u64::try_from(self.clock_origin.elapsed().as_nanos()).unwrap_or(u64::MAX)
    }

    fn evict_idle_sessions(&self) {
        if self.idle_timeout.is_zero() {
            return;
        }

        let timeout_ns = u64::try_from(self.idle_timeout.as_nanos()).unwrap_or(u64::MAX);
        loop {
            let now_ns = self.now_ns();
            let candidates = {
                let index = self.index.read();
                least_recently_used_candidates(&index.sessions, None)
                    .into_iter()
                    .filter(|(_, entry, _)| {
                        now_ns.saturating_sub(entry.last_activity_ns.load(Ordering::Acquire))
                            > timeout_ns
                    })
                    .collect::<Vec<_>>()
            };
            if candidates.is_empty() {
                return;
            }

            let mut removed = false;
            for (candidate_id, candidate_entry, activity_sequence) in candidates {
                let Some(control) = self.try_lock_eviction_candidate(&candidate_entry) else {
                    continue;
                };
                let removed_candidate = {
                    let mut index = self.index.write();
                    let still_idle = now_ns
                        .saturating_sub(candidate_entry.last_activity_ns.load(Ordering::Acquire))
                        > timeout_ns;
                    let activity_unchanged = candidate_entry
                        .last_activity_sequence
                        .load(Ordering::Acquire)
                        == activity_sequence;
                    if is_current(&index, &candidate_id, &candidate_entry)
                        && still_idle
                        && activity_unchanged
                    {
                        index.sessions.remove(&candidate_id);
                        true
                    } else {
                        false
                    }
                };
                drop(control);
                self.retry_cleanup_after_release(&candidate_entry);
                if removed_candidate {
                    removed = true;
                    break;
                }
            }

            if !removed {
                return;
            }
        }
    }

    fn evict_over_budget_sessions(&self, protected: Option<(&str, &Arc<SessionEntry>)>) {
        loop {
            let candidates = {
                let index = self.index.read();
                if protected.is_some_and(|(id, entry)| !is_current(&index, id, entry))
                    || total_session_bytes(&index) <= self.max_total_bytes
                {
                    return;
                }
                least_recently_used_candidates(&index.sessions, protected)
            };
            if candidates.is_empty() {
                return;
            }

            let mut removed = false;
            for (candidate_id, candidate_entry, activity_sequence) in candidates {
                let Some(control) = self.try_lock_eviction_candidate(&candidate_entry) else {
                    continue;
                };
                let (stop, removed_candidate) = {
                    let mut index = self.index.write();
                    if protected.is_some_and(|(id, entry)| !is_current(&index, id, entry))
                        || total_session_bytes(&index) <= self.max_total_bytes
                    {
                        (true, false)
                    } else {
                        let activity_unchanged = candidate_entry
                            .last_activity_sequence
                            .load(Ordering::Acquire)
                            == activity_sequence;
                        let remove = is_current(&index, &candidate_id, &candidate_entry)
                            && activity_unchanged;
                        if remove {
                            index.sessions.remove(&candidate_id);
                        }
                        (false, remove)
                    }
                };
                drop(control);
                self.retry_cleanup_after_release(&candidate_entry);
                if stop {
                    return;
                }
                if removed_candidate {
                    removed = true;
                    break;
                }
            }

            if !removed {
                return;
            }
        }
    }

    fn try_lock_eviction_candidate<'a>(
        &self,
        entry: &'a SessionEntry,
    ) -> Option<RwLockWriteGuard<'a, EntryControl>> {
        entry.control.try_write().or_else(|| {
            entry.cleanup_retry.store(true, Ordering::Release);
            entry.control.try_write()
        })
    }

    fn retry_cleanup_after_release(&self, entry: &SessionEntry) {
        if entry.cleanup_retry.swap(false, Ordering::AcqRel) {
            self.evict_idle_sessions();
            self.evict_over_budget_sessions(None);
        }
    }
}

fn session_not_found() -> CsvAlignError {
    CsvAlignError::NotFound {
        resource: "Session".to_string(),
    }
}

fn operation_state_error(error: OperationStateError) -> CsvAlignError {
    match error {
        OperationStateError::SequenceExhausted => {
            CsvAlignError::Internal("Session operation sequence exhausted".to_string())
        }
        OperationStateError::Superseded => {
            unreachable!("issuing a claim cannot supersede itself")
        }
    }
}

fn next_saturating(counter: &AtomicU64) -> u64 {
    counter
        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |current| {
            Some(current.saturating_add(1))
        })
        .unwrap_or_else(|current| current)
        .saturating_add(1)
}

fn is_current(index: &SessionIndex, id: &str, entry: &Arc<SessionEntry>) -> bool {
    index
        .sessions
        .get(id)
        .is_some_and(|current| Arc::ptr_eq(current, entry))
}

fn oldest_created(
    sessions: &HashMap<String, Arc<SessionEntry>>,
) -> Option<(String, Arc<SessionEntry>)> {
    sessions
        .iter()
        .min_by_key(|(id, entry)| (entry.creation_sequence, id.as_str()))
        .map(|(id, entry)| (id.clone(), Arc::clone(entry)))
}

fn least_recently_used_candidates(
    sessions: &HashMap<String, Arc<SessionEntry>>,
    protected: Option<(&str, &Arc<SessionEntry>)>,
) -> Vec<(String, Arc<SessionEntry>, u64)> {
    let mut candidates = sessions
        .iter()
        .filter(|(id, entry)| {
            !protected.is_some_and(|(protected_id, protected_entry)| {
                id.as_str() == protected_id && Arc::ptr_eq(entry, protected_entry)
            })
        })
        .map(|(id, entry)| {
            (
                id.clone(),
                Arc::clone(entry),
                entry.last_activity_sequence.load(Ordering::Acquire),
            )
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        (left.2, left.1.creation_sequence, left.0.as_str()).cmp(&(
            right.2,
            right.1.creation_sequence,
            right.0.as_str(),
        ))
    });
    candidates
}

#[cfg(test)]
fn least_recently_used(
    sessions: &HashMap<String, Arc<SessionEntry>>,
    protected: Option<(&str, &Arc<SessionEntry>)>,
) -> Option<(String, Arc<SessionEntry>)> {
    least_recently_used_candidates(sessions, protected)
        .into_iter()
        .next()
        .map(|(id, entry, _)| (id, entry))
}

fn total_session_bytes(index: &SessionIndex) -> usize {
    index.sessions.values().fold(0usize, |total, entry| {
        total.saturating_add(entry.retained_size_bytes.load(Ordering::Acquire))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lru_ties_use_creation_sequence_then_session_id() {
        let older = Arc::new(SessionEntry::new(1, 1, SessionData::new()));
        let newer = Arc::new(SessionEntry::new(2, 2, SessionData::new()));
        older.last_activity_sequence.store(9, Ordering::Release);
        newer.last_activity_sequence.store(9, Ordering::Release);

        let mut sessions = HashMap::new();
        sessions.insert("z-newer".to_string(), newer);
        sessions.insert("a-older".to_string(), Arc::clone(&older));
        assert_eq!(
            least_recently_used(&sessions, None).map(|(id, _)| id),
            Some("a-older".to_string())
        );

        let lexical_later = Arc::new(SessionEntry::new(3, 1, SessionData::new()));
        lexical_later
            .last_activity_sequence
            .store(9, Ordering::Release);
        sessions.insert("z-same-age".to_string(), lexical_later);
        assert_eq!(
            least_recently_used(&sessions, None).map(|(id, _)| id),
            Some("a-older".to_string())
        );
    }

    #[test]
    fn stale_delete_lookup_cannot_remove_or_restore_an_already_deleted_entry() {
        let store = SessionStore::default();
        let session_id = store.create();
        let stale_entry = store.lookup_without_eviction(&session_id).unwrap();

        assert!(store.delete(&session_id));
        assert!(!store.delete_after_lookup(&session_id, stale_entry));
        assert!(store.lookup_without_eviction(&session_id).is_none());
    }

    #[test]
    fn refreshed_lru_candidate_loses_final_eviction_revalidation() {
        let store = SessionStore::default();
        let session_a = store.create();
        let session_b = store.create();
        let entry_a = store.lookup_without_eviction(&session_a).unwrap();
        let entry_b = store.lookup_without_eviction(&session_b).unwrap();
        entry_a.last_activity_sequence.store(0, Ordering::Release);
        entry_b.last_activity_sequence.store(0, Ordering::Release);

        let stale_candidate = {
            let index = store.index.read();
            least_recently_used(&index.sessions, None).unwrap()
        };
        assert_eq!(stale_candidate.0, session_a);

        store.touch(&entry_a);
        let current_candidate = {
            let index = store.index.read();
            least_recently_used(&index.sessions, None).unwrap()
        };
        assert_eq!(current_candidate.0, session_b);
        assert!(!Arc::ptr_eq(&stale_candidate.1, &current_candidate.1));
    }
}
