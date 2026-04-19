use super::*;
use csv_align::backend::{CompareRequest, CsvAlignError, MappingRequest};
use csv_align::data::types::ComparisonNormalizationConfig;
use std::sync::Arc;
use std::{env, fs};
use tauri::Manager;

fn temp_output_path(test_name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "csv-align-{test_name}-{}.csv",
        uuid::Uuid::new_v4()
    ))
}

#[test]
fn frontend_tauri_command_map_matches_registered_backend_commands() {
    let frontend_commands = include_str!("../../frontend/src/services/tauriCommands.ts")
        .lines()
        .filter_map(|line| line.split('\'').nth(1))
        .collect::<Vec<_>>();

    assert_eq!(frontend_commands, REGISTERED_TAURI_COMMAND_NAMES);
}

#[test]
fn tauri_command_wrappers_compare_then_export_use_stored_comparison_labels() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "a.csv".to_string(),
        b"id,full_name\n1,Alice\n2,Bob\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "b".to_string(),
        "b.csv".to_string(),
        b"record_id,display_name\n1,Alice\n2,Robert\n".to_vec(),
    )
    .unwrap();

    let response = compare(
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
    )
    .unwrap();

    assert_eq!(response.summary.matches, 1);
    assert_eq!(response.summary.mismatches, 1);

    let output_path = temp_output_path("tauri-export-labels");

    export_results(
        app.state::<Arc<SessionStore>>(),
        session_id,
        output_path.to_string_lossy().into_owned(),
    )
    .unwrap();

    let exported = std::fs::read_to_string(&output_path).unwrap();
    std::fs::remove_file(&output_path).unwrap();

    assert!(exported.contains("Key: id / record_id"));
    assert!(exported.contains("File A: full_name"));
    assert!(exported.contains("File B: display_name"));
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[test]
fn tauri_commands_share_the_backend_session_store() {
    let app = tauri::test::mock_app();
    let store = Arc::new(SessionStore::default());
    app.manage(store.clone());

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let observed = store.with_session(&session_id, |session| {
        (
            session.csv_a.is_none(),
            session.csv_b.is_none(),
            session.columns_a.len(),
            session.columns_b.len(),
        )
    });
    assert_eq!(observed, Some((true, true, 0, 0)));

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "shared.csv".to_string(),
        b"id,name\n1,Alice\n".to_vec(),
    )
    .unwrap();

    let loaded = store.with_session(&session_id, |session| {
        (
            session.csv_a.as_ref().and_then(|csv| csv.file_path.clone()),
            session
                .columns_a
                .iter()
                .map(|column| column.name.clone())
                .collect::<Vec<_>>(),
        )
    });

    assert_eq!(
        loaded,
        Some((
            Some("shared.csv".to_string()),
            vec!["id".to_string(), "name".to_string()]
        ))
    );
    delete_session(app.state::<Arc<SessionStore>>(), session_id.clone());
    assert_eq!(
        store.with_session(&session_id, |session| session.columns_a.len()),
        None
    );
}

#[test]
fn tauri_delete_session_is_a_no_op_for_unknown_ids() {
    let app = tauri::test::mock_app();
    let store = Arc::new(SessionStore::default());
    app.manage(store.clone());

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let unknown_id = uuid::Uuid::new_v4().to_string();

    delete_session(app.state::<Arc<SessionStore>>(), unknown_id);

    assert!(store.with_session(&session_id, |_| ()).is_some());
}

#[test]
fn tauri_load_csv_variants_reject_empty_csv_payloads() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let bytes_error = load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "empty.csv".to_string(),
        Vec::new(),
    )
    .unwrap_err();
    assert!(matches!(bytes_error, CsvAlignError::BadInput(_)));
    assert_eq!(bytes_error.to_string(), "CSV file is empty");

    let file_path = env::temp_dir()
        .join(format!(
            "csv-align-empty-file-test-{}",
            uuid::Uuid::new_v4()
        ))
        .join("picked-empty.csv");
    fs::create_dir_all(file_path.parent().unwrap()).unwrap();
    fs::write(&file_path, b"").unwrap();

    let path_error = load_csv(
        app.state::<Arc<SessionStore>>(),
        session_id,
        "b".to_string(),
        file_path.to_string_lossy().into_owned(),
    )
    .unwrap_err();
    fs::remove_file(&file_path).unwrap();

    assert!(matches!(path_error, CsvAlignError::BadInput(_)));
    assert_eq!(path_error.to_string(), "CSV file is empty");
}

#[test]
fn tauri_load_csv_variants_return_base_file_name_in_response() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    let bytes_response = load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "nested/uploaded-a.csv".to_string(),
        b"id,name\n1,Alice\n".to_vec(),
    )
    .unwrap();
    assert_eq!(bytes_response.file_name, "uploaded-a.csv");

    let file_path = env::temp_dir()
        .join(format!("csv-align-file-name-test-{}", uuid::Uuid::new_v4()))
        .join("picked-b.csv");
    fs::create_dir_all(file_path.parent().unwrap()).unwrap();
    fs::write(&file_path, b"id,name\n1,Alice\n").unwrap();

    let path_response = load_csv(
        app.state::<Arc<SessionStore>>(),
        session_id,
        "b".to_string(),
        file_path.to_string_lossy().into_owned(),
    )
    .unwrap();
    fs::remove_file(&file_path).unwrap();
    assert_eq!(path_response.file_name, "picked-b.csv");
}
