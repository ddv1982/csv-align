mod common;

use csv_align::backend::{run_comparison, CompareRequest};
use csv_align::data::types::ComparisonNormalizationConfig;

use common::csv_data;

#[test]
fn comparison_rejects_empty_key_values_when_empty_is_normalized_to_null() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&[" ", "Alice"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["1", "Alice"]]);

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig {
                treat_empty_as_null: true,
                trim_whitespace: true,
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .unwrap_err();

    assert!(error.contains(
        "Key columns for File A contain nullish or empty values under the active normalization rules: id"
    ));
}

#[test]
fn comparison_rejects_configured_null_tokens_in_key_values() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["NULL", "Alice"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["1", "Alice"]]);

    let error = run_comparison(
        &csv_a,
        &csv_b,
        CompareRequest {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["value".to_string()],
            column_mappings: vec![],
            normalization: ComparisonNormalizationConfig {
                null_tokens: vec!["null".to_string()],
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .unwrap_err();

    assert!(error.contains(
        "Key columns for File A contain nullish or empty values under the active normalization rules: id"
    ));
}
