use csv_align::backend::{
    CompareRequest, CompareValidationError, CsvAlignError, CsvLoadSource, MappingRequest,
    PairOrderSelection, SessionData, apply_csv_to_session, comparison_inputs,
    export_results_to_bytes, export_session_results_snapshot, load_comparison_snapshot_workflow,
    load_csv_workflow, load_pair_order_workflow, run_comparison, save_comparison_snapshot_workflow,
    save_pair_order_workflow,
};
use csv_align::data::csv_loader;
use csv_align::data::types::{ComparisonNormalizationConfig, CsvData, FileSide};
use std::io::Write;
use std::sync::Arc;
use tempfile::NamedTempFile;

fn prepared_snapshot_session() -> SessionData {
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
        csv_a.as_ref(),
        csv_b.as_ref(),
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
fn apply_csv_to_session_autosuggests_after_both_files_load() {
    let mut session = SessionData::new();

    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap();

    let first = apply_csv_to_session(&mut session, FileSide::A, csv_a);
    assert_eq!(first.file_letter, FileSide::A);
    assert!(session.column_mappings.is_empty());

    let second = apply_csv_to_session(&mut session, FileSide::B, csv_b);
    assert_eq!(second.file_letter, FileSide::B);
    assert!(
        session
            .column_mappings
            .iter()
            .any(|mapping| mapping.file_a_column == "id" && mapping.file_b_column == "id")
    );
}

#[test]
fn load_csv_workflow_supports_bytes_and_trims_blank_file_name() {
    let loaded = load_csv_workflow(
        "a",
        Some("   ".to_string()),
        CsvLoadSource::Bytes(b"id,name\n1,Alice\n".to_vec()),
    )
    .unwrap();

    assert_eq!(loaded.response.file_letter, FileSide::A);
    assert_eq!(loaded.response.file_name, "");
    assert_eq!(loaded.response.headers, vec!["id", "name"]);
    assert_eq!(loaded.response.row_count, 1);
    assert_eq!(loaded.csv_data.file_path, None);
}

#[test]
fn load_csv_workflow_rejects_empty_csv_bytes() {
    let error = load_csv_workflow(
        "a",
        Some("empty.csv".to_string()),
        CsvLoadSource::Bytes(Vec::new()),
    )
    .expect_err("empty csv bytes should be rejected");

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(error.to_string(), "CSV file is empty");
}

#[test]
fn load_csv_workflow_supports_file_paths_and_sets_file_name() {
    let mut temp_file = NamedTempFile::with_suffix(".csv").unwrap();
    writeln!(temp_file, "id,name").unwrap();
    writeln!(temp_file, "1,Alice").unwrap();

    let path = temp_file.path().to_string_lossy().into_owned();
    let loaded = load_csv_workflow(
        "b",
        Some(path.clone()),
        CsvLoadSource::FilePath(path.clone()),
    )
    .unwrap();

    assert_eq!(loaded.response.file_letter, FileSide::B);
    assert_eq!(
        loaded.response.file_name,
        temp_file
            .path()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    );
    assert_eq!(loaded.response.headers, vec!["id", "name"]);
    assert_eq!(loaded.response.row_count, 1);
    assert_eq!(loaded.csv_data.file_path.as_deref(), Some(path.as_str()));
}

#[test]
fn apply_csv_to_session_uses_uploaded_file_base_name_in_response() {
    let mut session = SessionData::new();
    let mut csv = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    csv.file_path = Some("uploads/customer-data.csv".to_string());

    let response = apply_csv_to_session(&mut session, FileSide::A, csv);

    assert_eq!(response.file_name, "customer-data.csv");
}

#[test]
fn apply_csv_to_session_clears_stale_comparison_state_after_file_reload() {
    let mut session = prepared_snapshot_session();
    let replacement_csv = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alicia\n").unwrap();

    let response = apply_csv_to_session(&mut session, FileSide::A, replacement_csv);

    assert_eq!(response.file_letter, FileSide::A);
    assert!(session.comparison_results.is_empty());
    assert!(session.comparison_config.is_none());
    assert!(matches!(
        export_session_results_snapshot(&session),
        Err(CsvAlignError::BadInput(message))
            if message == "No comparison results to export. Run a comparison first."
    ));
}

#[test]
fn comparison_inputs_return_shared_csv_arcs() {
    let mut session = SessionData::new();

    let csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap();

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let original_a = Arc::clone(session.csv_a.as_ref().expect("file A stored in session"));
    let original_b = Arc::clone(session.csv_b.as_ref().expect("file B stored in session"));

    let (returned_a, returned_b) = comparison_inputs(&session).unwrap();

    assert!(Arc::ptr_eq(&original_a, &returned_a));
    assert!(Arc::ptr_eq(&original_b, &returned_b));
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
fn run_comparison_and_export_snapshot_use_file_a_key_shape_for_mismatched_flexible_match() {
    let csv_a = csv_loader::load_csv_from_bytes(b"composite,value\nGROUP**CODE,same\n").unwrap();
    let csv_b =
        csv_loader::load_csv_from_bytes(b"part_a,part_b,value\nGROUP,TAILCODE,same\n").unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["composite".to_string()],
            key_columns_b: vec!["part_a".to_string(), "part_b".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "value".to_string(),
                file_b_column: "value".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig {
                flexible_key_matching: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .unwrap();

    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.results.len(), 1);
    assert_eq!(execution.response.results[0].key, vec!["GROUP**CODE"]);

    let session = SessionData {
        comparison_results: execution.results,
        comparison_config: Some(execution.config),
        ..SessionData::new()
    };

    let (results, config) = export_session_results_snapshot(&session).unwrap();
    let exported =
        String::from_utf8(export_results_to_bytes(&results, config.as_ref()).unwrap()).unwrap();

    assert!(
        exported.contains("Result,Key: composite / part_a,Key: part_b,File A: value,File B: value")
    );
    assert!(exported.contains("Match,GROUP**CODE,,same,same"));
}

#[test]
fn run_comparison_rejects_excessive_flexible_key_candidate_sets() {
    const ROW_COUNT: usize = 101;

    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec![
            "wild".to_string(),
            "file_a_id".to_string(),
            "value".to_string(),
        ],
        rows: (0..ROW_COUNT)
            .map(|index| vec!["**".to_string(), format!("A{index:03}"), "same".to_string()])
            .collect(),
    };
    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec![
            "file_b_id".to_string(),
            "literal".to_string(),
            "wild".to_string(),
            "value".to_string(),
        ],
        rows: (0..ROW_COUNT)
            .map(|index| {
                vec![
                    format!("B{index:03}"),
                    "MIDDLE".to_string(),
                    "**".to_string(),
                    "same".to_string(),
                ]
            })
            .collect(),
    };

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["wild".to_string(), "file_a_id".to_string()],
            key_columns_b: vec![
                "file_b_id".to_string(),
                "literal".to_string(),
                "wild".to_string(),
            ],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "value".to_string(),
                file_b_column: "value".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig {
                flexible_key_matching: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .expect_err("dense flexible key candidates should fail fast");
    let message = error.to_string();

    match error {
        CsvAlignError::Validation(CompareValidationError::TooManyFlexibleKeyCandidates {
            candidate_count,
            limit,
        }) => {
            assert_eq!(candidate_count, 10_001);
            assert_eq!(limit, 10_000);
        }
        other => panic!("unexpected error: {other}"),
    }
    assert!(message.contains("exceeds the limit of 10000"));
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

    assert!(matches!(error, CsvAlignError::Validation(_)));
    assert_eq!(
        error.to_string(),
        "Unknown mapping type 'mystery'. Expected one of: exact, manual, fuzzy"
    );
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

    assert!(matches!(error, CsvAlignError::Validation(_)));
    assert_eq!(
        error.to_string(),
        "Comparison columns for File A reference missing columns: missing"
    );
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

    assert!(matches!(error, CsvAlignError::Validation(_)));
    assert!(error.to_string().contains(
        "Key columns for File A and Key columns for File B must contain the same number of columns"
    ));
}

#[test]
fn run_comparison_allows_mismatched_key_column_counts_only_for_flexible_matching() {
    let csv_a = csv_loader::load_csv_from_bytes(b"composite,value\nGROUP**CODE,same\n").unwrap();
    let csv_b =
        csv_loader::load_csv_from_bytes(b"part_a,part_b,value\nGROUP,TAILCODE,same\n").unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["composite".to_string()],
            key_columns_b: vec!["part_a".to_string(), "part_b".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig {
                flexible_key_matching: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .expect("flexible matching should allow unequal key counts");

    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.summary.missing_left, 0);
    assert_eq!(execution.response.summary.missing_right, 0);
    assert_eq!(execution.config.key_columns_a, vec!["composite"]);
    assert_eq!(execution.config.key_columns_b, vec!["part_a", "part_b"]);
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
        csv_a: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        )),
        csv_b: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap(),
        )),
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

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        error.to_string(),
        "Saved key columns for File A reference missing columns: missing"
    );
}

