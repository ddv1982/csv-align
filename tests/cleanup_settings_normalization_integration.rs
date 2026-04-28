mod common;

use csv_align::comparison::engine::compare_csv_data;
use csv_align::data::types::{
    ComparisonNormalizationConfig, DateNormalizationConfig, RowComparisonResult,
};

use common::{comparison_config, csv_data};

fn create_config(
    normalization: ComparisonNormalizationConfig,
) -> csv_align::data::types::ComparisonConfig {
    comparison_config(
        &["id"],
        &["id"],
        &["value"],
        &["value"],
        &[("value", "value")],
        normalization,
    )
}

fn create_csv_pair(
    left_value: &str,
    right_value: &str,
) -> (
    csv_align::data::types::CsvData,
    csv_align::data::types::CsvData,
) {
    (
        csv_data("left.csv", &["id", "value"], &[&["1", left_value]]),
        csv_data("right.csv", &["id", "value"], &[&["1", right_value]]),
    )
}

#[test]
fn cleanup_settings_apply_to_key_matching() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["  AbC  ", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["abc", "same"]]);
    let config = create_config(ComparisonNormalizationConfig {
        case_insensitive: true,
        trim_whitespace: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn cleanup_settings_apply_date_normalization_to_key_matching() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["2026-04-13", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["13/04/2026", "same"]]);
    let config = create_config(ComparisonNormalizationConfig {
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
fn cleanup_settings_defaults_match_product_normalization_baseline() {
    let defaults = ComparisonNormalizationConfig::default();

    assert!(defaults.treat_empty_as_null);
    assert_eq!(defaults.null_tokens, vec!["null", "na", "n/a", "none"]);
    assert!(defaults.null_token_case_insensitive);
    assert!(!defaults.case_insensitive);
    assert!(!defaults.trim_whitespace);
    assert!(!defaults.date_normalization.enabled);
    assert_eq!(
        defaults.date_normalization.formats,
        vec!["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y"]
    );
}

#[test]
fn cleanup_settings_matches_configured_common_null_tokens_beyond_null() {
    let (csv_a, csv_b) = create_csv_pair("NA", "None");
    let config = create_config(ComparisonNormalizationConfig {
        treat_empty_as_null: true,
        null_tokens: vec![
            "null".to_string(),
            "na".to_string(),
            "n/a".to_string(),
            "none".to_string(),
        ],
        null_token_case_insensitive: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn cleanup_settings_matches_different_date_formats_when_enabled() {
    let (csv_a, csv_b) = create_csv_pair("2026-04-13", "13/04/2026");
    let config = create_config(ComparisonNormalizationConfig {
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
fn cleanup_settings_matches_default_month_name_date_format_without_custom_formats() {
    let (csv_a, csv_b) = create_csv_pair("18-FEB-19", "2019-02-18");
    let config = create_config(ComparisonNormalizationConfig {
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
