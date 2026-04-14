#![allow(dead_code)]

use csv_align::data::types::{
    ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData, MappingType,
};

pub fn csv_data(file_path: &str, headers: &[&str], rows: &[&[&str]]) -> CsvData {
    CsvData {
        file_path: Some(file_path.to_string()),
        headers: headers.iter().map(ToString::to_string).collect(),
        rows: rows
            .iter()
            .map(|row| row.iter().map(ToString::to_string).collect())
            .collect(),
    }
}

pub fn comparison_config(
    key_columns_a: &[&str],
    key_columns_b: &[&str],
    comparison_columns_a: &[&str],
    comparison_columns_b: &[&str],
    mapped_pairs: &[(&str, &str)],
    normalization: ComparisonNormalizationConfig,
) -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: key_columns_a.iter().map(ToString::to_string).collect(),
        key_columns_b: key_columns_b.iter().map(ToString::to_string).collect(),
        comparison_columns_a: comparison_columns_a
            .iter()
            .map(ToString::to_string)
            .collect(),
        comparison_columns_b: comparison_columns_b
            .iter()
            .map(ToString::to_string)
            .collect(),
        column_mappings: mapped_pairs
            .iter()
            .map(|(file_a_column, file_b_column)| ColumnMapping {
                file_a_column: (*file_a_column).to_string(),
                file_b_column: (*file_b_column).to_string(),
                mapping_type: MappingType::ExactMatch,
            })
            .collect(),
        normalization,
    }
}
