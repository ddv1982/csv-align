mod common;

use csv_align::comparison::engine::{compare_csv_data, generate_summary};
use csv_align::data::types::{
    ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData,
    DateNormalizationConfig, MappingType, RowComparisonResult,
};

use common::{comparison_config, csv_data};

fn create_test_csv_a() -> CsvData {
    csv_data(
        "test_a.csv",
        &["id", "name", "value"],
        &[
            &["1", "Alice", "100"],
            &["2", "Bob", "200"],
            &["3", "Charlie", "300"],
            &["2", "Bob", "200"],
        ],
    )
}

fn create_test_csv_b() -> CsvData {
    csv_data(
        "test_b.csv",
        &["id", "name", "amount"],
        &[
            &["1", "Alice", "100"],
            &["2", "Robert", "200"],
            &["4", "David", "400"],
        ],
    )
}

fn create_test_config() -> ComparisonConfig {
    comparison_config(
        &["id"],
        &["id"],
        &["name", "value"],
        &["name", "amount"],
        &[("name", "name"), ("value", "amount")],
        ComparisonNormalizationConfig::default(),
    )
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

    let duplicate = results
        .iter()
        .find(|result| matches!(result, RowComparisonResult::Duplicate { .. }))
        .expect("expected duplicate result");

    match duplicate {
        RowComparisonResult::Duplicate {
            key,
            values_a,
            values_b,
        } => {
            assert_eq!(key, &vec!["2".to_string()]);
            assert_eq!(values_a.len(), 2);
            assert!(values_b.is_empty());
            assert_eq!(values_a[0], vec!["Bob".to_string(), "200".to_string()]);
            assert_eq!(values_a[1], vec!["Bob".to_string(), "200".to_string()]);
        }
        _ => unreachable!(),
    }
}

#[test]
fn test_compare_csv_data_keeps_duplicate_rows_grouped_by_side() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string()],
        rows: vec![
            vec!["9".to_string(), "Alpha".to_string()],
            vec!["9".to_string(), "Beta".to_string()],
        ],
    };
    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "label".to_string()],
        rows: vec![
            vec!["9".to_string(), "Gamma".to_string()],
            vec!["9".to_string(), "Second".to_string()],
        ],
    };
    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["label".to_string()],
        column_mappings: vec![],
        normalization: ComparisonNormalizationConfig::default(),
    };

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Duplicate {
            key,
            values_a,
            values_b,
        } => {
            assert_eq!(key, &vec!["9".to_string()]);
            assert_eq!(
                values_a,
                &vec![vec!["Alpha".to_string()], vec!["Beta".to_string()]]
            );
            assert_eq!(
                values_b,
                &vec![vec!["Gamma".to_string()], vec!["Second".to_string()]]
            );
        }
        _ => panic!("expected duplicate result when both files contain duplicates"),
    }
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
    comparison_config(
        &["id"],
        &["id"],
        &["payload"],
        &["payload"],
        &[("payload", "payload")],
        ComparisonNormalizationConfig::default(),
    )
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
    comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        normalization,
    )
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
fn test_compare_csv_data_keeps_match_values_in_selected_order_when_explicit_mapping_order_differs()
{
    let csv_a = csv_data(
        "left.csv",
        &["id", "first_name", "nickname"],
        &[&["1", "Alice", ""]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "alias", "full_name"],
        &[&["1", "null", "Alice"]],
    );
    let config = comparison_config(
        &["id"],
        &["id"],
        &["first_name", "nickname"],
        &["alias", "full_name"],
        &[("first_name", "full_name"), ("nickname", "alias")],
        ComparisonNormalizationConfig {
            treat_empty_as_null: true,
            null_tokens: vec!["null".to_string()],
            null_token_case_insensitive: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 1);

    match &results[0] {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["Alice".to_string(), "".to_string()]);
            assert_eq!(values_b, &vec!["null".to_string(), "Alice".to_string()]);
        }
        _ => panic!("expected null-equal mapped values to remain a match"),
    }
}

