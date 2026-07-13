use std::sync::Arc;

use csv_align::backend::limits::MAX_VIRTUAL_LABELS;
use csv_align::backend::{
    CompareRequest, MappingRequest, SessionData, apply_csv_to_session,
    load_comparison_snapshot_workflow, run_comparison, save_comparison_snapshot_workflow,
};
use csv_align::data::csv_loader;
use csv_align::data::types::{
    ComparisonNormalizationConfig, CsvData, FileSide, RowComparisonResult,
    retained_comparison_results_bytes,
};

#[test]
fn retained_result_accounting_uses_vector_and_string_capacity() {
    let mut value = String::with_capacity(4_096);
    value.push('x');
    let results = vec![RowComparisonResult::MissingRight {
        key: vec!["1".to_string()],
        values_a: vec![value],
    }];

    let retained = retained_comparison_results_bytes(&results, results.capacity());

    assert!(retained >= 4_096);
    assert!(retained > std::mem::size_of_val(results.as_slice()));
}

#[test]
fn oversized_snapshot_catalog_is_rejected_without_mutating_the_session() {
    let mut source = SessionData::new();
    let mut csv_a = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    csv_a.file_path = Some("left.csv".to_string());
    let mut csv_b = csv_loader::load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    csv_b.file_path = Some("right.csv".to_string());
    apply_csv_to_session(&mut source, FileSide::A, csv_a).unwrap();
    apply_csv_to_session(&mut source, FileSide::B, csv_b).unwrap();

    let execution = run_comparison(
        source.csv_a.as_deref().unwrap(),
        source.csv_b.as_deref().unwrap(),
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string()],
            comparison_columns_b: vec!["name".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();
    source.comparison_results = execution.results;
    source.comparison_config = Some(execution.config);

    let mut snapshot: serde_json::Value =
        serde_json::from_str(&save_comparison_snapshot_workflow(&source).unwrap()).unwrap();
    snapshot["file_a"]["virtual_headers"] = serde_json::Value::Array(
        (0..=MAX_VIRTUAL_LABELS)
            .map(|_| serde_json::Value::String("id.extra".to_string()))
            .collect(),
    );

    let mut target = SessionData::new();
    let original = CsvData {
        file_path: Some("original.csv".to_string()),
        headers: vec!["existing".to_string()],
        rows: vec![vec!["value".to_string()]],
    };
    apply_csv_to_session(&mut target, FileSide::A, original).unwrap();
    let prior_csv = Arc::clone(target.csv_a.as_ref().unwrap());
    let prior_catalog = Arc::clone(&target.columns_a);
    let prior_revision = target.data_revision;

    let error = load_comparison_snapshot_workflow(&mut target, &snapshot.to_string())
        .expect_err("oversized snapshot catalog should fail");

    assert!(error.to_string().contains("virtual-label limit"));
    assert!(Arc::ptr_eq(target.csv_a.as_ref().unwrap(), &prior_csv));
    assert!(Arc::ptr_eq(&target.columns_a, &prior_catalog));
    assert_eq!(target.data_revision, prior_revision);
    assert!(target.comparison_results.is_empty());
    assert!(target.comparison_config.is_none());
}
