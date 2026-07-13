use csv_align::{
    backend::{SessionData, SessionStore},
    data::types::{ColumnCatalog, ColumnDataType, ColumnInfo, ColumnMapping, CsvData, MappingType},
};
use std::{
    collections::HashSet,
    sync::{Arc, Barrier, mpsc},
    thread,
    time::Duration,
};

#[test]
fn session_store_supports_create_read_update_and_delete() {
    let store = SessionStore::default();

    let session_id = store.create();
    assert_eq!(store.session_count(), 1);

    let initial_columns_a = store.with_session(&session_id, |session| {
        (
            session.csv_a.is_none(),
            session.csv_b.is_none(),
            session.columns_a.len(),
        )
    });
    assert_eq!(initial_columns_a, Some((true, true, 0)));

    let mutation_result = store.with_session_mut(&session_id, |session| {
        session.columns_a = Arc::new(ColumnCatalog::new(
            vec![ColumnInfo {
                index: 0,
                name: "id".to_string(),
                data_type: ColumnDataType::String,
            }],
            vec![],
        ));
        session.columns_b = Arc::new(ColumnCatalog::new(
            vec![ColumnInfo {
                index: 0,
                name: "external_id".to_string(),
                data_type: ColumnDataType::String,
            }],
            vec![],
        ));
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
            session.columns_a = Arc::new(ColumnCatalog::new(
                vec![ColumnInfo {
                    index: 1,
                    name: "another".to_string(),
                    data_type: ColumnDataType::String,
                }],
                vec![],
            ));
        }),
        None
    );
    assert!(!store.delete(&session_id));
    assert_eq!(store.session_count(), 0);
}

#[test]
fn blocked_session_does_not_prevent_another_session_from_progressing() {
    let store = Arc::new(SessionStore::default());
    let session_a = store.create();
    let session_b = store.create();
    let (entered_a_tx, entered_a_rx) = mpsc::channel();
    let (release_a_tx, release_a_rx) = mpsc::channel();
    let (completed_b_tx, completed_b_rx) = mpsc::channel();

    let worker_a = {
        let store = Arc::clone(&store);
        thread::spawn(move || {
            store.with_session_mut(&session_a, |session| {
                entered_a_tx.send(()).unwrap();
                release_a_rx.recv().unwrap();
                session.data_revision = 1;
            })
        })
    };
    entered_a_rx.recv().unwrap();

    let worker_b = {
        let store = Arc::clone(&store);
        thread::spawn(move || {
            let result = store.with_session_mut(&session_b, |session| {
                session.data_revision = 2;
            });
            completed_b_tx.send(result).unwrap();
        })
    };

    let session_b_result = completed_b_rx.recv_timeout(Duration::from_secs(1));
    release_a_tx.send(()).unwrap();
    assert_eq!(worker_a.join().unwrap(), Some(()));
    worker_b.join().unwrap();
    assert_eq!(session_b_result.unwrap(), Some(()));
}

#[test]
fn same_session_mutations_remain_serialized() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let (entered_first_tx, entered_first_rx) = mpsc::channel();
    let (release_first_tx, release_first_rx) = mpsc::channel();
    let (started_second_tx, started_second_rx) = mpsc::channel();
    let (entered_second_tx, entered_second_rx) = mpsc::channel();

    let first = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        thread::spawn(move || {
            store.with_session_mut(&session_id, |session| {
                entered_first_tx.send(()).unwrap();
                release_first_rx.recv().unwrap();
                session.data_revision += 1;
            })
        })
    };
    entered_first_rx.recv().unwrap();

    let second = {
        let store = Arc::clone(&store);
        let second_session_id = session_id.clone();
        thread::spawn(move || {
            started_second_tx.send(()).unwrap();
            store.with_session_mut(&second_session_id, |session| {
                entered_second_tx.send(()).unwrap();
                session.data_revision += 1;
            })
        })
    };
    started_second_rx.recv().unwrap();
    assert!(matches!(
        entered_second_rx.try_recv(),
        Err(mpsc::TryRecvError::Empty)
    ));

    release_first_tx.send(()).unwrap();
    assert_eq!(first.join().unwrap(), Some(()));
    assert_eq!(second.join().unwrap(), Some(()));
    assert_eq!(entered_second_rx.recv().unwrap(), ());
    assert_eq!(
        store.with_session(&session_id, |session| session.data_revision),
        Some(2)
    );
}