#[test]
fn test_compare_csv_data_keeps_manual_mapping_alignment_for_null_equal_sample_rows() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "display_name", "status_code"],
        &[&["1", "Alice", ""], &["2", "Bri", "ACTIVE"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["record_id", "state_label", "full_name"],
        &[&["1", "null", "Alice"], &["2", "ACTIVE", "Bri"]],
    );
    let config = comparison_config(
        &["id"],
        &["record_id"],
        &["display_name", "status_code"],
        &["state_label", "full_name"],
        &[
            ("display_name", "full_name"),
            ("status_code", "state_label"),
        ],
        ComparisonNormalizationConfig {
            treat_empty_as_null: true,
            null_tokens: vec!["null".to_string()],
            null_token_case_insensitive: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    assert_eq!(results.len(), 2);

    let first_result = results
        .iter()
        .find(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["1".to_string()]))
        .expect("expected a match result for key 1");

    match first_result {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["Alice".to_string(), "".to_string()]);
            assert_eq!(values_b, &vec!["null".to_string(), "Alice".to_string()]);
        }
        _ => panic!("expected first sample row to stay matched with null-equal values"),
    }

    let second_result = results
        .iter()
        .find(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["2".to_string()]))
        .expect("expected a match result for key 2");

    match second_result {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["Bri".to_string(), "ACTIVE".to_string()]);
            assert_eq!(values_b, &vec!["ACTIVE".to_string(), "Bri".to_string()]);
        }
        _ => panic!("expected second sample row to stay matched in selected order"),
    }
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

fn create_flexible_key_test_config(flexible_key_matching: bool) -> ComparisonConfig {
    comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching,
            ..ComparisonNormalizationConfig::default()
        },
    )
}

#[test]
fn test_compare_csv_data_keeps_double_asterisk_literal_when_flexible_key_matching_is_off() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-001", "same"]]);
    let config = create_flexible_key_test_config(false);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingRight { key, .. } if key == &vec!["INV-**".to_string()]))
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingLeft { key, .. } if key == &vec!["INV-001".to_string()]))
    );
}

#[test]
fn test_compare_csv_data_matches_file_a_double_asterisk_key_when_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-001", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["INV-**".to_string()])
    );
}

#[test]
fn test_compare_csv_data_keeps_single_asterisk_literal_when_flexible_key_matching_is_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-*", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-001", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingRight { key, .. } if key == &vec!["INV-*".to_string()]))
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingLeft { key, .. } if key == &vec!["INV-001".to_string()]))
    );
}

