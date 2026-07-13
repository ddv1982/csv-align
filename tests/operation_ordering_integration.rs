use std::sync::{Arc, Barrier, mpsc};
use std::thread;
use std::time::Duration;

use csv_align::backend::{CsvAlignError, OperationKind, SessionStore};

fn issue(
    store: &SessionStore,
    session_id: &str,
    kind: OperationKind,
) -> csv_align::backend::OperationToken {
    store
        .begin_operation(session_id, kind, |_| Ok(()))
        .expect("operation claim should be issued")
        .0
}

fn assert_reverse_completion_supersedes(older: OperationKind, newer: OperationKind) {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let older_token = issue(&store, &session_id, older);
    let older_ready = Arc::new(Barrier::new(2));
    let release_older = Arc::new(Barrier::new(2));

    let older_commit = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        let older_ready = Arc::clone(&older_ready);
        let release_older = Arc::clone(&release_older);
        thread::spawn(move || {
            older_ready.wait();
            release_older.wait();
            store.commit_operation(&session_id, older_token, |session| {
                session.data_revision = 1;
                Ok(())
            })
        })
    };

    older_ready.wait();
    let newer_token = issue(&store, &session_id, newer);
    store
        .commit_operation(&session_id, newer_token, |session| {
            session.data_revision = 2;
            Ok(())
        })
        .expect("newer operation should commit first");
    release_older.wait();

    assert!(
        matches!(
            older_commit.join().expect("older worker panicked"),
            Err(CsvAlignError::Superseded)
        ),
        "expected {newer:?} to supersede older {older:?}"
    );
    assert_eq!(
        store.with_session(&session_id, |session| session.data_revision),
        Some(2),
        "the reverse-completing older operation must not overwrite newer intent"
    );
}

fn assert_reverse_completion_allows_both(older: OperationKind, newer: OperationKind) {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let older_token = issue(&store, &session_id, older);
    let older_ready = Arc::new(Barrier::new(2));
    let release_older = Arc::new(Barrier::new(2));

    let older_commit = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        let older_ready = Arc::clone(&older_ready);
        let release_older = Arc::clone(&release_older);
        thread::spawn(move || {
            older_ready.wait();
            release_older.wait();
            store.commit_operation(&session_id, older_token, |session| {
                session.data_revision += 1;
                Ok(())
            })
        })
    };

    older_ready.wait();
    let newer_token = issue(&store, &session_id, newer);
    store
        .commit_operation(&session_id, newer_token, |session| {
            session.data_revision += 2;
            Ok(())
        })
        .expect("newer different-side load should commit");
    release_older.wait();
    older_commit
        .join()
        .expect("older worker panicked")
        .expect("older different-side load should remain valid");

    assert_eq!(
        store.with_session(&session_id, |session| session.data_revision),
        Some(3)
    );
}

#[test]
fn every_conflict_pair_is_latest_issued_wins_under_reverse_completion() {
    use OperationKind::{Compare, FileA, FileB, SnapshotRestore};

    let conflict_pairs = [
        (FileA, FileA),
        (Compare, FileA),
        (SnapshotRestore, FileA),
        (FileB, FileB),
        (Compare, FileB),
        (SnapshotRestore, FileB),
        (FileA, Compare),
        (FileB, Compare),
        (Compare, Compare),
        (SnapshotRestore, Compare),
        (FileA, SnapshotRestore),
        (FileB, SnapshotRestore),
        (Compare, SnapshotRestore),
        (SnapshotRestore, SnapshotRestore),
    ];

    for (older, newer) in conflict_pairs {
        assert_reverse_completion_supersedes(older, newer);
    }
}

#[test]
fn different_side_loads_both_commit_in_either_issuance_order() {
    assert_reverse_completion_allows_both(OperationKind::FileA, OperationKind::FileB);
    assert_reverse_completion_allows_both(OperationKind::FileB, OperationKind::FileA);
}