#[test]
fn deletion_waits_for_an_active_mutation_and_cannot_be_resurrected() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let (delete_started_tx, delete_started_rx) = mpsc::channel();
    let (delete_done_tx, delete_done_rx) = mpsc::channel();

    let mutation = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        thread::spawn(move || {
            store.with_session_mut(&session_id, |session| {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                session.data_revision = 99;
            })
        })
    };
    entered_rx.recv().unwrap();

    let deletion = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        thread::spawn(move || {
            delete_started_tx.send(()).unwrap();
            delete_done_tx.send(store.delete(&session_id)).unwrap();
        })
    };
    delete_started_rx.recv().unwrap();
    assert!(matches!(
        delete_done_rx.try_recv(),
        Err(mpsc::TryRecvError::Empty)
    ));

    release_tx.send(()).unwrap();
    assert_eq!(mutation.join().unwrap(), Some(()));
    deletion.join().unwrap();
    assert!(delete_done_rx.recv().unwrap());
    assert_eq!(store.with_session(&session_id, |_| ()), None);
}

#[test]
fn session_store_evicts_oldest_sessions_when_capacity_is_reached() {
    let store = SessionStore::with_max_sessions(2);

    let session_a = store.create();
    let session_b = store.create();

    store.with_session_mut(&session_a, |session| {
        session.columns_a = Arc::new(ColumnCatalog::new(
            vec![ColumnInfo {
                index: 0,
                name: "a".to_string(),
                data_type: ColumnDataType::String,
            }],
            vec![],
        ));
    });

    let session_c = store.create();

    assert_eq!(store.session_count(), 2);
    assert_eq!(store.with_session(&session_a, |_| ()), None);
    assert!(store.with_session(&session_b, |_| ()).is_some());
    assert!(store.with_session(&session_c, |_| ()).is_some());
}

#[test]
fn session_store_deletion_updates_capacity_order() {
    let store = SessionStore::with_max_sessions(2);

    let session_a = store.create();
    let session_b = store.create();
    assert!(store.delete(&session_a));

    let session_c = store.create();

    assert_eq!(store.session_count(), 2);
    assert!(store.with_session(&session_b, |_| ()).is_some());
    assert!(store.with_session(&session_c, |_| ()).is_some());
}

#[test]
fn session_store_evicts_idle_sessions_on_access() {
    let store = SessionStore::with_limits(4, Duration::from_millis(1), 1024 * 1024);
    let session_id = store.create();

    thread::sleep(Duration::from_millis(5));

    assert_eq!(store.session_count(), 0);
    assert_eq!(store.with_session(&session_id, |_| ()), None);
}

#[test]
fn delete_reports_success_for_an_idle_session_without_sweeping_it_first() {
    let store = SessionStore::with_limits(4, Duration::from_millis(1), 1024 * 1024);
    let session_id = store.create();
    thread::sleep(Duration::from_millis(5));

    assert!(store.delete(&session_id));
    assert_eq!(store.session_count(), 0);
}

