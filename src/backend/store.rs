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

#[cfg(test)]
mod tests {
    use super::SessionStore;
    use crate::data::types::{ColumnDataType, ColumnInfo};

    #[test]
    fn session_store_supports_create_read_update_and_delete() {
        let store = SessionStore::default();

        let session_id = store.create();

        let initial_columns_a = store.with_session(&session_id, |session| {
            (
                session.csv_a.is_none(),
                session.csv_b.is_none(),
                session.columns_a.len(),
            )
        });
        assert_eq!(initial_columns_a, Some((true, true, 0)));

        let mutation_result = store.with_session_mut(&session_id, |session| {
            session.columns_a.push(ColumnInfo {
                index: 0,
                name: "id".to_string(),
                data_type: ColumnDataType::String,
            });
            session.columns_b.push(ColumnInfo {
                index: 0,
                name: "external_id".to_string(),
                data_type: ColumnDataType::String,
            });
            session.columns_a.len() + session.columns_b.len()
        });
        assert_eq!(mutation_result, Some(2));

        let updated_columns = store.with_session(&session_id, |session| {
            (
                session
                    .columns_a
                    .iter()
                    .map(|column| column.name.clone())
                    .collect::<Vec<_>>(),
                session
                    .columns_b
                    .iter()
                    .map(|column| column.name.clone())
                    .collect::<Vec<_>>(),
            )
        });
        assert_eq!(
            updated_columns,
            Some((vec!["id".to_string()], vec!["external_id".to_string()]))
        );

        assert!(store.delete(&session_id));
        assert_eq!(
            store.with_session(&session_id, |session| session.columns_a.len()),
            None
        );
        assert_eq!(
            store.with_session_mut(&session_id, |session| {
                session.columns_a.push(ColumnInfo {
                    index: 1,
                    name: "another".to_string(),
                    data_type: ColumnDataType::String,
                });
            }),
            None
        );
        assert!(!store.delete(&session_id));
    }
}
