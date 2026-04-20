use csv_align::{
    backend::SessionStore,
    data::types::{ColumnDataType, ColumnInfo},
};
use std::{
    collections::HashSet,
    sync::{Arc, Barrier},
    thread,
};

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
                    session.columns_a.push(ColumnInfo {
                        index: session.columns_a.len(),
                        name: column_name.clone(),
                        data_type: ColumnDataType::String,
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
                .columns_a
                .iter()
                .map(|column| column.name.clone())
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
                    session.columns_a.push(ColumnInfo {
                        index,
                        name: format!("a-{index}"),
                        data_type: ColumnDataType::String,
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
                    session.columns_b.push(ColumnInfo {
                        index,
                        name: format!("b-{index}"),
                        data_type: ColumnDataType::String,
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
                    .columns_a
                    .iter()
                    .map(|column| column.name.clone())
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
                    .columns_b
                    .iter()
                    .map(|column| column.name.clone())
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
