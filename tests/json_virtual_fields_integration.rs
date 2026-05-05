use csv_align::backend::{
    CompareRequest, CsvLoadSource, MappingRequest, load_csv_workflow, run_comparison,
};
use csv_align::data::csv_loader;
use csv_align::data::types::{ComparisonNormalizationConfig, FileSide, ResultType};

#[test]
fn load_csv_response_includes_discovered_virtual_json_headers() {
    let loaded = load_csv_workflow(
        "a",
        Some("metrics.csv".to_string()),
        CsvLoadSource::Bytes(
            br#"id,metrics
1,"{""metric_low_a"":10,""nested"":{""flag"":true},""samples"":[1,2]}"
2,"{""metric_high_a"":20}"
"#
            .to_vec(),
        ),
    )
    .unwrap();

    assert_eq!(loaded.response.file_letter, FileSide::A);
    assert_eq!(loaded.response.headers, vec!["id", "metrics"]);
    assert_eq!(
        loaded.response.virtual_headers,
        vec![
            "metrics.metric_high_a",
            "metrics.metric_low_a",
            "metrics.nested",
            "metrics.nested.flag",
            "metrics.samples",
        ]
    );
}

#[test]
fn comparison_supports_virtual_json_fields_for_keys_and_values() {
    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""row_key"":""A-1"",""score"":42,""active"":true,""nested"":{""rank"":1},""samples"":[1]}"
2,"{""row_key"":""A-2"",""score"":7,""active"":false,""nested"":{""rank"":2}}"
3,"not json"
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics
x,"{""row_key"":""A-1"",""score"":""42"",""active"":true,""nested"":{""rank"":1},""samples"":[1]}"
y,"{""row_key"":""A-2"",""score"":9,""active"":false,""nested"":{""rank"":3}}"
z,"{""row_key"":""A-3"",""score"":1,""active"":true}"
"#,
    )
    .unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["metrics.row_key".to_string()],
            key_columns_b: vec!["metrics.row_key".to_string()],
            comparison_columns_a: vec![
                "metrics.score".to_string(),
                "metrics.active".to_string(),
                "metrics.nested".to_string(),
                "metrics.samples".to_string(),
            ],
            comparison_columns_b: vec![
                "metrics.score".to_string(),
                "metrics.active".to_string(),
                "metrics.nested".to_string(),
                "metrics.samples".to_string(),
            ],
            column_mappings: Vec::new(),
            normalization: ComparisonNormalizationConfig {
                treat_empty_as_null: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .unwrap();

    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.summary.mismatches, 1);
    assert_eq!(execution.response.summary.missing_left, 1);
    assert_eq!(execution.response.summary.unkeyed_right, 1);

    let matched = execution
        .response
        .results
        .iter()
        .find(|result| result.result_type == ResultType::Match)
        .unwrap();
    assert_eq!(matched.key, vec!["A-1"]);
    assert_eq!(matched.values_a, vec!["42", "true", r#"{"rank":1}"#, "[1]"]);

    let mismatch = execution
        .response
        .results
        .iter()
        .find(|result| result.result_type == ResultType::Mismatch)
        .unwrap();
    assert_eq!(mismatch.key, vec!["A-2"]);
    assert_eq!(mismatch.differences.len(), 2);
}

#[test]
fn exact_physical_header_names_win_over_dot_notation_parsing() {
    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics,metrics.metric_low_a
1,"{""metric_low_a"":""json-a""}",physical-a
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics,metrics.metric_low_a
1,"{""metric_low_a"":""json-b""}",physical-b
"#,
    )
    .unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["metrics.metric_low_a".to_string()],
            comparison_columns_b: vec!["metrics.metric_low_a".to_string()],
            column_mappings: vec![MappingRequest {
                file_a_column: "metrics.metric_low_a".to_string(),
                file_b_column: "metrics.metric_low_a".to_string(),
                mapping_type: "manual".to_string(),
                similarity: None,
            }],
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();

    let result = &execution.response.results[0];
    assert_eq!(result.values_a, vec!["physical-a"]);
    assert_eq!(result.values_b, vec!["physical-b"]);
    assert_eq!(result.differences[0].value_a, "physical-a");
    assert_eq!(result.differences[0].value_b, "physical-b");
}

