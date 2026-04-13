use csv_align::comparison::engine::{compare_csv_data, generate_summary};
use csv_align::data::types::*;

fn create_test_csv_a() -> CsvData {
    CsvData {
        file_path: Some("test_a.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string(), "value".to_string()],
        rows: vec![
            vec!["1".to_string(), "Alice".to_string(), "100".to_string()],
            vec!["2".to_string(), "Bob".to_string(), "200".to_string()],
            vec!["3".to_string(), "Charlie".to_string(), "300".to_string()],
            vec!["2".to_string(), "Bob".to_string(), "200".to_string()], // duplicate
        ],
    }
}

fn create_test_csv_b() -> CsvData {
    CsvData {
        file_path: Some("test_b.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string(), "amount".to_string()],
        rows: vec![
            vec!["1".to_string(), "Alice".to_string(), "100".to_string()],
            vec!["2".to_string(), "Robert".to_string(), "200".to_string()], // mismatch
            vec!["4".to_string(), "David".to_string(), "400".to_string()],  // missing left
        ],
    }
}

fn create_test_config() -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string(), "value".to_string()],
        comparison_columns_b: vec!["name".to_string(), "amount".to_string()],
        column_mappings: vec![
            ColumnMapping {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: MappingType::ExactMatch,
            },
            ColumnMapping {
                file_a_column: "value".to_string(),
                file_b_column: "amount".to_string(),
                mapping_type: MappingType::ExactMatch,
            },
        ],
        normalization: ComparisonNormalizationConfig::default(),
    }
}

#[test]
fn test_compare_csv_data() {
    let csv_a = create_test_csv_a();
    let csv_b = create_test_csv_b();
    let config = create_test_config();

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 5);

    let matches = results
        .iter()
        .filter(|r| matches!(r, RowComparisonResult::Match { .. }))
        .count();
    let mismatches = results
        .iter()
        .filter(|r| matches!(r, RowComparisonResult::Mismatch { .. }))
        .count();
    let missing_left = results
        .iter()
        .filter(|r| matches!(r, RowComparisonResult::MissingLeft { .. }))
        .count();
    let missing_right = results
        .iter()
        .filter(|r| matches!(r, RowComparisonResult::MissingRight { .. }))
        .count();
    let duplicates = results
        .iter()
        .filter(|r| matches!(r, RowComparisonResult::Duplicate { .. }))
        .count();

    assert_eq!(matches, 1);
    assert_eq!(mismatches, 1);
    assert_eq!(missing_left, 1);
    assert_eq!(missing_right, 1);
    assert_eq!(duplicates, 1);
}

#[test]
fn test_generate_summary() {
    let results = vec![
        RowComparisonResult::Match {
            key: vec!["1".to_string()],
            values_a: vec![],
            values_b: vec![],
        },
        RowComparisonResult::Mismatch {
            key: vec!["2".to_string()],
            values_a: vec![],
            values_b: vec![],
            differences: vec![],
        },
        RowComparisonResult::MissingLeft {
            key: vec!["3".to_string()],
            values_b: vec![],
        },
    ];

    let summary = generate_summary(&results, 2, 3);

    assert_eq!(summary.total_rows_a, 2);
    assert_eq!(summary.total_rows_b, 3);
    assert_eq!(summary.matches, 1);
    assert_eq!(summary.mismatches, 1);
    assert_eq!(summary.missing_left, 1);
}

#[test]
fn test_compare_csv_data_detects_mismatch_for_mapped_columns_with_different_names() {
    let csv_a = CsvData {
        file_path: Some("test_a.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string(), "value".to_string()],
        rows: vec![vec![
            "1".to_string(),
            "Alice".to_string(),
            "100".to_string(),
        ]],
    };

    let csv_b = CsvData {
        file_path: Some("test_b.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string(), "amount".to_string()],
        rows: vec![vec![
            "1".to_string(),
            "Alice".to_string(),
            "999".to_string(),
        ]],
    };

    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string(), "value".to_string()],
        comparison_columns_b: vec!["name".to_string(), "amount".to_string()],
        column_mappings: vec![
            ColumnMapping {
                file_a_column: "name".to_string(),
                file_b_column: "name".to_string(),
                mapping_type: MappingType::ExactMatch,
            },
            ColumnMapping {
                file_a_column: "value".to_string(),
                file_b_column: "amount".to_string(),
                mapping_type: MappingType::ExactMatch,
            },
        ],
        normalization: ComparisonNormalizationConfig::default(),
    };

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Mismatch { differences, .. } => {
            assert_eq!(differences.len(), 1);
            assert_eq!(differences[0].column_a, "value");
            assert_eq!(differences[0].column_b, "amount");
            assert_eq!(differences[0].value_a, "100");
            assert_eq!(differences[0].value_b, "999");
        }
        _ => panic!("Expected mismatch result for mapped column difference"),
    }
}

