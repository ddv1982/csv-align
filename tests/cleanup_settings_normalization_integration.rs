mod common;

use csv_align::comparison::engine::compare_csv_data;
use csv_align::data::types::{
    ComparisonNormalizationConfig, DateNormalizationConfig, DecimalRoundingConfig,
    RowComparisonResult,
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
    assert_eq!(results[0].key(), ["  AbC  "]);
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
    assert_eq!(results[0].key(), ["2026-04-13"]);
}

#[test]
fn cleanup_settings_defaults_match_product_normalization_baseline() {
    let defaults = ComparisonNormalizationConfig::default();

    assert!(defaults.treat_empty_as_null);
    assert_eq!(defaults.null_tokens, vec!["null", "na", "n/a", "none"]);
    assert!(defaults.null_token_case_insensitive);
    assert!(!defaults.case_insensitive);
    assert!(!defaults.trim_whitespace);
    assert!(!defaults.numeric_equivalence);
    assert_eq!(
        defaults.decimal_rounding,
        DecimalRoundingConfig {
            enabled: false,
            decimals: 0,
        }
    );
    assert!(!defaults.date_normalization.enabled);
    assert_eq!(
        defaults.date_normalization.formats,
        vec!["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y"]
    );
}

#[test]
fn cleanup_settings_match_equivalent_decimal_numbers_when_enabled() {
    let (csv_a, csv_b) = create_csv_pair("100", "100.0");
    let config = create_config(ComparisonNormalizationConfig {
        numeric_equivalence: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
}

#[test]
fn cleanup_settings_report_different_decimal_numbers_when_enabled() {
    let (csv_a, csv_b) = create_csv_pair("100", "100.01");
    let config = create_config(ComparisonNormalizationConfig {
        numeric_equivalence: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Mismatch { .. }));
}

#[test]
fn cleanup_settings_keep_decimal_formatting_different_by_default() {
    let (csv_a, csv_b) = create_csv_pair("0100.00", "+100.0");
    let config = create_config(ComparisonNormalizationConfig::default());

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Mismatch { .. }));
}

#[test]
fn cleanup_settings_apply_numeric_equivalence_to_key_matching() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["100", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["100.0", "same"]]);
    let config = create_config(ComparisonNormalizationConfig {
        numeric_equivalence: true,
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
    assert_eq!(results[0].key(), ["100"]);
}

#[test]
fn cleanup_settings_round_numbers_for_comparison_display_and_difference_output() {
    let (csv_a, csv_b) = create_csv_pair("100.4", "100.6");
    let config = create_config(ComparisonNormalizationConfig {
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 0,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    match &results[0] {
        RowComparisonResult::Mismatch {
            values_a,
            values_b,
            differences,
            ..
        } => {
            assert_eq!(values_a, &vec!["100".to_string()]);
            assert_eq!(values_b, &vec!["101".to_string()]);
            assert_eq!(differences.len(), 1);
            assert_eq!(differences[0].value_a, "100");
            assert_eq!(differences[0].value_b, "101");
        }
        other => panic!("expected mismatch after rounded display values, got {other:?}"),
    }
}

#[test]
fn cleanup_settings_round_numbers_for_key_matching_and_display() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&["100.4", "same"]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["100.49", "same"]]);
    let config = create_config(ComparisonNormalizationConfig {
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 0,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    assert!(matches!(results[0], RowComparisonResult::Match { .. }));
    assert_eq!(results[0].key(), ["100"]);
}

#[test]
fn cleanup_settings_round_numbers_and_trim_unnecessary_zeroes() {
    let (csv_a, csv_b) = create_csv_pair("100", "100.000");
    let config = create_config(ComparisonNormalizationConfig {
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 2,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    match &results[0] {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["100".to_string()]);
            assert_eq!(values_b, &vec!["100".to_string()]);
        }
        other => panic!("expected rounded values to stay trimmed, got {other:?}"),
    }
}

#[test]
fn cleanup_settings_remove_decimal_digits_from_the_right_when_rounding_is_configured() {
    let (csv_a, csv_b) = create_csv_pair("100.22", "100");
    let config = create_config(ComparisonNormalizationConfig {
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 2,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    match &results[0] {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["100".to_string()]);
            assert_eq!(values_b, &vec!["100".to_string()]);
        }
        other => panic!("expected two decimal digits to be removed, got {other:?}"),
    }
}

#[test]
fn cleanup_settings_keep_remaining_decimal_digits_after_removing_configured_count() {
    let (csv_a, csv_b) = create_csv_pair("100.234", "100.2");
    let config = create_config(ComparisonNormalizationConfig {
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 2,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    match &results[0] {
        RowComparisonResult::Match {
            values_a, values_b, ..
        } => {
            assert_eq!(values_a, &vec!["100.2".to_string()]);
            assert_eq!(values_b, &vec!["100.2".to_string()]);
        }
        other => panic!("expected only two decimal digits to be removed, got {other:?}"),
    }
}

#[test]
fn cleanup_settings_round_trimmed_numeric_values_for_display_when_whitespace_cleanup_is_enabled() {
    let csv_a = csv_data("left.csv", &["id", "value"], &[&[" 100.4 ", " 100.4 "]]);
    let csv_b = csv_data("right.csv", &["id", "value"], &[&["100.49", "100.49"]]);
    let config = create_config(ComparisonNormalizationConfig {
        trim_whitespace: true,
        decimal_rounding: DecimalRoundingConfig {
            enabled: true,
            decimals: 0,
        },
        ..ComparisonNormalizationConfig::default()
    });

    let results = compare_csv_data(&csv_a, &csv_b, &config);

    assert_eq!(results.len(), 1);
    match &results[0] {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        } => {
            assert_eq!(key, &vec!["100".to_string()]);
            assert_eq!(values_a, &vec!["100".to_string()]);
            assert_eq!(values_b, &vec!["100".to_string()]);
        }
        other => panic!("expected rounded trimmed values to display cleanly, got {other:?}"),
    }
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
