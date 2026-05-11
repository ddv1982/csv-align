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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum FlexibleKeyMatch {
    SharedAnchoredToken,
    BoundaryWildcard,
    ComponentWildcard,
    Exact,
}

impl FlexibleKeyMatch {
    pub(super) fn preference_rank(self) -> u8 {
        match self {
            FlexibleKeyMatch::SharedAnchoredToken => 0,
            FlexibleKeyMatch::BoundaryWildcard => 1,
            FlexibleKeyMatch::ComponentWildcard => 2,
            FlexibleKeyMatch::Exact => 3,
        }
    }
}

pub(super) fn classify_flexible_key_match(
    key_a: &[String],
    key_b: &[String],
) -> Option<FlexibleKeyMatch> {
    let matching_component_count = key_a.len() == key_b.len();

    if matching_component_count && key_a == key_b {
        return Some(FlexibleKeyMatch::Exact);
    }

    if matching_component_count
        && key_a
            .iter()
            .zip(key_b)
            .all(|(component_a, component_b)| flexible_components_match(component_a, component_b))
    {
        return Some(FlexibleKeyMatch::ComponentWildcard);
    }

    if key_contains_wildcard(key_a) || key_contains_wildcard(key_b) {
        let intersection = wildcard_token_streams_intersect(
            &tokenize_key_wildcard_pattern(key_a),
            &tokenize_key_wildcard_pattern(key_b),
        );

        if intersection.boundary_consumed_by_wildcard {
            return Some(FlexibleKeyMatch::BoundaryWildcard);
        }
    } else if shared_anchored_tokens_match(key_a, key_b) {
        return Some(FlexibleKeyMatch::SharedAnchoredToken);
    }

    None
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
    Boundary,
    Char(char),
}

#[derive(Default)]
struct WildcardIntersection {
    intersects: bool,
    boundary_consumed_by_wildcard: bool,
}

fn key_contains_wildcard(key: &[String]) -> bool {
    key.iter().any(|component| component.contains("**"))
}

fn shared_anchored_tokens_match(key_a: &[String], key_b: &[String]) -> bool {
    if key_a.len() != key_b.len() {
        return false;
    }

    let has_exact_numeric_component = key_a.iter().zip(key_b).any(|(component_a, component_b)| {
        component_a == component_b && is_numeric_only_component(component_a)
    });

    let mut exact_component_count = 0;
    let mut shared_alpha_count = 0;
    let mut shares_number = false;
    let mut shared_component_count = 0;

    for (component_a, component_b) in key_a.iter().zip(key_b) {
        if component_a == component_b {
            exact_component_count += 1;
            continue;
        }

        let tokens_a = key_token_set(std::slice::from_ref(component_a));
        let tokens_b = key_token_set(std::slice::from_ref(component_b));
        let component_shared_alpha_count = tokens_a.alpha.intersection(&tokens_b.alpha).count();
        let component_shares_number = tokens_a
            .numeric
            .iter()
            .any(|token| tokens_b.numeric.contains(token))
            || tokens_a
                .embedded_identifiers
                .iter()
                .any(|token| tokens_b.embedded_identifiers.contains(token));

        if component_shared_alpha_count == 0 {
            return false;
        }

        let component_a_has_numbers = !tokens_a.numeric.is_empty() || tokens_a.has_embedded_numeric;
        let component_b_has_numbers = !tokens_b.numeric.is_empty() || tokens_b.has_embedded_numeric;
        let both_components_have_numbers = component_a_has_numbers && component_b_has_numbers;
        let one_component_has_numbers = component_a_has_numbers != component_b_has_numbers;

        if !component_shares_number && both_components_have_numbers {
            return false;
        }

        if !component_shares_number && one_component_has_numbers {
            let numeric_tokens_are_standalone = if !component_a_has_numbers {
                !tokens_b.has_embedded_numeric
            } else {
                !tokens_a.has_embedded_numeric
            };

            if !has_exact_numeric_component || !numeric_tokens_are_standalone {
                return false;
            }
        }

        shared_alpha_count += component_shared_alpha_count;
        shares_number |= component_shares_number;
        shared_component_count += 1;
    }

    shared_component_count > 0
        && shared_alpha_count > 0
        && (exact_component_count > 0 || shares_number || shared_alpha_count >= 2)
}

#[derive(Default)]
struct KeyTokenSet {
    alpha: HashSet<String>,
    numeric: HashSet<String>,
    embedded_identifiers: HashSet<String>,
    has_embedded_numeric: bool,
}

fn key_token_set(key: &[String]) -> KeyTokenSet {
    let mut token_set = KeyTokenSet::default();

    for component in key {
        for token in alphanumeric_tokens(component) {
            if token.chars().all(|character| character.is_ascii_digit()) {
                token_set.numeric.insert(token);
            } else {
                let has_alpha = token.chars().any(|character| character.is_alphabetic());
                let numeric_tokens = ascii_digit_runs(&token);
                if !numeric_tokens.is_empty() {
                    token_set.has_embedded_numeric = true;
                    if has_alpha {
                        token_set.embedded_identifiers.insert(token.to_lowercase());
                    }
                }

                if has_alpha && token.chars().count() >= 4 {
                    token_set.alpha.insert(token.to_lowercase());
                }
            }
        }
    }

    token_set
}