#[test]
fn virtual_json_fields_escape_dotted_object_keys() {
    let loaded = load_csv_workflow(
        "a",
        Some("metrics.csv".to_string()),
        CsvLoadSource::Bytes(
            br#"id,metrics
1,"{""customer.id"":""flat-a"",""customer"":{""id"":""nested-a""}}"
"#
            .to_vec(),
        ),
    )
    .unwrap();

    assert_eq!(
        loaded.response.virtual_headers,
        vec![
            "metrics.customer",
            "metrics.customer.id",
            "metrics.customer\\.id",
        ]
    );
}

#[test]
fn comparison_distinguishes_dotted_json_keys_from_nested_paths() {
    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""customer.id"":""flat-a"",""customer"":{""id"":""nested-a""}}"
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""customer.id"":""flat-b"",""customer"":{""id"":""nested-b""}}"
"#,
    )
    .unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec![
                "metrics.customer\\.id".to_string(),
                "metrics.customer.id".to_string(),
            ],
            comparison_columns_b: vec![
                "metrics.customer\\.id".to_string(),
                "metrics.customer.id".to_string(),
            ],
            column_mappings: Vec::new(),
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();

    let result = &execution.response.results[0];
    assert_eq!(result.values_a, vec!["flat-a", "nested-a"]);
    assert_eq!(result.values_b, vec!["flat-b", "nested-b"]);
    assert_eq!(result.differences[0].column_a, "metrics.customer\\.id");
    assert_eq!(result.differences[1].column_a, "metrics.customer.id");
}

#[test]
fn virtual_json_fields_use_explicit_source_separator_when_physical_headers_share_prefixes() {
    let loaded = load_csv_workflow(
        "a",
        Some("metrics.csv".to_string()),
        CsvLoadSource::Bytes(
            br#"id,metrics,metrics.customer
1,"{""customer"":{""id"":""from-metrics""}}","{""id"":""from-prefixed-header""}"
"#
            .to_vec(),
        ),
    )
    .unwrap();

    assert_eq!(
        loaded.response.virtual_headers,
        vec![
            "metrics#customer",
            "metrics#customer.id",
            "metrics.customer#id"
        ]
    );

    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics,metrics.customer
1,"{""customer"":{""id"":""from-metrics-a""}}","{""id"":""from-prefixed-a""}"
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics,metrics.customer
1,"{""customer"":{""id"":""from-metrics-b""}}","{""id"":""from-prefixed-b""}"
"#,
    )
    .unwrap();

    let execution = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec![
                "metrics#customer.id".to_string(),
                "metrics.customer#id".to_string(),
            ],
            comparison_columns_b: vec![
                "metrics#customer.id".to_string(),
                "metrics.customer#id".to_string(),
            ],
            column_mappings: Vec::new(),
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .unwrap();

    let result = &execution.response.results[0];
    assert_eq!(result.values_a, vec!["from-metrics-a", "from-prefixed-a"]);
    assert_eq!(result.values_b, vec!["from-metrics-b", "from-prefixed-b"]);
}

#[test]
fn virtual_field_validation_rejects_undiscovered_json_paths() {
    let csv_a = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""known"":1}"
"#,
    )
    .unwrap();
    let csv_b = csv_loader::load_csv_from_bytes(
        br#"id,metrics
1,"{""known"":1}"
"#,
    )
    .unwrap();

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["metrics.missing".to_string()],
            comparison_columns_b: vec!["metrics.known".to_string()],
            column_mappings: Vec::new(),
            normalization: ComparisonNormalizationConfig::default(),
        },
    )
    .expect_err("undiscovered virtual field should be rejected");

    assert!(error.to_string().contains("metrics.missing"));
}
