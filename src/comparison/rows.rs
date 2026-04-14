use super::super::data::types::CsvData;
use std::collections::HashMap;

pub(super) fn get_column_indices(headers: &[String], column_names: &[String]) -> Vec<usize> {
    column_names
        .iter()
        .filter_map(|name| headers.iter().position(|header| header == name))
        .collect()
}

pub(super) fn create_key_map(
    csv_data: &CsvData,
    key_indices: &[usize],
) -> HashMap<Vec<String>, Vec<usize>> {
    let mut map = HashMap::new();

    for (index, row) in csv_data.rows.iter().enumerate() {
        let key = extract_columns(row, key_indices);
        map.entry(key).or_insert_with(Vec::new).push(index);
    }

    map
}

pub(super) fn extract_columns(row: &[String], indices: &[usize]) -> Vec<String> {
    indices
        .iter()
        .map(|&idx| row.get(idx).cloned().unwrap_or_default())
        .collect()
}