#[test]
fn busy_idle_candidate_is_skipped_and_cleanup_converges_when_it_releases() {
    let store = Arc::new(SessionStore::with_limits(
        4,
        Duration::from_millis(1),
        1024 * 1024,
    ));
    let session_a = store.create();
    let session_b = store.create();
    let (entered_a_tx, entered_a_rx) = mpsc::channel();
    let (release_a_tx, release_a_rx) = mpsc::channel();

    let worker_a = {
        let store = Arc::clone(&store);
        let worker_session_a = session_a.clone();
        thread::spawn(move || {
            store.with_session_mut(&worker_session_a, |_| {
                entered_a_tx.send(()).unwrap();
                release_a_rx.recv().unwrap();
            })
        })
    };
    entered_a_rx.recv().unwrap();
    assert!(store.with_session(&session_b, |_| ()).is_some());
    thread::sleep(Duration::from_millis(5));

    let session_c = store.create();

    assert_eq!(store.with_session(&session_b, |_| ()), None);
    release_a_tx.send(()).unwrap();
    assert_eq!(worker_a.join().unwrap(), Some(()));
    assert_eq!(store.with_session(&session_a, |_| ()), None);
    assert!(store.with_session(&session_c, |_| ()).is_some());
}

#[test]
fn busy_budget_candidate_is_skipped_and_cleanup_converges_when_it_releases() {
    let mut large = SessionData::new();
    large.csv_a = Some(Arc::new(CsvData {
        file_path: None,
        headers: vec!["id".to_string()],
        rows: vec![vec!["large session".repeat(1024)]],
    }));
    let store = Arc::new(SessionStore::with_limits(
        4,
        Duration::from_secs(60),
        large.retained_size_bytes(),
    ));
    let session_a = store.create();
    let session_b = store.create();
    let session_c = store.create();
    let (entered_a_tx, entered_a_rx) = mpsc::channel();
    let (release_a_tx, release_a_rx) = mpsc::channel();
    let (completed_c_tx, completed_c_rx) = mpsc::channel();

    let worker_a = {
        let store = Arc::clone(&store);
        let worker_session_a = session_a.clone();
        thread::spawn(move || {
            store.with_session_mut(&worker_session_a, |_| {
                entered_a_tx.send(()).unwrap();
                release_a_rx.recv().unwrap();
            })
        })
    };
    entered_a_rx.recv().unwrap();
    assert!(store.with_session(&session_b, |_| ()).is_some());

    let worker_c = {
        let store = Arc::clone(&store);
        let worker_session_c = session_c.clone();
        thread::spawn(move || {
            let result = store.with_session_mut(&worker_session_c, |session| *session = large);
            completed_c_tx.send(result).unwrap();
        })
    };

    assert_eq!(
        completed_c_rx.recv_timeout(Duration::from_secs(1)).unwrap(),
        Some(())
    );
    worker_c.join().unwrap();
    assert_eq!(store.with_session(&session_b, |_| ()), None);

    release_a_tx.send(()).unwrap();
    assert_eq!(worker_a.join().unwrap(), Some(()));
    assert_eq!(store.with_session(&session_a, |_| ()), None);
    assert!(store.with_session(&session_c, |_| ()).is_some());
}

#[test]
fn session_store_evicts_least_recently_used_sessions_when_byte_budget_is_exceeded() {
    let mut measured_session = SessionData::new();
    measured_session.csv_a = Some(Arc::new(CsvData {
        file_path: None,
        headers: vec!["id".to_string()],
        rows: vec![vec!["older-session-is-large".to_string()]],
    }));
    let budget = SessionData::new()
        .retained_size_bytes()
        .saturating_add(measured_session.retained_size_bytes());
    let store = SessionStore::with_limits(4, Duration::from_secs(60), budget);
    let old_session = store.create();
    let protected_session = store.create();

    store.with_session_mut(&old_session, |session| {
        session.csv_a = Some(Arc::new(CsvData {
            file_path: None,
            headers: vec!["id".to_string()],
            rows: vec![vec!["older-session-is-large".to_string()]],
        }));
    });
    store.with_session_mut(&protected_session, |session| {
        session.csv_a = Some(Arc::new(CsvData {
            file_path: None,
            headers: vec!["id".to_string()],
            rows: vec![vec!["protected-session-is-large".to_string()]],
        }));
    });

    assert_eq!(store.with_session(&old_session, |_| ()), None);
    assert!(store.with_session(&protected_session, |_| ()).is_some());
}

