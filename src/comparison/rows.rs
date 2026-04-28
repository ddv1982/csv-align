use super::super::data::json_fields::{
    ColumnSelection, extract_selected_columns, resolve_column_selection,
};
use super::super::data::types::CsvData;
use super::value_compare::normalize_key_value;
use std::collections::HashMap;

use crate::data::types::ComparisonNormalizationConfig;

pub(super) struct KeyedRows {
    pub(super) display_key: Vec<String>,
    pub(super) indices: Vec<usize>,
}

pub(super) fn get_column_selections(
    headers: &[String],
    column_names: &[String],
) -> Vec<ColumnSelection> {
    column_names
        .iter()
        .filter_map(|name| resolve_column_selection(headers, name))
        .collect()
}

pub(super) fn split_rows_by_key_usable(
    csv_data: &CsvData,
    key_selections: &[ColumnSelection],
    normalization: &ComparisonNormalizationConfig,
) -> (HashMap<Vec<String>, KeyedRows>, Vec<usize>) {
    let mut keyed_rows = HashMap::new();
    let mut nullish_rows = Vec::new();

    for (index, row) in csv_data.rows.iter().enumerate() {
        let raw_key = extract_columns(row, key_selections);
        let Some(normalized_key) = raw_key
            .iter()
            .map(|value| normalize_key_value(value, normalization))
            .collect::<Option<Vec<_>>>()
        else {
            nullish_rows.push(index);
            continue;
        };

        keyed_rows
            .entry(normalized_key)
            .and_modify(|entry: &mut KeyedRows| entry.indices.push(index))
            .or_insert_with(|| KeyedRows {
                display_key: raw_key,
                indices: vec![index],
            });
    }

    (keyed_rows, nullish_rows)
}

pub(super) fn extract_columns(row: &[String], selections: &[ColumnSelection]) -> Vec<String> {
    extract_selected_columns(row, selections)
}
