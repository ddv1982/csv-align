use super::*;
use crate::data::csv_loader;
use crate::data::types::{ComparisonNormalizationConfig, FileSide};

#[test]
fn apply_csv_to_session_autosuggests_after_both_files_load() {
    let mut session = SessionData::new();

    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap();

    let first = apply_csv_to_session(&mut session, FileSide::A, csv_a);
    assert_eq!(first.file_letter, FileSide::A);
    assert!(session.column_mappings.is_empty());

    let second = apply_csv_to_session(&mut session, FileSide::B, csv_b);
    assert_eq!(second.file_letter, FileSide::B);
    assert!(session
        .column_mappings
        .iter()
        .any(|mapping| mapping.file_a_column == "id" && mapping.file_b_column == "id"));
}

#[test]
fn run_comparison_and_export_snapshot_preserve_configured_labels() {
    let csv_a = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n2,Bob\n").unwrap();
    let csv_b =
        csv_loader::load_csv_from_bytes(b"record_id,display_name\n1,Alice\n2,Robert\n").unwrap();

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

    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.summary.mismatches, 1);

    let session = SessionData {
        comparison_results: execution.results,
        comparison_config: Some(execution.config),
        ..SessionData::new()
    };

    let (results, config) = export_session_results_snapshot(&session).unwrap();
    let exported =
        String::from_utf8(export_results_to_bytes(&results, config.as_ref()).unwrap()).unwrap();

    assert!(exported.contains("Key: id / record_id"));
    assert!(exported.contains("File A: full_name"));
    assert!(exported.contains("File B: display_name"));
    assert!(exported.contains("Mismatch,2,Bob,Robert"));
}

#[test]
fn run_comparison_rejects_unknown_mapping_type() {
    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: "mystery".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap_err();

    assert!(error.contains("Unknown mapping type 'mystery'"));
}

#[test]
fn run_comparison_rejects_missing_comparison_columns() {
    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["missing".to_string()],
            comparison_columns_b: vec!["name".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap_err();

    assert!(error.contains("Comparison columns for File A reference missing columns: missing"));
}

#[test]
fn run_comparison_rejects_mismatched_key_column_counts() {
    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string(), "name".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["name".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap_err();

    assert!(error.contains(
        "Key columns for File A and Key columns for File B must contain the same number of columns"
    ));
}

#[test]
fn run_comparison_uses_positional_mapping_compatibility_when_mappings_are_omitted() {
    let csv_a = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n2,Bob\n").unwrap();
    let csv_b =
        csv_loader::load_csv_from_bytes(b"record_id,display_name\n1,Alice\n2,Robert\n").unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["record_id".to_string()],
            comparison_columns_a: vec!["full_name".to_string()],
            comparison_columns_b: vec!["display_name".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();

    assert_eq!(execution.config.column_mappings.len(), 1);
    assert_eq!(
        execution.config.column_mappings[0].file_a_column,
        "full_name"
    );
    assert_eq!(
        execution.config.column_mappings[0].file_b_column,
        "display_name"
    );
    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.summary.mismatches, 1);
}

#[test]
fn save_pair_order_rejects_missing_columns_with_stable_message() {
    let session = SessionData {
        csv_a: Some(csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap()),
        csv_b: Some(csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap()),
        ..SessionData::new()
    };

    let error = save_pair_order_workflow(
        &session,
        PairOrderSelection {
            key_columns_a: vec!["missing".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["full_name".to_string()],
        },
    )
    .unwrap_err();

    assert_eq!(
        error,
        "Saved key columns for File A reference missing columns: missing"
    );
}

#[test]
fn save_pair_order_rejects_duplicate_columns_with_stable_message() {
    let session = SessionData {
        csv_a: Some(csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap()),
        csv_b: Some(csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap()),
        ..SessionData::new()
    };

    let error = save_pair_order_workflow(
        &session,
        PairOrderSelection {
            key_columns_a: vec!["id".to_string(), "id".to_string()],
            key_columns_b: vec!["id".to_string(), "id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["full_name".to_string()],
        },
    )
    .unwrap_err();

    assert_eq!(
        error,
        "Saved key columns for File A contain duplicate columns: id"
    );
}
