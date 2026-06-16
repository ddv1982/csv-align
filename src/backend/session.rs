use std::sync::Arc;

use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonConfig, CsvData, RowComparisonResult,
};

/// Data for a single comparison session.
#[derive(Debug, Clone)]
pub struct SessionData {
    pub csv_a: Option<Arc<CsvData>>,
    pub csv_b: Option<Arc<CsvData>>,
    pub columns_a: Vec<ColumnInfo>,
    pub columns_b: Vec<ColumnInfo>,
    pub column_mappings: Vec<ColumnMapping>,
    pub comparison_results: Vec<RowComparisonResult>,
    pub comparison_config: Option<ComparisonConfig>,
    pub data_revision: u64,
}

impl SessionData {
    pub fn new() -> Self {
        Self {
            csv_a: None,
            csv_b: None,
            columns_a: Vec::new(),
            columns_b: Vec::new(),
            column_mappings: Vec::new(),
            comparison_results: Vec::new(),
            comparison_config: None,
            data_revision: 0,
        }
    }

    pub fn advance_data_revision(&mut self) {
        self.data_revision = self.data_revision.wrapping_add(1);
    }

    pub fn estimated_size_bytes(&self) -> usize {
        self.csv_a
            .as_deref()
            .map(estimated_csv_size_bytes)
            .unwrap_or(0)
            + self
                .csv_b
                .as_deref()
                .map(estimated_csv_size_bytes)
                .unwrap_or(0)
            + estimated_columns_size_bytes(&self.columns_a)
            + estimated_columns_size_bytes(&self.columns_b)
            + self
                .column_mappings
                .iter()
                .map(|mapping| mapping.file_a_column.len() + mapping.file_b_column.len())
                .sum::<usize>()
            + self
                .comparison_results
                .iter()
                .map(estimated_result_size_bytes)
                .sum::<usize>()
    }
}

fn estimated_csv_size_bytes(csv_data: &CsvData) -> usize {
    csv_data.file_path.as_deref().map(str::len).unwrap_or(0)
        + csv_data.headers.iter().map(String::len).sum::<usize>()
        + csv_data
            .rows
            .iter()
            .flatten()
            .map(String::len)
            .sum::<usize>()
}

fn estimated_columns_size_bytes(columns: &[ColumnInfo]) -> usize {
    columns.iter().map(|column| column.name.len()).sum()
}

fn estimated_values_size_bytes(values: &[String]) -> usize {
    values.iter().map(String::len).sum()
}

fn estimated_nested_values_size_bytes(values: &[Vec<String>]) -> usize {
    values
        .iter()
        .map(|row| estimated_values_size_bytes(row))
        .sum()
}

fn estimated_result_size_bytes(result: &RowComparisonResult) -> usize {
    match result {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        } => {
            estimated_values_size_bytes(key)
                + estimated_values_size_bytes(values_a)
                + estimated_values_size_bytes(values_b)
        }
        RowComparisonResult::Mismatch {
            key,
            values_a,
            values_b,
            differences,
        } => {
            estimated_values_size_bytes(key)
                + estimated_values_size_bytes(values_a)
                + estimated_values_size_bytes(values_b)
                + differences
                    .iter()
                    .map(|difference| {
                        difference.column_a.len()
                            + difference.column_b.len()
                            + difference.value_a.len()
                            + difference.value_b.len()
                    })
                    .sum::<usize>()
        }
        RowComparisonResult::MissingLeft { key, values_b }
        | RowComparisonResult::UnkeyedLeft { key, values_b } => {
            estimated_values_size_bytes(key) + estimated_values_size_bytes(values_b)
        }
        RowComparisonResult::MissingRight { key, values_a }
        | RowComparisonResult::UnkeyedRight { key, values_a } => {
            estimated_values_size_bytes(key) + estimated_values_size_bytes(values_a)
        }
        RowComparisonResult::Duplicate {
            key,
            values_a,
            values_b,
        } => {
            estimated_values_size_bytes(key)
                + estimated_nested_values_size_bytes(values_a)
                + estimated_nested_values_size_bytes(values_b)
        }
    }
}

impl Default for SessionData {
    fn default() -> Self {
        Self::new()
    }
}