#[test]
fn deletion_invalidates_an_issued_claim_before_commit() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let token = issue(&store, &session_id, OperationKind::SnapshotRestore);
    let ready = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));

    let commit = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        let ready = Arc::clone(&ready);
        let release = Arc::clone(&release);
        thread::spawn(move || {
            ready.wait();
            release.wait();
            store.commit_operation(&session_id, token, |_| Ok(()))
        })
    };

    ready.wait();
    assert!(store.delete(&session_id));
    release.wait();

    assert!(matches!(
        commit.join().expect("commit worker panicked"),
        Err(CsvAlignError::Superseded)
    ));
}

#[test]
fn duplicate_commit_is_rejected_after_the_claim_is_consumed() {
    let store = SessionStore::default();
    let session_id = store.create();
    let token = issue(&store, &session_id, OperationKind::FileA);

    store
        .commit_operation(&session_id, token, |_| Ok(()))
        .expect("first commit should consume the claim");
    assert!(matches!(
        store.commit_operation(&session_id, token, |_| Ok(())),
        Err(CsvAlignError::Superseded)
    ));
}

#[test]
fn failed_newest_commit_preserves_committed_state_without_reviving_older_work() {
    let store = SessionStore::default();
    let session_id = store.create();
    store.with_session_mut(&session_id, |session| {
        session.data_revision = 7;
    });

    let older = issue(&store, &session_id, OperationKind::FileA);
    let newest = issue(&store, &session_id, OperationKind::FileA);
    let error = store
        .commit_operation(&session_id, newest, |_| {
            Err::<(), _>(CsvAlignError::BadInput(
                "prospective resource check failed".to_string(),
            ))
        })
        .expect_err("newest commit should fail");

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        store.with_session(&session_id, |session| session.data_revision),
        Some(7)
    );
    assert!(matches!(
        store.commit_operation(&session_id, older, |_| Ok(())),
        Err(CsvAlignError::Superseded)
    ));
    assert!(matches!(
        store.commit_operation(&session_id, newest, |_| Ok(())),
        Err(CsvAlignError::Superseded)
    ));
}

#[test]
fn deletion_waits_for_an_active_guarded_commit_then_removes_the_session() {
    let store = Arc::new(SessionStore::default());
    let session_id = store.create();
    let token = issue(&store, &session_id, OperationKind::FileA);
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let (delete_started_tx, delete_started_rx) = mpsc::channel();
    let (delete_done_tx, delete_done_rx) = mpsc::channel();

    let commit = {
        let store = Arc::clone(&store);
        let session_id = session_id.clone();
        thread::spawn(move || {
            store.commit_operation(&session_id, token, |session| {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                session.data_revision = 5;
                Ok(())
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
    commit.join().unwrap().unwrap();
    deletion.join().unwrap();
    assert!(delete_done_rx.recv().unwrap());
    assert_eq!(store.with_session(&session_id, |_| ()), None);
}

#[test]
fn budget_eviction_invalidates_an_issued_claim_without_running_its_commit() {
    use csv_align::data::types::CsvData;
    use std::sync::atomic::{AtomicBool, Ordering};

    let mut large = csv_align::backend::SessionData::new();
    large.csv_a = Some(Arc::new(CsvData {
        file_path: None,
        headers: vec!["id".to_string()],
        rows: vec![vec!["large protected session".repeat(32)]],
    }));
    let store = SessionStore::with_limits(4, Duration::from_secs(60), large.retained_size_bytes());
    let target_id = store.create();
    let protected_id = store.create();
    let token = issue(&store, &target_id, OperationKind::SnapshotRestore);

    store.with_session_mut(&protected_id, |session| *session = large);
    assert_eq!(store.with_session(&target_id, |_| ()), None);

    let commit_called = AtomicBool::new(false);
    let result = store.commit_operation(&target_id, token, |_| {
        commit_called.store(true, Ordering::SeqCst);
        Ok(())
    });
    assert!(matches!(result, Err(CsvAlignError::Superseded)));
    assert!(!commit_called.load(Ordering::SeqCst));
    assert_eq!(store.with_session(&target_id, |_| ()), None);
}
