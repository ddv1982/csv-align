use super::super::data::json_fields::{
    ColumnSelection, extract_selected_columns, resolve_column_selection,
};
use super::super::data::types::CsvData;
use super::value_compare::{normalize_display_value, normalize_key_value};
use std::collections::{HashMap, HashSet};

use crate::data::types::ComparisonNormalizationConfig;

pub(super) struct KeyedRows {
    pub(super) normalized_key: Vec<String>,
    pub(super) display_key: Vec<String>,
    pub(super) indices: Vec<usize>,
    pub(super) first_index: usize,
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
            .entry(normalized_key.clone())
            .and_modify(|entry: &mut KeyedRows| entry.indices.push(index))
            .or_insert_with(|| KeyedRows {
                normalized_key,
                display_key: raw_key
                    .iter()
                    .map(|value| normalize_display_value(value, normalization))
                    .collect(),
                indices: vec![index],
                first_index: index,
            });
    }

    (keyed_rows, nullish_rows)
}

pub(super) fn flexible_keys_match(key_a: &[String], key_b: &[String]) -> bool {
    key_a.len() == key_b.len()
        && key_a
            .iter()
            .zip(key_b)
            .all(|(component_a, component_b)| flexible_components_match(component_a, component_b))
}

pub(super) fn wildcard_literal_count(key_a: &[String], key_b: &[String]) -> usize {
    key_a
        .iter()
        .chain(key_b)
        .filter(|component| component.contains("**"))
        .map(|component| component.replace("**", "").chars().count())
        .sum()
}

pub(super) fn wildcard_token_count(key_a: &[String], key_b: &[String]) -> usize {
    key_a
        .iter()
        .chain(key_b)
        .map(|component| component.matches("**").count())
        .sum()
}

pub(super) fn extract_columns(row: &[String], selections: &[ColumnSelection]) -> Vec<String> {
    extract_selected_columns(row, selections)
}

fn flexible_components_match(component_a: &str, component_b: &str) -> bool {
    match (
        component_a.contains("**"),
        component_b.contains("**"),
        component_a == component_b,
    ) {
        (_, _, true) => true,
        (false, false, false) => false,
        (true, false, false) => wildcard_pattern_matches(component_a, component_b),
        (false, true, false) => wildcard_pattern_matches(component_b, component_a),
        (true, true, false) => wildcard_patterns_intersect(component_a, component_b),
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum PatternToken {
    Any,
    Char(char),
}

fn wildcard_patterns_intersect(pattern_a: &str, pattern_b: &str) -> bool {
    let tokens_a = tokenize_wildcard_pattern(pattern_a);
    let tokens_b = tokenize_wildcard_pattern(pattern_b);
    let mut stack = vec![(0, 0)];
    let mut visited = HashSet::new();

    while let Some((index_a, index_b)) = stack.pop() {
        if !visited.insert((index_a, index_b)) {
            continue;
        }

        let token_a = tokens_a.get(index_a).copied();
        let token_b = tokens_b.get(index_b).copied();
        match (token_a, token_b) {
            (None, None) => return true,
            (Some(PatternToken::Any), Some(PatternToken::Any)) => {
                stack.push((index_a + 1, index_b));
                stack.push((index_a, index_b + 1));
            }
            (Some(PatternToken::Any), Some(PatternToken::Char(_))) => {
                stack.push((index_a + 1, index_b));
                stack.push((index_a, index_b + 1));
            }
            (Some(PatternToken::Char(_)), Some(PatternToken::Any)) => {
                stack.push((index_a, index_b + 1));
                stack.push((index_a + 1, index_b));
            }
            (Some(PatternToken::Any), None) => {
                stack.push((index_a + 1, index_b));
            }
            (None, Some(PatternToken::Any)) => {
                stack.push((index_a, index_b + 1));
            }
            (Some(PatternToken::Char(left)), Some(PatternToken::Char(right))) if left == right => {
                stack.push((index_a + 1, index_b + 1));
            }
            _ => {}
        }
    }

    false
}

fn tokenize_wildcard_pattern(pattern: &str) -> Vec<PatternToken> {
    let mut tokens = Vec::new();
    let mut chars = pattern.chars().peekable();

    while let Some(character) = chars.next() {
        if character == '*' && chars.peek() == Some(&'*') {
            chars.next();
            tokens.push(PatternToken::Any);
        } else {
            tokens.push(PatternToken::Char(character));
        }
    }

    tokens
}

fn wildcard_pattern_matches(pattern: &str, value: &str) -> bool {
    if !pattern.contains("**") {
        return pattern == value;
    }

    let parts: Vec<&str> = pattern.split("**").collect();
    let mut remainder = value;

    if let Some(first) = parts.first().copied()
        && !first.is_empty()
    {
        let Some(next) = remainder.strip_prefix(first) else {
            return false;
        };
        remainder = next;
    }

    for part in parts
        .iter()
        .skip(1)
        .take(parts.len().saturating_sub(2))
        .copied()
    {
        if part.is_empty() {
            continue;
        }

        let Some(position) = remainder.find(part) else {
            return false;
        };
        remainder = &remainder[position + part.len()..];
    }

    if let Some(last) = parts.last().copied()
        && !last.is_empty()
        && !remainder.ends_with(last)
    {
        return false;
    }

    true
}
