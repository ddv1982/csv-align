use csv_align::backend::{
    CompareRequest, MappingRequest, PairOrderSelection, SessionData, apply_csv_to_session,
    load_comparison_snapshot_workflow, load_pair_order_workflow, run_comparison,
    save_comparison_snapshot_workflow, save_pair_order_workflow,
};
use csv_align::data::csv_loader;
use csv_align::data::types::{ComparisonNormalizationConfig, FileSide, ResultType};

#[test]
fn pair_order_persistence_round_trips_virtual_field_labels() {
    let mut session = SessionData::new();
    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""row_key"":""K1"",""score"":1}"
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""row_key"":""K1"",""score"":1}"
"#,
    )
    .unwrap();

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let selection = PairOrderSelection {
        key_columns_a: vec!["metrics.row_key".to_string()],
        key_columns_b: vec!["metrics.row_key".to_string()],
        comparison_columns_a: vec!["metrics.score".to_string()],
        comparison_columns_b: vec!["metrics.score".to_string()],
    };

    let contents = save_pair_order_workflow(&session, selection.clone()).unwrap();
    let loaded = load_pair_order_workflow(&session, &contents).unwrap();

    assert_eq!(loaded.selection, selection);
}

#[test]
fn pair_order_load_validates_virtual_labels_against_current_physical_sources() {
    let mut session = SessionData::new();
    let csv_a = csv_loader::load_csv_from_bytes(b"id,metrics\n1,{}\n").unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(b"id,metrics\n1,{}\n").unwrap();

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let contents = serde_json::json!({
        "version": 1,
        "headers_a": ["id", "metrics"],
        "headers_b": ["id", "metrics"],
        "selection": {
            "key_columns_a": ["metrics.row_key"],
            "key_columns_b": ["metrics.row_key"],
            "comparison_columns_a": ["metrics.score"],
            "comparison_columns_b": ["metrics.score"]
        }
    })
    .to_string();

    let loaded = load_pair_order_workflow(&session, &contents).unwrap();

    assert_eq!(loaded.selection.key_columns_a, vec!["metrics.row_key"]);
    assert_eq!(loaded.selection.comparison_columns_b, vec!["metrics.score"]);
}

#[test]
fn comparison_snapshot_persistence_accepts_virtual_field_labels() {
    let mut session = SessionData::new();
    let mut csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""row_key"":""K1"",""score"":5}"
2,"{""row_key"":""K2"",""score"":6}"
"#,
    )
    .unwrap();
    csv_a.file_path = Some("left.csv".to_string());
    let mut csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics
a,"{""row_key"":""K1"",""score"":5}"
b,"{""row_key"":""K2"",""score"":7}"
"#,
    )
    .unwrap();
    csv_b.file_path = Some("right.csv".to_string());

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let csv_a = session.csv_a.as_ref().unwrap();
    let csv_b = session.csv_b.as_ref().unwrap();
    let execution = run_comparison(
        csv_a.as_ref(),
        csv_b.as_ref(),
        CompareRequest {
            key_columns_a: vec!["metrics.row_key".to_string()],
            key_columns_b: vec!["metrics.row_key".to_string()],
            comparison_columns_a: vec!["metrics.score".to_string()],
            comparison_columns_b: vec!["metrics.score".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "metrics.score".to_string(),
                file_b_column: "metrics.score".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();

    session.comparison_results = execution.results;
    session.comparison_config = Some(execution.config);

    let contents = save_comparison_snapshot_workflow(&session).unwrap();
    let mut loaded_session = SessionData::new();
    let loaded = load_comparison_snapshot_workflow(&mut loaded_session, &contents).unwrap();

    assert_eq!(loaded.selection.key_columns_a, vec!["metrics.row_key"]);
    assert_eq!(loaded.selection.comparison_columns_a, vec!["metrics.score"]);
    assert_eq!(
        loaded.file_a.virtual_headers,
        vec!["metrics.row_key", "metrics.score"]
    );
    assert_eq!(
        loaded.file_b.virtual_headers,
        vec!["metrics.row_key", "metrics.score"]
    );
    assert_eq!(loaded.summary.mismatches, 1);
    let mismatch = loaded
        .results
        .iter()
        .find(|result| result.result_type == ResultType::Mismatch)
        .unwrap();
    assert_eq!(mismatch.differences[0].column_a, "metrics.score");
}
