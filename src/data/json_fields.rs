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

            collect_object_paths(
                &csv_data.headers,
                header,
                &object,
                &mut Vec::new(),
                &mut headers,
            );
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

    if let Some((source_index, path)) = resolve_explicit_virtual_column_selection(headers, label) {
        return Some(ColumnSelection {
            label: label.to_string(),
            source_index,
            path: Some(path),
        });
    }

    let (source_header, path) = label.split_once('.')?;
    if source_header.is_empty() || path.is_empty() {
        return None;
    }

    let source_index = headers.iter().position(|header| header == source_header)?;
    let path = parse_virtual_path(path)?;

    if path.is_empty() {
        return None;
    }

    Some(ColumnSelection {
        label: label.to_string(),
        source_index,
        path: Some(path),
    })
}

fn resolve_explicit_virtual_column_selection(
    headers: &[String],
    label: &str,
) -> Option<(usize, Vec<String>)> {
    let (source_index, source_header) = headers
        .iter()
        .enumerate()
        .filter(|(_, header)| {
            !header.is_empty()
                && label
                    .strip_prefix(header.as_str())
                    .is_some_and(|remainder| remainder.starts_with('#'))
        })
        .max_by_key(|(_, header)| header.len())?;
    let path = parse_virtual_path(
        label
            .strip_prefix(source_header.as_str())?
            .strip_prefix('#')?,
    )?;

    if path.is_empty() {
        return None;
    }

    Some((source_index, path))
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
    physical_headers: &[String],
    source_header: &str,
    object: &Map<String, Value>,
    prefix: &mut Vec<String>,
    headers: &mut BTreeSet<String>,
) {
    for (key, value) in object {
        prefix.push(key.clone());
        headers.insert(format_virtual_label(
            physical_headers,
            source_header,
            prefix,
        ));

        if let Value::Object(nested) = value {
            collect_object_paths(physical_headers, source_header, nested, prefix, headers);
        }

        prefix.pop();
    }
}

fn format_virtual_label(
    physical_headers: &[String],
    source_header: &str,
    path: &[String],
) -> String {
    let escaped_path = path
        .iter()
        .map(|segment| escape_virtual_path_segment(segment))
        .collect::<Vec<_>>()
        .join(".");

    if source_header.contains('.')
        || physical_headers.iter().any(|header| {
            header != source_header
                && header
                    .strip_prefix(source_header)
                    .is_some_and(|remainder| remainder.starts_with('.'))
        })
    {
        format!("{source_header}#{escaped_path}")
    } else {
        format!("{source_header}.{escaped_path}")
    }
}

fn escape_virtual_path_segment(segment: &str) -> String {
    let mut escaped = String::with_capacity(segment.len());

    for character in segment.chars() {
        if matches!(character, '\\' | '.') {
            escaped.push('\\');
        }
        escaped.push(character);
    }

    escaped
}

fn parse_virtual_path(path: &str) -> Option<Vec<String>> {
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut escaped = false;

    for character in path.chars() {
        if escaped {
            current.push(character);
            escaped = false;
            continue;
        }

        match character {
            '\\' => escaped = true,
            '.' => {
                if current.is_empty() {
                    return None;
                }
                segments.push(std::mem::take(&mut current));
            }
            _ => current.push(character),
        }
    }

    if escaped {
        current.push('\\');
    }

    if current.is_empty() {
        return None;
    }
    segments.push(current);

    Some(segments)
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