#[test]
fn session_store_preserves_all_concurrent_mutations_on_one_session() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let thread_count = 4;
    let updates_per_thread = 10;
    let start_barrier = Arc::new(Barrier::new(thread_count));

    let mut handles = Vec::new();
    for worker in 0..thread_count {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        let start_barrier = Arc::clone(&start_barrier);

        handles.push(thread::spawn(move || {
            start_barrier.wait();

            for update in 0..updates_per_thread {
                let column_name = format!("worker-{worker}-column-{update}");
                let inserted = store.with_session_mut(&session_id, |session| {
                    session.column_mappings.push(ColumnMapping {
                        file_a_column: column_name.clone(),
                        file_b_column: column_name.clone(),
                        mapping_type: MappingType::ManualMatch,
                    });
                });

                assert_eq!(inserted, Some(()));
            }
        }));
    }

    for handle in handles {
        handle.join().expect("worker thread panicked");
    }

    let column_names = store
        .with_session(&session_id, |session| {
            session
                .column_mappings
                .iter()
                .map(|mapping| mapping.file_a_column.clone())
                .collect::<Vec<_>>()
        })
        .expect("session should exist");

    let unique_names = column_names.iter().cloned().collect::<HashSet<_>>();
    let expected_count = thread_count * updates_per_thread;

    assert_eq!(column_names.len(), expected_count);
    assert_eq!(unique_names.len(), expected_count);
}

#[test]
fn session_store_keeps_concurrent_session_updates_isolated() {
    let store = Arc::new(SessionStore::default());
    let session_a = store.create();
    let session_b = store.create();
    let start_barrier = Arc::new(Barrier::new(2));

    let handle_a = {
        let store = Arc::clone(&store);
        let session_a = session_a.clone();
        let start_barrier = Arc::clone(&start_barrier);

        thread::spawn(move || {
            start_barrier.wait();

            for index in 0..12 {
                let inserted = store.with_session_mut(&session_a, |session| {
                    session.column_mappings.push(ColumnMapping {
                        file_a_column: format!("a-{index}"),
                        file_b_column: String::new(),
                        mapping_type: MappingType::ManualMatch,
                    });
                });

                assert_eq!(inserted, Some(()));
            }
        })
    };

    let handle_b = {
        let store = Arc::clone(&store);
        let session_b = session_b.clone();
        let start_barrier = Arc::clone(&start_barrier);

        thread::spawn(move || {
            start_barrier.wait();

            for index in 0..7 {
                let inserted = store.with_session_mut(&session_b, |session| {
                    session.column_mappings.push(ColumnMapping {
                        file_a_column: String::new(),
                        file_b_column: format!("b-{index}"),
                        mapping_type: MappingType::ManualMatch,
                    });
                });

                assert_eq!(inserted, Some(()));
            }
        })
    };

    handle_a.join().expect("session A thread panicked");
    handle_b.join().expect("session B thread panicked");

    let session_a_state = store
        .with_session(&session_a, |session| {
            (
                session
                    .column_mappings
                    .iter()
                    .map(|mapping| mapping.file_a_column.clone())
                    .collect::<Vec<_>>(),
                session.columns_b.len(),
            )
        })
        .expect("session A should exist");

    let session_b_state = store
        .with_session(&session_b, |session| {
            (
                session.columns_a.len(),
                session
                    .column_mappings
                    .iter()
                    .map(|mapping| mapping.file_b_column.clone())
                    .collect::<Vec<_>>(),
            )
        })
        .expect("session B should exist");

    assert_eq!(session_a_state.1, 0);
    assert_eq!(session_b_state.0, 0);
    assert_eq!(session_a_state.0.len(), 12);
    assert_eq!(session_b_state.1.len(), 7);
    assert!(session_a_state.0.iter().all(|name| name.starts_with("a-")));
    assert!(session_b_state.1.iter().all(|name| name.starts_with("b-")));
}