#[test]
fn save_pair_order_rejects_duplicate_columns_with_stable_message() {
    let session = SessionData {
        csv_a: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        )),
        csv_b: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap(),
        )),
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

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        error.to_string(),
        "Saved key columns for File A contain duplicate columns: id"
    );
}

#[test]
fn load_pair_order_rejects_unknown_version_before_full_deserialize() {
    let session = SessionData {
        csv_a: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap(),
        )),
        csv_b: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,full_name\n1,Alice\n").unwrap(),
        )),
        ..SessionData::new()
    };

    let error = load_pair_order_workflow(
        &session,
        &serde_json::json!({
            "version": 999,
            "headers_a": ["id", "name"],
            "headers_b": ["id", "full_name"],
            "selection": {
                "key_columns_a": ["id"],
                "key_columns_b": ["id"],
                "comparison_columns_a": ["name"],
                "comparison_columns_b": ["full_name"]
            }
        })
        .to_string(),
    )
    .unwrap_err();

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(error.to_string(), "Unsupported pair-order file version 999");
}

#[test]
fn load_pair_order_reports_concrete_file_a_header_mismatches() {
    let session = SessionData {
        csv_a: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,name,value\n1,Alice,10\n").unwrap(),
        )),
        csv_b: Some(Arc::new(
            csv_loader::load_csv_from_bytes(b"id,full_name,amount\n1,Alice,10\n").unwrap(),
        )),
        ..SessionData::new()
    };

    let error = load_pair_order_workflow(
        &session,
        &serde_json::json!({
            "version": 1,
            "headers_a": ["id", "name", "old_value"],
            "headers_b": ["id", "full_name", "amount"],
            "selection": {
                "key_columns_a": ["id"],
                "key_columns_b": ["id"],
                "comparison_columns_a": ["name", "old_value"],
                "comparison_columns_b": ["full_name", "amount"]
            }
        })
        .to_string(),
    )
    .unwrap_err();

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        error.to_string(),
        "Saved pair order does not match the currently loaded File A columns: missing from saved: value; unexpected in saved: old_value"
    );
}