#[test]
fn test_compare_csv_data_double_asterisk_matches_zero_characters() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["INV-**".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_infix_double_asterisk_patterns() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["A**C", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["ABC", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["A**C".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_file_b_double_asterisk_key_when_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["CUSTOMER-NL", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["**-NL", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["CUSTOMER-NL".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_when_both_sides_contain_double_asterisk_patterns() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-2026-**", "same"]]);
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["INV-2026-**-001", "same"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["INV-2026-**".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_overlapping_double_asterisk_patterns_on_both_sides() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**-A", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-B-**", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["INV-**-A".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_double_asterisk_across_key_component_boundaries() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP**TAIL", "CODE", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "same"]],
    );
    let config = comparison_config(
        &["part_a", "part_b"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(
        &results[0],
        RowComparisonResult::Match { key, .. }
            if key == &vec!["GROUP**TAIL".to_string(), "CODE".to_string()]
    ));
}

#[test]
fn test_compare_csv_data_matches_double_asterisk_across_mismatched_key_component_counts() {
    let csv_a = csv_data(
        "left.csv",
        &["composite", "value"],
        &[&["GROUP**CODE", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "same"]],
    );
    let config = comparison_config(
        &["composite"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(
        &results[0],
        RowComparisonResult::Match { key, .. } if key == &vec!["GROUP**CODE".to_string()]
    ));
}

#[test]
fn test_compare_csv_data_matches_file_b_double_asterisk_across_mismatched_key_component_counts() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "part_c", "value"],
        &[&["GROUP", "MIDDLE", "TAIL", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["composite", "suffix", "value"],
        &[&["GROUP**", "TAIL", "same"]],
    );
    let config = comparison_config(
        &["part_a", "part_b", "part_c"],
        &["composite", "suffix"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(
        &results[0],
        RowComparisonResult::Match { key, .. }
            if key == &vec!["GROUP".to_string(), "MIDDLE".to_string(), "TAIL".to_string()]
    ));
}

#[test]
fn test_compare_csv_data_matches_single_key_shared_anchored_tokens_when_flexible_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["Node RF 7", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["Remote Node 7", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["Node RF 7".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_multi_key_shared_anchored_tokens_when_flexible_enabled() {
    let csv_a = csv_data(
        "left.csv",
        &["name", "cycle", "value"],
        &[&["Node RF", "7", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["name", "cycle", "value"],
        &[&["Remote Node", "7", "same"]],
    );
    let config = comparison_config(
        &["name", "cycle"],
        &["name", "cycle"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(
        &results[0],
        RowComparisonResult::Match { key, .. }
            if key == &vec!["Node RF".to_string(), "7".to_string()]
    ));
}

#[test]
fn test_compare_csv_data_keeps_shared_anchored_tokens_exact_only_when_flexible_is_off() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["NODE RF 7", "left"]]);
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["Remote Node 7", "right"]],
    );
    let config = create_flexible_key_test_config(false);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["NODE RF 7".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["Remote Node 7".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_same_category_with_conflicting_numeric_key_part() {
    let csv_a = csv_data(
        "left.csv",
        &["category", "id", "value"],
        &[&["GROUP", "001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["category", "id", "value"],
        &[&["GROUP", "002", "right"]],
    );
    let config = comparison_config(
        &["category", "id"],
        &["category", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP".to_string(), "001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["GROUP".to_string(), "002".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_one_sided_numeric_token_in_shared_component() {
    let csv_a = csv_data(
        "left.csv",
        &["category", "id", "value"],
        &[&["GROUP", "NODE 7", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["category", "id", "value"],
        &[&["GROUP", "Remote Node", "right"]],
    );
    let config = comparison_config(
        &["category", "id"],
        &["category", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP".to_string(), "NODE 7".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["GROUP".to_string(), "Remote Node".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_matches_case_variant_shared_anchored_tokens_when_flexible_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["NODE RF 7", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["Remote node 7", "same"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["NODE RF 7".to_string()])
    );
}

#[test]
fn test_compare_csv_data_matches_multi_key_case_variant_shared_anchored_tokens_when_flexible_enabled()
 {
    let csv_a = csv_data(
        "left.csv",
        &["name", "cycle", "value"],
        &[&["HARBOR", "42", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["name", "cycle", "value"],
        &[&["2048 Harbor", "42", "same"]],
    );
    let config = comparison_config(
        &["name", "cycle"],
        &["name", "cycle"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(
        &results[0],
        RowComparisonResult::Match { key, .. }
            if key == &vec!["HARBOR".to_string(), "42".to_string()]
    ));
}

#[test]
fn test_compare_csv_data_allows_case_insensitive_shared_anchored_tokens_when_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["NODE RF 7", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["Remote node 7", "same"]]);
    let config = comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            case_insensitive: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["NODE RF 7".to_string()])
    );
}

#[test]
fn test_compare_csv_data_rejects_conflicting_alphanumeric_identifiers_with_exact_anchor() {
    let csv_a = csv_data(
        "left.csv",
        &["category", "id", "value"],
        &[&["GROUP", "COMMON A001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["category", "id", "value"],
        &[&["GROUP", "COMMON B002", "right"]],
    );
    let config = comparison_config(
        &["category", "id"],
        &["category", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP".to_string(), "COMMON A001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["GROUP".to_string(), "COMMON B002".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_conflicting_alphanumeric_identifiers_with_exact_numeric_anchor() {
    let csv_a = csv_data(
        "left.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON A001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON B002", "right"]],
    );
    let config = comparison_config(
        &["cycle", "id"],
        &["cycle", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["42".to_string(), "COMMON A001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["42".to_string(), "COMMON B002".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_matching_embedded_digits_with_different_identifier_prefixes() {
    let csv_a = csv_data(
        "left.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON A001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON B001", "right"]],
    );
    let config = comparison_config(
        &["cycle", "id"],
        &["cycle", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["42".to_string(), "COMMON A001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["42".to_string(), "COMMON B001".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_one_sided_embedded_identifier_with_exact_numeric_anchor() {
    let csv_a = csv_data(
        "left.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON A001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["cycle", "id", "value"],
        &[&["42", "COMMON", "right"]],
    );
    let config = comparison_config(
        &["cycle", "id"],
        &["cycle", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["42".to_string(), "COMMON A001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["42".to_string(), "COMMON".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_one_sided_standalone_number_with_exact_text_anchor() {
    let csv_a = csv_data(
        "left.csv",
        &["category", "id", "value"],
        &[&["GROUP 42", "COMMON", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["category", "id", "value"],
        &[&["GROUP 42", "2048 COMMON", "right"]],
    );
    let config = comparison_config(
        &["category", "id"],
        &["category", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP 42".to_string(), "COMMON".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["GROUP 42".to_string(), "2048 COMMON".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_conflicting_alphanumeric_identifiers_without_exact_anchor() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["COMMON NODE A001", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["COMMON NODE B002", "right"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["COMMON NODE A001".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["COMMON NODE B002".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_weak_shared_text_without_second_anchor() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["NODE RF", "left"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["Remote Node", "right"]]);
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, .. }
                if key == &vec!["NODE RF".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, .. }
                if key == &vec!["Remote Node".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_handles_dense_mismatched_double_asterisk_candidate_set() {
    const ROW_COUNT: usize = 24;

    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec![
            "wild".to_string(),
            "file_a_id".to_string(),
            "value".to_string(),
        ],
        rows: (0..ROW_COUNT)
            .map(|index| vec!["**".to_string(), format!("A{index:02}"), "same".to_string()])
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
                    format!("B{index:02}"),
                    "MIDDLE".to_string(),
                    "**".to_string(),
                    "same".to_string(),
                ]
            })
            .collect(),
    };
    let config = comparison_config(
        &["wild", "file_a_id"],
        &["file_b_id", "literal", "wild"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), ROW_COUNT);
    assert_eq!(
        results
            .iter()
            .filter(|result| matches!(result, RowComparisonResult::Match { .. }))
            .count(),
        ROW_COUNT
    );
    assert!(results.iter().all(|result| {
        matches!(
            result,
            RowComparisonResult::Match { key, .. }
                if key.len() == 2 && key[0] == "**" && key[1].starts_with('A')
        )
    }));
}

#[test]
fn test_compare_csv_data_does_not_concatenate_mismatched_key_counts_without_double_asterisk() {
    let csv_a = csv_data(
        "left.csv",
        &["composite", "value"],
        &[&["GROUPTAIL", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAIL", "right"]],
    );
    let config = comparison_config(
        &["composite"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUPTAIL".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["GROUP".to_string(), "TAIL".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_keeps_missing_results_for_mismatched_key_counts_without_wildcard_bridge() {
    let csv_a = csv_data(
        "left.csv",
        &["composite", "value"],
        &[&["GROUP**CODE", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["OTHER", "TAILCODE", "right"]],
    );
    let config = comparison_config(
        &["composite"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP**CODE".to_string()]
                    && values_a == &vec!["left".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, values_b }
                if key == &vec!["OTHER".to_string(), "TAILCODE".to_string()]
                    && values_b == &vec!["right".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_keeps_single_asterisk_literal_with_mismatched_key_counts() {
    let csv_a = csv_data(
        "left.csv",
        &["composite", "value"],
        &[&["GROUP*CODE", "left"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "right"]],
    );
    let config = comparison_config(
        &["composite"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, .. }
                if key == &vec!["GROUP*CODE".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, .. }
                if key == &vec!["GROUP".to_string(), "TAILCODE".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_does_not_redistribute_key_components_without_double_asterisk() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUPTAIL", "CODE", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "same"]],
    );
    let config = comparison_config(
        &["part_a", "part_b"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, .. }
                if key == &vec!["GROUPTAIL".to_string(), "CODE".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, .. }
                if key == &vec!["GROUP".to_string(), "TAILCODE".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_keeps_single_asterisk_literal_across_key_component_boundaries() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP*TAIL", "CODE", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "same"]],
    );
    let config = comparison_config(
        &["part_a", "part_b"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, .. }
                if key == &vec!["GROUP*TAIL".to_string(), "CODE".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, .. }
                if key == &vec!["GROUP".to_string(), "TAILCODE".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_rejects_boundary_redistribution_unrelated_to_double_asterisk() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "value"],
        &[&["HARBOR", "OMEGA**", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["AL", "PHAOMEGAX", "same"]],
    );
    let config = comparison_config(
        &["part_a", "part_b"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, .. }
                if key == &vec!["HARBOR".to_string(), "OMEGA**".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingLeft { key, .. }
                if key == &vec!["AL".to_string(), "PHAOMEGAX".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_prefers_component_wildcard_match_before_boundary_fallback() {
    let csv_a = csv_data(
        "left.csv",
        &["part_a", "part_b", "value"],
        &[
            &["GROUP**TAIL", "CODE", "fallback"],
            &["GROUP**", "TAILCODE", "component"],
        ],
    );
    let csv_b = csv_data(
        "right.csv",
        &["part_a", "part_b", "value"],
        &[&["GROUP", "TAILCODE", "component"]],
    );
    let config = comparison_config(
        &["part_a", "part_b"],
        &["part_a", "part_b"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["GROUP**".to_string(), "TAILCODE".to_string()]
                && values_a == &vec!["component".to_string()]
                && values_b == &vec!["component".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::MissingRight { key, values_a }
                if key == &vec!["GROUP**TAIL".to_string(), "CODE".to_string()]
                    && values_a == &vec!["fallback".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_matches_double_asterisk_in_multi_column_keys() {
    let csv_a = csv_data(
        "left.csv",
        &["region", "id", "value"],
        &[&["EU", "INV-**", "same"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["region", "id", "value"],
        &[&["EU", "INV-123", "same"], &["US", "INV-123", "same"]],
    );
    let config = comparison_config(
        &["region", "id"],
        &["region", "id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["EU".to_string(), "INV-**".to_string()]))
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingLeft { key, .. } if key == &vec!["US".to_string(), "INV-123".to_string()]))
    );
}

#[test]
fn test_compare_csv_data_normalizes_keys_before_double_asterisk_matching() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["  inv-**  ", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["INV-001", "same"]]);
    let config = comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            flexible_key_matching: true,
            trim_whitespace: true,
            case_insensitive: true,
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(
        matches!(&results[0], RowComparisonResult::Match { key, .. } if key == &vec!["  inv-**  ".to_string()])
    );
}

#[test]
fn test_compare_csv_data_prefers_exact_key_before_flexible_candidates() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**", "exact"]]);
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["INV-001", "wildcard"], &["INV-**", "exact"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["INV-**".to_string()]))
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingLeft { key, .. } if key == &vec!["INV-001".to_string()]))
    );
}

#[test]
fn test_compare_csv_data_uses_deterministic_specificity_for_ambiguous_flexible_keys() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["INV-**", "broad"], &["INV-2026-**", "specific"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["INV-2026-001", "specific"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["INV-2026-**".to_string()]))
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingRight { key, .. } if key == &vec!["INV-**".to_string()]))
    );
}

#[test]
fn test_compare_csv_data_maximizes_flexible_key_match_count_before_row_order() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["A**", "broad"], &["**1", "one"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["A1", "one"], &["A2", "broad"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["A**".to_string()]
                && values_a == &vec!["broad".to_string()]
                && values_b == &vec!["broad".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["**1".to_string()]
                && values_a == &vec!["one".to_string()]
                && values_b == &vec!["one".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_maximizes_flexible_keys_before_exact_wildcard_preference() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["A**", "broad"], &["A1", "one"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["A**", "one"], &["A2", "broad"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["A**".to_string()]
                && values_a == &vec!["broad".to_string()]
                && values_b == &vec!["broad".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["A1".to_string()]
                && values_a == &vec!["one".to_string()]
                && values_b == &vec!["one".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_uses_global_preference_after_maximizing_flexible_matches() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["**A", "short"], &["A**", "long"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["AA", "short"], &["AAA", "long"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["**A".to_string()]
                && values_a == &vec!["short".to_string()]
                && values_b == &vec!["short".to_string()]
        )
    }));
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["A**".to_string()]
                && values_a == &vec!["long".to_string()]
                && values_b == &vec!["long".to_string()]
        )
    }));
}

#[test]
fn test_compare_csv_data_ties_equally_specific_wildcard_matches_by_row_order_not_concrete_length() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["INV-**", "expected"]]);
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["INV-1", "expected"], &["INV-2026-000000", "later"]],
    );
    let config = create_flexible_key_test_config(true);

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 2);
    assert!(results.iter().any(|result| {
        matches!(
            result,
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } if key == &vec!["INV-**".to_string()]
                && values_a == &vec!["expected".to_string()]
                && values_b == &vec!["expected".to_string()]
        )
    }));
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::MissingLeft { key, .. } if key == &vec!["INV-2026-000000".to_string()]))
    );
}
