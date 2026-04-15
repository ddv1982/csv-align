use super::super::data::types::CsvData;
use super::value_compare::value_is_nullish;
use std::collections::HashMap;

use crate::data::types::ComparisonNormalizationConfig;

pub(super) fn get_column_indices(headers: &[String], column_names: &[String]) -> Vec<usize> {
    column_names
        .iter()
        .filter_map(|name| headers.iter().position(|header| header == name))
        .collect()
}

pub(super) fn split_rows_by_key_usable(
    csv_data: &CsvData,
    key_indices: &[usize],
    normalization: &ComparisonNormalizationConfig,
) -> (HashMap<Vec<String>, Vec<usize>>, Vec<usize>) {
    let mut keyed_rows = HashMap::new();
    let mut nullish_rows = Vec::new();

    for (index, row) in csv_data.rows.iter().enumerate() {
        let key = extract_columns(row, key_indices);

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

pub(super) fn extract_columns(row: &[String], indices: &[usize]) -> Vec<String> {
    indices
        .iter()
        .map(|&idx| row.get(idx).cloned().unwrap_or_default())
        .collect()
}
