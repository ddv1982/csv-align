use super::*;
use crate::commands::{
    begin_comparison_snapshot_before_selection, export_results_to_path,
    load_comparison_snapshot_from_path, load_csv_bytes_with_args, read_limited,
    save_comparison_snapshot_to_path, validate_snapshot_file_metadata,
};
use csv_align::backend::{
    CompareRequest, CsvAlignError, MappingRequest, OperationKind, SessionData,
    limits::MAX_SNAPSHOT_BYTES,
};
use csv_align::data::types::ComparisonNormalizationConfig;
use std::sync::Arc;
use tauri::Manager;

fn temp_output_path(test_name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "csv-align-{test_name}-{}.json",
        uuid::Uuid::new_v4()
    ))
}

#[test]
fn cancelled_tauri_snapshot_selection_still_supersedes_older_work() {
    let store = SessionStore::default();
    let session_id = store.create();
    let older = store
        .begin_operation(&session_id, OperationKind::Compare, |_| Ok(()))
        .unwrap()
        .0;

    let selection =
        begin_comparison_snapshot_before_selection(&store, &session_id, || Ok(None)).unwrap();

    assert!(selection.is_none());
    assert!(matches!(
        store.commit_operation(&session_id, older, |_| Ok(())),
        Err(CsvAlignError::Superseded)
    ));
}

#[test]
fn reverse_completed_tauri_snapshot_selections_keep_the_latest_claim() {
    let store = SessionStore::default();
    let session_id = store.create();
    let older = begin_comparison_snapshot_before_selection(&store, &session_id, || {
        Ok(Some(std::path::PathBuf::from("older.json")))
    })
    .unwrap()
    .unwrap()
    .0;
    let newer = begin_comparison_snapshot_before_selection(&store, &session_id, || {
        Ok(Some(std::path::PathBuf::from("newer.json")))
    })
    .unwrap()
    .unwrap()
    .0;

    store
        .commit_operation(&session_id, newer, |_| Ok(()))
        .expect("newer snapshot selection should commit");
    assert!(matches!(
        store.commit_operation(&session_id, older, |_| Ok(())),
        Err(CsvAlignError::Superseded)
    ));
}

#[test]
fn tauri_comparison_snapshot_commands_round_trip_saved_results() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "left.csv".to_string(),
        b"id,full_name\n1,Alice\n2,Bob\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes_with_args(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "b".to_string(),
        "right.csv".to_string(),
        b"record_id,display_name\n1,Alice\n2,Robert\n".to_vec(),
    )
    .unwrap();

    tauri::async_runtime::block_on(compare(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["record_id".to_string()],
            comparison_columns_a: vec!["full_name".to_string()],
            comparison_columns_b: vec!["display_name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "full_name".to_string(),
                file_b_column: "display_name".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    ))
    .unwrap();

    let output_path = temp_output_path("tauri-comparison-snapshot");

    save_comparison_snapshot_to_path(
        app.state::<Arc<SessionStore>>().inner().as_ref(),
        &session_id,
        &output_path,
    )
    .unwrap();

    let loaded_session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let loaded = load_comparison_snapshot_from_path(
        app.state::<Arc<SessionStore>>().inner().as_ref(),
        &loaded_session_id,
        &output_path,
    )
    .unwrap();

    let export_path = std::env::temp_dir().join(format!(
        "csv-align-tauri-loaded-export-{}.csv",
        uuid::Uuid::new_v4()
    ));
    export_results_to_path(
        app.state::<Arc<SessionStore>>().inner().as_ref(),
        &loaded_session_id,
        &export_path,
    )
    .unwrap();

    let exported = std::fs::read_to_string(&export_path).unwrap();
    std::fs::remove_file(output_path).unwrap();
    std::fs::remove_file(export_path).unwrap();

    assert_eq!(loaded.file_a.name, "left.csv");
    assert_eq!(loaded.summary.mismatches, 1);
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[test]
fn tauri_comparison_snapshot_command_rejects_legacy_version_before_v2_deserialize() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let output_path = temp_output_path("tauri-comparison-snapshot-legacy-version");

    std::fs::write(
        &output_path,
        serde_json::json!({
            "version": 1,
            "file_a": {},
            "file_b": {},
            "selection": {},
            "mappings": [],
            "normalization": {},
            "results": [],
            "summary": {}
        })
        .to_string(),
    )
    .unwrap();

    let error = load_comparison_snapshot_from_path(
        app.state::<Arc<SessionStore>>().inner().as_ref(),
        &session_id,
        &output_path,
    )
    .unwrap_err();

    std::fs::remove_file(output_path).unwrap();

    match error {
        CsvAlignError::BadInput(message) => assert_eq!(
            message,
            "Unsupported comparison snapshot version 1 — this file was produced by an older csv-align release. Re-run the comparison in v2."
        ),
        other => panic!("expected bad input error, got {other:?}"),
    }
}

#[test]
fn tauri_snapshot_metadata_accepts_the_exact_limit_and_rejects_limit_plus_one() {
    let exact_path = temp_output_path("snapshot-exact-limit");
    let oversized_path = temp_output_path("snapshot-limit-plus-one");
    let exact_file = std::fs::File::create(&exact_path).unwrap();
    exact_file.set_len(MAX_SNAPSHOT_BYTES as u64).unwrap();
    let oversized_file = std::fs::File::create(&oversized_path).unwrap();
    oversized_file
        .set_len((MAX_SNAPSHOT_BYTES + 1) as u64)
        .unwrap();

    assert!(validate_snapshot_file_metadata(&exact_file).is_ok());
    let error = validate_snapshot_file_metadata(&oversized_file).unwrap_err();
    assert!(error.to_string().contains("134217728 byte limit"));

    drop(exact_file);
    drop(oversized_file);
    std::fs::remove_file(exact_path).unwrap();
    std::fs::remove_file(oversized_path).unwrap();
}

#[test]
fn tauri_snapshot_limited_reader_stops_after_limit_plus_one() {
    let contents = read_limited(std::io::Cursor::new(vec![0_u8; 10]), 4).unwrap();
    assert_eq!(contents.len(), 5);
}

#[test]
fn tauri_oversized_snapshot_rejection_leaves_the_session_unchanged() {
    let store = SessionStore::default();
    let session_id = store.create();
    let mut sentinel = SessionData::new();
    sentinel.data_revision = 29;
    assert!(
        store
            .with_session_mut(&session_id, |current| *current = sentinel)
            .is_some()
    );
    let oversized_path = temp_output_path("snapshot-mutation-limit-plus-one");
    std::fs::File::create(&oversized_path)
        .unwrap()
        .set_len((MAX_SNAPSHOT_BYTES + 1) as u64)
        .unwrap();

    let error =
        load_comparison_snapshot_from_path(&store, &session_id, &oversized_path).unwrap_err();
    assert!(error.to_string().contains("134217728 byte limit"));
    let unchanged = store
        .with_session(&session_id, |current| {
            current.data_revision == 29 && current.comparison_config.is_none()
        })
        .unwrap();
    assert!(unchanged);

    std::fs::remove_file(oversized_path).unwrap();
}
