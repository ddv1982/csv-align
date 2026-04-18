use super::*;
use csv_align::backend::MappingRequest;
use csv_align::data::types::ComparisonNormalizationConfig;
use std::sync::Arc;
use tauri::Manager;

fn temp_output_path(test_name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "csv-align-{test_name}-{}.csv",
        uuid::Uuid::new_v4()
    ))
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
