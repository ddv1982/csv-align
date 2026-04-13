use csv_align::comparison::engine::compare_csv_data;
use csv_align::data::types::{
    ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData,
    DateNormalizationConfig, MappingType, RowComparisonResult,
};

fn create_config(normalization: ComparisonNormalizationConfig) -> ComparisonConfig {
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

fn create_csv_pair(left_value: &str, right_value: &str) -> (CsvData, CsvData) {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), left_value.to_string()]],
    };

    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: vec![vec!["1".to_string(), right_value.to_string()]],
    };

    (csv_a, csv_b)
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
