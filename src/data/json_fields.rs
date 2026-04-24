use std::collections::BTreeSet;

use serde_json::{Map, Value};

use super::types::CsvData;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ColumnSelection {
    pub label: String,
    source_index: usize,
    path: Option<Vec<String>>,
}

pub fn discover_virtual_headers(csv_data: &CsvData) -> Vec<String> {
    let mut headers = BTreeSet::new();

    for (index, header) in csv_data.headers.iter().enumerate() {
        for row in &csv_data.rows {
            let Some(value) = row.get(index) else {
                continue;
            };
            let Ok(Value::Object(object)) = serde_json::from_str::<Value>(value) else {
                continue;
            };

            collect_object_paths(header, &object, &mut Vec::new(), &mut headers);
        }
    }

    headers.into_iter().collect()
}

pub fn resolve_column_selection(headers: &[String], label: &str) -> Option<ColumnSelection> {
    if let Some(index) = headers.iter().position(|header| header == label) {
        return Some(ColumnSelection {
            label: label.to_string(),
            source_index: index,
            path: None,
        });
    }

    let (source_header, path) = label.split_once('.')?;
    if source_header.is_empty() || path.is_empty() {
        return None;
    }

    let source_index = headers.iter().position(|header| header == source_header)?;
    let path: Vec<String> = path
        .split('.')
        .filter(|segment| !segment.is_empty())
        .map(str::to_string)
        .collect();

    if path.is_empty() {
        return None;
    }

    Some(ColumnSelection {
        label: label.to_string(),
        source_index,
        path: Some(path),
    })
}

pub fn valid_column_labels(csv_data: &CsvData) -> BTreeSet<String> {
    csv_data
        .headers
        .iter()
        .cloned()
        .chain(discover_virtual_headers(csv_data))
        .collect()
}

pub fn label_has_physical_or_virtual_source(headers: &[String], label: &str) -> bool {
    resolve_column_selection(headers, label).is_some()
}

pub fn extract_selected_columns(row: &[String], selections: &[ColumnSelection]) -> Vec<String> {
    selections
        .iter()
        .map(|selection| extract_selected_column(row, selection))
        .collect()
}

fn extract_selected_column(row: &[String], selection: &ColumnSelection) -> String {
    let Some(path) = &selection.path else {
        return row.get(selection.source_index).cloned().unwrap_or_default();
    };

    let Some(source) = row.get(selection.source_index) else {
        return String::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(source) else {
        return String::new();
    };

    let Some(value) = value_at_path(&value, path) else {
        return String::new();
    };

    json_value_to_comparable_string(value)
}

fn collect_object_paths(
    source_header: &str,
    object: &Map<String, Value>,
    prefix: &mut Vec<String>,
    headers: &mut BTreeSet<String>,
) {
    for (key, value) in object {
        prefix.push(key.clone());
        headers.insert(format!("{source_header}.{}", prefix.join(".")));

        if let Value::Object(nested) = value {
            collect_object_paths(source_header, nested, prefix, headers);
        }

        prefix.pop();
    }
}

fn value_at_path<'a>(value: &'a Value, path: &[String]) -> Option<&'a Value> {
    let mut current = value;

    for segment in path {
        current = current.as_object()?.get(segment)?;
    }

    Some(current)
}

fn json_value_to_comparable_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Array(_) | Value::Object(_) => value.to_string(),
    }
}
