use super::*;
use csv_align::backend::MappingRequest;
use csv_align::data::types::ComparisonNormalizationConfig;
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
    app.manage(AppState {
        sessions: Mutex::new(HashMap::new()),
    });

    let session_id = create_session(app.state::<AppState>()).session_id;

    load_csv_bytes(
        app.state::<AppState>(),
        session_id.clone(),
        "a".to_string(),
        "a.csv".to_string(),
        b"id,full_name\n1,Alice\n2,Bob\n".to_vec(),
    )
    .unwrap();

    load_csv_bytes(
        app.state::<AppState>(),
        session_id.clone(),
        "b".to_string(),
        "b.csv".to_string(),
        b"record_id,display_name\n1,Alice\n2,Robert\n".to_vec(),
    )
    .unwrap();

    let response = compare(
        app.state::<AppState>(),
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
        app.state::<AppState>(),
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
