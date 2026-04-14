mod common;

use csv_align::comparison::{compare_csv_data, generate_summary, suggest_mappings};
use csv_align::data::types::{ComparisonNormalizationConfig, CsvData};

use common::comparison_config;

#[test]
fn comparison_module_re_exports_primary_entry_points() {
    let csv_a = CsvData {
        file_path: Some("left.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string()],
        rows: vec![vec!["1".to_string(), "Alice".to_string()]],
    };
    let csv_b = CsvData {
        file_path: Some("right.csv".to_string()),
        headers: vec!["id".to_string(), "name".to_string()],
        rows: vec![vec!["1".to_string(), "Alice".to_string()]],
    };
    let config = comparison_config(
        &["id"],
        &["id"],
        &["name"],
        &["name"],
        &[("name", "name")],
        ComparisonNormalizationConfig::default(),
    );

    let mappings = suggest_mappings(&csv_a.headers, &csv_b.headers);
    assert!(!mappings.is_empty());

    let results = compare_csv_data(&csv_a, &csv_b, &config);
    let summary = generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());

    assert_eq!(results.len(), 1);
    assert_eq!(summary.matches, 1);
}
