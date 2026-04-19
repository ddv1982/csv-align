use super::*;
use csv_align::backend::{CompareRequest, CsvAlignError, MappingRequest};
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
fn tauri_comparison_snapshot_commands_round_trip_saved_results() {
    let app = tauri::test::mock_app();
    app.manage(Arc::new(SessionStore::default()));

    let session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "a".to_string(),
        "left.csv".to_string(),
        b"id,full_name\n1,Alice\n2,Bob\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes(
        app.state::<Arc<SessionStore>>(),
        session_id.clone(),
        "b".to_string(),
        "right.csv".to_string(),
        b"record_id,display_name\n1,Alice\n2,Robert\n".to_vec(),
    )
    .unwrap();

    compare(
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

    let output_path = temp_output_path("tauri-comparison-snapshot");

    save_comparison_snapshot(
        app.state::<Arc<SessionStore>>(),
        session_id,
        output_path.to_string_lossy().into_owned(),
    )
    .unwrap();

    let loaded_session_id = create_session(app.state::<Arc<SessionStore>>()).session_id;
    let loaded = load_comparison_snapshot(
        app.state::<Arc<SessionStore>>(),
        loaded_session_id.clone(),
        output_path.to_string_lossy().into_owned(),
    )
    .unwrap();

    let export_path = std::env::temp_dir().join(format!(
        "csv-align-tauri-loaded-export-{}.csv",
        uuid::Uuid::new_v4()
    ));
    export_results(
        app.state::<Arc<SessionStore>>(),
        loaded_session_id,
        export_path.to_string_lossy().into_owned(),
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

    let error = load_comparison_snapshot(
        app.state::<Arc<SessionStore>>(),
        session_id,
        output_path.to_string_lossy().into_owned(),
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