#[test]
fn test_compare_csv_data_detects_mismatch_without_explicit_mapping_by_position() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "city".to_string()],
        rows: vec![vec!["1".to_string(), "Berlin".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "location".to_string()],
        rows: vec![vec!["1".to_string(), "Paris".to_string()]],
    };

    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["city".to_string()],
        comparison_columns_b: vec!["location".to_string()],
        column_mappings: vec![],
        normalization: ComparisonNormalizationConfig::default(),
    };

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Mismatch { differences, .. } => {
            assert_eq!(differences.len(), 1);
            assert_eq!(differences[0].column_a, "city");
            assert_eq!(differences[0].column_b, "location");
            assert_eq!(differences[0].value_a, "Berlin");
            assert_eq!(differences[0].value_b, "Paris");
        }
        _ => panic!("Expected mismatch result when positional comparison values differ"),
    }
}

fn create_json_compare_config() -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["payload".to_string()],
        comparison_columns_b: vec!["payload".to_string()],
        column_mappings: vec![ColumnMapping {
            file_a_column: "payload".to_string(),
            file_b_column: "payload".to_string(),
            mapping_type: MappingType::ExactMatch,
        }],
        normalization: ComparisonNormalizationConfig::default(),
    }
}

#[test]
fn test_compare_csv_data_matches_semantically_equivalent_json_values() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec!["1".to_string(), "{\"a\":1,\"b\":[2,3]}".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec![
            "1".to_string(),
            "{\n  \"b\": [2, 3], \"a\": 1\n}".to_string(),
        ]],
    };

    let results = compare_csv_data(&csv_a, &csv_b, &create_json_compare_config());
    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn test_compare_csv_data_detects_non_equivalent_json_values() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec!["1".to_string(), "{\"a\":1,\"b\":[2,3]}".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec!["1".to_string(), "{\"a\":1,\"b\":[2,4]}".to_string()]],
    };

    let results = compare_csv_data(&csv_a, &csv_b, &create_json_compare_config());
    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Mismatch { differences, .. } => {
            assert_eq!(differences.len(), 1);
            assert_eq!(differences[0].column_a, "payload");
            assert_eq!(differences[0].column_b, "payload");
        }
        _ => panic!("Expected mismatch result for non-equivalent JSON values"),
    }
}

#[test]
fn test_compare_csv_data_uses_raw_string_comparison_for_malformed_json() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec!["1".to_string(), "{\"a\":1".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "payload".to_string()],
        rows: vec![vec!["1".to_string(), "{\"a\": 1".to_string()]],
    };

    let results = compare_csv_data(&csv_a, &csv_b, &create_json_compare_config());
    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Mismatch { differences, .. } => {
            assert_eq!(differences.len(), 1);
            assert_eq!(differences[0].value_a, "{\"a\":1");
            assert_eq!(differences[0].value_b, "{\"a\": 1");
        }
        _ => panic!(
            "Expected mismatch result when malformed JSON falls back to raw string comparison"
        ),
    }
}

fn create_normalization_test_config(
    normalization: ComparisonNormalizationConfig,
) -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["value".to_string()],
        comparison_columns_b: vec!["value".to_string()],
        column_mappings: vec![ColumnMapping {
            file_a_column: "value".to_string(),
            file_b_column: "value".to_string(),
            mapping_type: MappingType::ExactMatch,
        }],
        normalization,
    }
}

#[test]
fn test_compare_csv_data_matches_empty_and_null_token_when_configured() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "null".to_string()]],
    };

    let config = create_normalization_test_config(ComparisonNormalizationConfig {
        treat_empty_as_null: true,
        null_tokens: vec!["null".to_string()],
        null_token_case_insensitive: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn test_compare_csv_data_matches_case_insensitive_values_when_enabled() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "sparrow".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "SPARROW".to_string()]],
    };

    let config = create_normalization_test_config(ComparisonNormalizationConfig {
        case_insensitive: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn test_compare_csv_data_matches_date_formats_when_enabled() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "2026-04-13".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "13/04/2026".to_string()]],
    };

    let config = create_normalization_test_config(ComparisonNormalizationConfig {
        date_normalization: DateNormalizationConfig {
            enabled: true,
            formats: vec!["%Y-%m-%d".to_string(), "%d/%m/%Y".to_string()],
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn test_compare_csv_data_matches_default_normalized_month_name_dates_without_custom_formats() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "18-FEB-19".to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), "2019-02-18".to_string()]],
    };

    let config = create_normalization_test_config(ComparisonNormalizationConfig {
        date_normalization: DateNormalizationConfig {
            enabled: true,
            formats: vec![],
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}
