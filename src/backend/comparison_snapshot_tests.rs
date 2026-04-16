use super::*;
use crate::data::csv_loader;
use crate::data::types::{ComparisonNormalizationConfig, FileSide};

fn prepared_session() -> SessionData {
    let mut session = SessionData::new();

    let mut csv_a = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n2,Bob\n").unwrap();
    csv_a.file_path = Some("/tmp/left.csv".to_string());
    let mut csv_b =
        csv_loader::load_csv_from_bytes(b"record_id,display_name\n1,Alice\n2,Robert\n").unwrap();
    csv_b.file_path = Some("/tmp/right.csv".to_string());

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let (csv_a, csv_b) = comparison_inputs(&session).unwrap();
    let execution = run_comparison(
        &csv_a,
        &csv_b,
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

    session.comparison_results = execution.results;
    session.comparison_config = Some(execution.config);

    session
}

#[test]
fn comparison_snapshot_round_trips_saved_results_and_hydrates_session() {
    let session = prepared_session();

    let contents = save_comparison_snapshot_workflow(&session).unwrap();
    let mut restored_session = SessionData::new();

    let response = load_comparison_snapshot_workflow(&mut restored_session, &contents).unwrap();

    assert_eq!(response.file_a.name, "left.csv");
    assert_eq!(response.file_b.name, "right.csv");
    assert_eq!(response.selection.key_columns_a, vec!["id"]);
    assert_eq!(response.selection.key_columns_b, vec!["record_id"]);
    assert_eq!(response.summary.matches, 1);
    assert_eq!(response.summary.mismatches, 1);
    assert_eq!(restored_session.comparison_results.len(), 2);
    assert!(restored_session.comparison_config.is_some());

    let (results, config) = export_session_results_snapshot(&restored_session).unwrap();
    let exported =
        String::from_utf8(export_results_to_bytes(&results, config.as_ref()).unwrap()).unwrap();

    assert!(exported.contains("Key: id / record_id"));
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[test]
fn comparison_snapshot_load_rejects_summary_mismatches() {
    let session = prepared_session();
    let mut saved: serde_json::Value =
        serde_json::from_str(&save_comparison_snapshot_workflow(&session).unwrap()).unwrap();

    saved["summary"]["matches"] = serde_json::json!(999);

    let error =
        load_comparison_snapshot_workflow(&mut SessionData::new(), &saved.to_string()).unwrap_err();

    assert_eq!(
        error,
        "Saved comparison snapshot summary does not match the persisted results"
    );
}
