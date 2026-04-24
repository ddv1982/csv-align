use super::super::data::json_fields::{
    ColumnSelection, extract_selected_columns, resolve_column_selection,
};
use super::super::data::types::CsvData;
use super::value_compare::value_is_nullish;
use std::collections::HashMap;

use crate::data::types::ComparisonNormalizationConfig;

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
) -> (HashMap<Vec<String>, Vec<usize>>, Vec<usize>) {
    let mut keyed_rows = HashMap::new();
    let mut nullish_rows = Vec::new();

    for (index, row) in csv_data.rows.iter().enumerate() {
        let key = extract_columns(row, key_selections);

        if key
            .iter()
            .any(|value| value_is_nullish(value, normalization))
        {
            nullish_rows.push(index);
            continue;
        }

        keyed_rows.entry(key).or_insert_with(Vec::new).push(index);
    }

    (keyed_rows, nullish_rows)
}

pub(super) fn extract_columns(row: &[String], selections: &[ColumnSelection]) -> Vec<String> {
    extract_selected_columns(row, selections)
}