#[test]
fn comparison_snapshot_round_trips_saved_results_and_hydrates_session() {
    let session = prepared_snapshot_session();

    let contents = save_comparison_snapshot_workflow(&session).unwrap();
    let mut restored_session = SessionData::new();

    let response = load_comparison_snapshot_workflow(&mut restored_session, &contents).unwrap();
    let saved: serde_json::Value = serde_json::from_str(&contents).unwrap();

    assert_eq!(saved["version"], 2);
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
fn comparison_snapshot_round_trips_flexible_mismatched_key_counts() {
    let mut session = SessionData::new();
    let csv_a = csv_loader::load_csv_from_bytes(b"composite,value\nGROUP**CODE,same\n").unwrap();
    let csv_b =
        csv_loader::load_csv_from_bytes(b"part_a,part_b,value\nGROUP,TAILCODE,same\n").unwrap();

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let (csv_a, csv_b) = comparison_inputs(&session).unwrap();
    let execution = run_comparison(
        csv_a.as_ref(),
        csv_b.as_ref(),
        CompareRequest {
            key_columns_a: vec!["composite".to_string()],
            key_columns_b: vec!["part_a".to_string(), "part_b".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig {
                flexible_key_matching: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .unwrap();
    session.comparison_results = execution.results;
    session.comparison_config = Some(execution.config);

    let contents = save_comparison_snapshot_workflow(&session).unwrap();
    let mut restored_session = SessionData::new();
    let response = load_comparison_snapshot_workflow(&mut restored_session, &contents).unwrap();
    let restored_config = restored_session.comparison_config.expect("restored config");

    assert_eq!(response.summary.matches, 1);
    assert_eq!(restored_config.key_columns_a, vec!["composite"]);
    assert_eq!(restored_config.key_columns_b, vec!["part_a", "part_b"]);
    assert!(restored_config.normalization.flexible_key_matching);
}

#[test]
fn snapshot_v1_round_trip() {
    let session = prepared_snapshot_session();

    let contents = save_comparison_snapshot_workflow(&session).unwrap();
    let mut restored_session = SessionData::new();

    let response = load_comparison_snapshot_workflow(&mut restored_session, &contents).unwrap();

    assert_eq!(restored_session.columns_a.len(), session.columns_a.len());
    assert_eq!(restored_session.columns_b.len(), session.columns_b.len());
    assert_eq!(
        restored_session
            .columns_a
            .iter()
            .map(|column| (&column.name, column.index, &column.data_type))
            .collect::<Vec<_>>(),
        session
            .columns_a
            .iter()
            .map(|column| (&column.name, column.index, &column.data_type))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        restored_session
            .columns_b
            .iter()
            .map(|column| (&column.name, column.index, &column.data_type))
            .collect::<Vec<_>>(),
        session
            .columns_b
            .iter()
            .map(|column| (&column.name, column.index, &column.data_type))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        restored_session
            .column_mappings
            .iter()
            .map(|mapping| {
                (
                    mapping.file_a_column.clone(),
                    mapping.file_b_column.clone(),
                    format!("{:?}", mapping.mapping_type),
                )
            })
            .collect::<Vec<_>>(),
        session
            .comparison_config
            .as_ref()
            .expect("original config")
            .column_mappings
            .iter()
            .map(|mapping| {
                (
                    mapping.file_a_column.clone(),
                    mapping.file_b_column.clone(),
                    format!("{:?}", mapping.mapping_type),
                )
            })
            .collect::<Vec<_>>()
    );
    assert_eq!(
        restored_session.comparison_results,
        session.comparison_results
    );
    let restored_config = restored_session.comparison_config.expect("restored config");
    let original_config = session.comparison_config.expect("original config");
    assert_eq!(restored_config.key_columns_a, original_config.key_columns_a);
    assert_eq!(restored_config.key_columns_b, original_config.key_columns_b);
    assert_eq!(
        restored_config.comparison_columns_a,
        original_config.comparison_columns_a
    );
    assert_eq!(
        restored_config.comparison_columns_b,
        original_config.comparison_columns_b
    );
    assert_eq!(restored_config.normalization, original_config.normalization);
    assert_eq!(
        restored_config
            .column_mappings
            .iter()
            .map(|mapping| {
                (
                    mapping.file_a_column.clone(),
                    mapping.file_b_column.clone(),
                    format!("{:?}", mapping.mapping_type),
                )
            })
            .collect::<Vec<_>>(),
        original_config
            .column_mappings
            .iter()
            .map(|mapping| {
                (
                    mapping.file_a_column.clone(),
                    mapping.file_b_column.clone(),
                    format!("{:?}", mapping.mapping_type),
                )
            })
            .collect::<Vec<_>>()
    );
    assert_eq!(
        response.mappings.len(),
        restored_config.column_mappings.len()
    );
}

#[test]
fn snapshot_v1_rejects_legacy_version() {
    let legacy_snapshot = serde_json::json!({
        "version": 1,
        "file_a": {
            "name": "left.csv",
            "headers": ["id"],
            "columns": [{ "index": 0, "name": "id", "data_type": "string" }],
            "row_count": 1
        },
        "file_b": {
            "name": "right.csv",
            "headers": ["record_id"],
            "columns": [{ "index": 0, "name": "record_id", "data_type": "string" }],
            "row_count": 1
        },
        "selection": {
            "key_columns_a": ["id"],
            "key_columns_b": ["record_id"],
            "comparison_columns_a": ["id"],
            "comparison_columns_b": ["record_id"]
        },
        "mappings": [],
        "normalization": {
            "treat_empty_as_null": false,
            "null_tokens": [],
            "null_token_case_insensitive": true,
            "case_insensitive": false,
            "trim_whitespace": false,
            "date_normalization": { "enabled": false, "formats": [] }
        },
        "results": [],
        "summary": {
            "total_rows_a": 1,
            "total_rows_b": 1,
            "matches": 0,
            "mismatches": 0,
            "missing_left": 0,
            "missing_right": 0,
            "unkeyed_left": 0,
            "unkeyed_right": 0,
            "duplicates_a": 0,
            "duplicates_b": 0
        }
    });

    let error =
        load_comparison_snapshot_workflow(&mut SessionData::new(), &legacy_snapshot.to_string())
            .unwrap_err();

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        error.to_string(),
        "Unsupported comparison snapshot version 1 — this file was produced by an older csv-align release. Re-run the comparison in v2."
    );
}

#[test]
fn comparison_snapshot_load_rejects_summary_mismatches() {
    let session = prepared_snapshot_session();
    let mut saved: serde_json::Value =
        serde_json::from_str(&save_comparison_snapshot_workflow(&session).unwrap()).unwrap();

    saved["summary"]["matches"] = serde_json::json!(999);

    let error =
        load_comparison_snapshot_workflow(&mut SessionData::new(), &saved.to_string()).unwrap_err();

    assert!(matches!(error, CsvAlignError::BadInput(_)));
    assert_eq!(
        error.to_string(),
        "Saved comparison snapshot summary does not match the persisted results"
    );
}
