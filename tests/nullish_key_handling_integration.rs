mod common;

use csv_align::backend::{run_comparison, CompareRequest};
use csv_align::comparison::engine::compare_csv_data;
use csv_align::data::types::{ComparisonNormalizationConfig, RowComparisonResult};

use common::{comparison_config, csv_data};

#[test]
fn comparison_reports_nullish_key_rows_as_unkeyed_and_keeps_valid_matches() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[
            &[" ", "left empty"],
            &["NULL", "left token"],
            &["1", "same"],
        ],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["", "right empty"], &["1", "same"]],
    );

    let execution = run_comparison(
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
                null_tokens: vec!["null".to_string()],
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .expect("comparison should continue when some selected keys are nullish");

    assert_eq!(execution.results.len(), 4);

    let missing_right = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::MissingRight { .. }))
        .count();
    let missing_left = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::MissingLeft { .. }))
        .count();
    let unkeyed_right = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::UnkeyedRight { .. }))
        .count();
    let unkeyed_left = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::UnkeyedLeft { .. }))
        .count();
    let matches = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::Match { .. }))
        .count();
    let duplicates = execution
        .results
        .iter()
        .filter(|result| matches!(result, RowComparisonResult::Duplicate { .. }))
        .count();

    assert_eq!(missing_right, 0);
    assert_eq!(missing_left, 0);
    assert_eq!(unkeyed_right, 2);
    assert_eq!(unkeyed_left, 1);
    assert_eq!(matches, 1);
    assert_eq!(duplicates, 0);

    assert_eq!(execution.response.summary.matches, 1);
    assert_eq!(execution.response.summary.missing_right, 0);
    assert_eq!(execution.response.summary.missing_left, 0);
    assert_eq!(execution.response.summary.unkeyed_right, 2);
    assert_eq!(execution.response.summary.unkeyed_left, 1);
    assert_eq!(execution.response.summary.duplicates_a, 0);
    assert_eq!(execution.response.summary.duplicates_b, 0);
}

#[test]
fn engine_does_not_group_multiple_nullish_keys_into_duplicate_buckets() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["", "first"], &[" ", "second"], &["7", "shared"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["NULL", "third"], &["7", "shared"]],
    );
    let config = comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        ComparisonNormalizationConfig {
            treat_empty_as_null: true,
            trim_whitespace: true,
            null_tokens: vec!["null".to_string()],
            ..ComparisonNormalizationConfig::default()
        },
    );

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert!(
        results
            .iter()
            .all(|result| !matches!(result, RowComparisonResult::Duplicate { .. })),
        "nullish keys should stay out of duplicate buckets"
    );

    let nullish_unkeyed_right = results
        .iter()
        .filter(|result| {
            matches!(
                result,
                RowComparisonResult::UnkeyedRight { key, .. }
                    if key == &vec!["".to_string()] || key == &vec![" ".to_string()]
            )
        })
        .count();
    let nullish_unkeyed_left = results
        .iter()
        .filter(|result| {
            matches!(
                result,
                RowComparisonResult::UnkeyedLeft { key, .. } if key == &vec!["NULL".to_string()]
            )
        })
        .count();

    assert_eq!(nullish_unkeyed_right, 2);
    assert_eq!(nullish_unkeyed_left, 1);
    assert!(
        results.iter().all(|result| {
            !matches!(
                result,
                RowComparisonResult::MissingLeft { key, .. }
                    if key == &vec!["NULL".to_string()]
            ) && !matches!(
                result,
                RowComparisonResult::MissingRight { key, .. }
                    if key == &vec!["".to_string()] || key == &vec![" ".to_string()]
            )
        }),
        "nullish keys should not be reported as one-sided missing"
    );
    assert!(
        results
            .iter()
            .any(|result| matches!(result, RowComparisonResult::Match { key, .. } if key == &vec!["7".to_string()])),
        "valid keyed rows should still compare normally"
    );
}

#[test]
fn comparison_keeps_one_sided_results_separate_from_nullish_rows_on_the_other_side() {
    let csv_a = csv_data(
        "left.csv",
        &["id", "value"],
        &[&["608", "left 608"], &["610", "left 610"]],
    );
    let csv_b = csv_data(
        "right.csv",
        &["id", "value"],
        &[&["NULL", "right 608"], &["NULL", "right 610"]],
    );

    let execution = run_comparison(
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
                null_tokens: vec!["null".to_string()],
                ..ComparisonNormalizationConfig::default()
            },
        },
    )
    .expect("comparison should continue when literal null keys appear on one side");

    assert_eq!(
        execution
            .results
            .iter()
            .filter(|result| matches!(result, RowComparisonResult::MissingRight { .. }))
            .count(),
        2,
        "usable left-side keys should remain one-sided results"
    );
    assert_eq!(
        execution
            .results
            .iter()
            .filter(|result| matches!(result, RowComparisonResult::UnkeyedLeft { .. }))
            .count(),
        2,
        "right-side literal null keys should be ignored rather than matched or deduplicated"
    );
    assert!(
        execution
            .results
            .iter()
            .all(|result| !matches!(result, RowComparisonResult::Duplicate { .. })),
        "literal null keys should not collapse into a duplicate bucket"
    );
    assert_eq!(execution.response.summary.missing_right, 2);
    assert_eq!(execution.response.summary.unkeyed_left, 2);
    assert_eq!(execution.response.summary.duplicates_b, 0);
}