fn is_numeric_only_component(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty() && trimmed.chars().all(|character| character.is_ascii_digit())
}

fn ascii_digit_runs(value: &str) -> Vec<String> {
    let mut runs = Vec::new();
    let mut current = String::new();

    for character in value.chars() {
        if character.is_ascii_digit() {
            current.push(character);
        } else if !current.is_empty() {
            runs.push(std::mem::take(&mut current));
        }
    }

    if !current.is_empty() {
        runs.push(current);
    }

    runs
}

fn alphanumeric_tokens(value: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for character in value.chars() {
        if character.is_alphanumeric() {
            current.push(character);
        } else if !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn wildcard_patterns_intersect(pattern_a: &str, pattern_b: &str) -> bool {
    let tokens_a = tokenize_wildcard_pattern(pattern_a);
    let tokens_b = tokenize_wildcard_pattern(pattern_b);
    wildcard_token_streams_intersect(&tokens_a, &tokens_b).intersects
}

fn wildcard_token_streams_intersect(
    tokens_a: &[PatternToken],
    tokens_b: &[PatternToken],
) -> WildcardIntersection {
    let mut stack = vec![(0, 0, false, false)];
    let mut visited = HashSet::new();
    let mut intersection = WildcardIntersection::default();

    while let Some((index_a, index_b, crossed_boundary, consumed_boundary)) = stack.pop() {
        if !visited.insert((index_a, index_b, crossed_boundary, consumed_boundary)) {
            continue;
        }

        let token_a = tokens_a.get(index_a).copied();
        let token_b = tokens_b.get(index_b).copied();
        match (token_a, token_b) {
            (None, None) => {
                if consumed_boundary {
                    return WildcardIntersection {
                        intersects: true,
                        boundary_consumed_by_wildcard: true,
                    };
                }
                intersection.intersects = true;
            }
            (Some(PatternToken::Any), Some(PatternToken::Any)) => {
                stack.push((index_a + 1, index_b, crossed_boundary, consumed_boundary));
                stack.push((index_a, index_b + 1, crossed_boundary, consumed_boundary));
            }
            (Some(PatternToken::Any), Some(PatternToken::Char(_)))
            | (Some(PatternToken::Any), Some(PatternToken::Boundary)) => {
                let consumed_boundary_now = token_b == Some(PatternToken::Boundary);
                stack.push((index_a + 1, index_b, crossed_boundary, consumed_boundary));
                stack.push((
                    index_a,
                    index_b + 1,
                    crossed_boundary || consumed_boundary_now,
                    consumed_boundary || consumed_boundary_now,
                ));
            }
            (Some(PatternToken::Char(_)), Some(PatternToken::Any))
            | (Some(PatternToken::Boundary), Some(PatternToken::Any)) => {
                let consumed_boundary_now = token_a == Some(PatternToken::Boundary);
                stack.push((index_a, index_b + 1, crossed_boundary, consumed_boundary));
                stack.push((
                    index_a + 1,
                    index_b,
                    crossed_boundary || consumed_boundary_now,
                    consumed_boundary || consumed_boundary_now,
                ));
            }
            (Some(PatternToken::Any), None) => {
                stack.push((index_a + 1, index_b, crossed_boundary, consumed_boundary));
            }
            (None, Some(PatternToken::Any)) => {
                stack.push((index_a, index_b + 1, crossed_boundary, consumed_boundary));
            }
            (Some(PatternToken::Boundary), Some(PatternToken::Boundary)) => {
                stack.push((index_a + 1, index_b + 1, false, consumed_boundary));
            }
            (Some(PatternToken::Boundary), _) if crossed_boundary => {
                stack.push((index_a + 1, index_b, false, consumed_boundary));
            }
            (_, Some(PatternToken::Boundary)) if crossed_boundary => {
                stack.push((index_a, index_b + 1, false, consumed_boundary));
            }
            (Some(PatternToken::Char(left)), Some(PatternToken::Char(right))) if left == right => {
                stack.push((
                    index_a + 1,
                    index_b + 1,
                    crossed_boundary,
                    consumed_boundary,
                ));
            }
            _ => {}
        }
    }

    intersection
}

fn tokenize_key_wildcard_pattern(key: &[String]) -> Vec<PatternToken> {
    let mut tokens = Vec::new();

    for (component_index, component) in key.iter().enumerate() {
        if component_index > 0 {
            tokens.push(PatternToken::Boundary);
        }
        tokens.extend(tokenize_wildcard_pattern(component));
    }

    tokens
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
