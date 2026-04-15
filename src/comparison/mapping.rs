use super::super::data::types::{ColumnMapping, CsvData, MappingType};
use std::borrow::Cow;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use strsim::{jaro_winkler, normalized_levenshtein};

const MIN_CONTENTFUL_UNIQUE_VALUES: usize = 3;
const MIN_SHARED_INSTANCE_VALUES: usize = 3;
const STRONG_INSTANCE_CONTAINMENT: f64 = 0.85;

#[derive(Debug, Clone)]
struct ColumnValueProfile {
    unique_values: HashSet<String>,
    non_empty_count: usize,
    dominant_kind: ValueKind,
}

impl ColumnValueProfile {
    fn unique_ratio(&self) -> f64 {
        if self.non_empty_count == 0 {
            0.0
        } else {
            self.unique_values.len() as f64 / self.non_empty_count as f64
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ValueKind {
    Integer,
    Decimal,
    Uuid,
    Text,
}

/// Suggest column mappings between two sets of column names
pub fn suggest_mappings(columns_a: &[String], columns_b: &[String]) -> Vec<ColumnMapping> {
    suggest_mappings_with_data(columns_a, columns_b, None, None)
}

/// Suggest column mappings between two sets of column names, optionally using
/// loaded CSV content to improve matches when the headers are unreliable.
pub fn suggest_mappings_with_data(
    columns_a: &[String],
    columns_b: &[String],
    csv_a: Option<&CsvData>,
    csv_b: Option<&CsvData>,
) -> Vec<ColumnMapping> {
    let profiles_a = csv_a
        .map(|csv| build_column_profiles(csv, columns_a))
        .unwrap_or_default();
    let profiles_b = csv_b
        .map(|csv| build_column_profiles(csv, columns_b))
        .unwrap_or_default();
    let mut candidates = Vec::new();

    for (idx_a, col_a) in columns_a.iter().enumerate() {
        for (idx_b, col_b) in columns_b.iter().enumerate() {
            if let Some((score, mapping_type)) =
                score_mapping_candidate(col_a, col_b, profiles_a.get(col_a), profiles_b.get(col_b))
            {
                candidates.push((idx_a, idx_b, score, mapping_type));
            }
        }
    }

    // Highest confidence candidates first
    candidates.sort_by(|a, b| {
        b.2.partial_cmp(&a.2)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
            .then_with(|| a.1.cmp(&b.1))
    });

    let mut used_a = HashSet::new();
    let mut used_b = HashSet::new();
    let mut mappings = Vec::new();

    for (idx_a, idx_b, _score, mapping_type) in candidates {
        if used_a.contains(&idx_a) || used_b.contains(&idx_b) {
            continue;
        }

        mappings.push(ColumnMapping {
            file_a_column: columns_a[idx_a].clone(),
            file_b_column: columns_b[idx_b].clone(),
            mapping_type,
        });

        used_a.insert(idx_a);
        used_b.insert(idx_b);
    }

    mappings
}

fn score_mapping_candidate(
    col_a: &str,
    col_b: &str,
    profile_a: Option<&ColumnValueProfile>,
    profile_b: Option<&ColumnValueProfile>,
) -> Option<(f64, MappingType)> {
    // Strong exact match on raw value ignoring case
    if col_a.eq_ignore_ascii_case(col_b) {
        return Some((1.0, MappingType::ExactMatch));
    }

    let normalized_a = normalize_column_name(col_a);
    let normalized_b = normalize_column_name(col_b);
    let compact_a = normalized_a.replace(' ', "");
    let compact_b = normalized_b.replace(' ', "");
    let canonical_a = canonical_column_alias(&normalized_a);
    let canonical_b = canonical_column_alias(&normalized_b);

    // Equivalent after normalization (snake/camel/spacing differences)
    if normalized_a == normalized_b || compact_a == compact_b {
        return Some((0.98, MappingType::ExactMatch));
    }

    let name_score = score_name_candidate(
        &normalized_a,
        &normalized_b,
        &compact_a,
        &compact_b,
        canonical_a.as_ref(),
        canonical_b.as_ref(),
    );
    let instance_score = match (profile_a, profile_b) {
        (Some(profile_a), Some(profile_b)) => score_instance_candidate(profile_a, profile_b),
        _ => None,
    };

    let combined_score = combine_similarity_signals(name_score, instance_score)?;

    if combined_score >= 0.70 {
        Some((combined_score, MappingType::FuzzyMatch(combined_score)))
    } else {
        None
    }
}

fn score_name_candidate(
    normalized_a: &str,
    normalized_b: &str,
    compact_a: &str,
    compact_b: &str,
    canonical_a: &str,
    canonical_b: &str,
) -> Option<f64> {
    // Conservative explicit header aliases help with common exports while still
    // producing an inferred mapping rather than pretending the names were exact.
    if canonical_a == canonical_b && (canonical_a != normalized_a || canonical_b != normalized_b) {
        return Some(0.93);
    }

    let tokens_a = tokenize_column_name(normalized_a);
    let tokens_b = tokenize_column_name(normalized_b);

    let lev = normalized_levenshtein(normalized_a, normalized_b);
    let jw = jaro_winkler(normalized_a, normalized_b);
    let token_overlap = token_jaccard(&tokens_a, &tokens_b);

    // Acronym compatibility helps with abbreviated identifiers.
    let acronym_a = acronym(&tokens_a);
    let acronym_b = acronym(&tokens_b);
    let acronym_bonus = if (!acronym_a.is_empty() && acronym_a == compact_b)
        || (!acronym_b.is_empty() && acronym_b == compact_a)
    {
        0.08
    } else {
        0.0
    };

    let mut score = (0.45 * jw) + (0.35 * lev) + (0.20 * token_overlap) + acronym_bonus;
    if score > 1.0 {
        score = 1.0;
    }

    (score >= 0.70).then_some(score)
}

fn score_instance_candidate(
    profile_a: &ColumnValueProfile,
    profile_b: &ColumnValueProfile,
) -> Option<f64> {
    if !value_kinds_are_compatible(profile_a.dominant_kind, profile_b.dominant_kind) {
        return None;
    }

    let unique_a = profile_a.unique_values.len();
    let unique_b = profile_b.unique_values.len();
    let smaller_unique_count = unique_a.min(unique_b);
    if smaller_unique_count < MIN_CONTENTFUL_UNIQUE_VALUES {
        return None;
    }

    if matches!(
        (profile_a.dominant_kind, profile_b.dominant_kind),
        (ValueKind::Integer, ValueKind::Integer)
            | (ValueKind::Integer, ValueKind::Decimal)
            | (ValueKind::Decimal, ValueKind::Integer)
            | (ValueKind::Decimal, ValueKind::Decimal)
    ) && (profile_a.unique_ratio() < 0.80 || profile_b.unique_ratio() < 0.80)
    {
        return None;
    }

    if matches!(
        (profile_a.dominant_kind, profile_b.dominant_kind),
        (ValueKind::Text, ValueKind::Text) | (ValueKind::Uuid, ValueKind::Uuid)
    ) && (smaller_unique_count < 4
        || profile_a.unique_ratio() < 0.50
        || profile_b.unique_ratio() < 0.50)
    {
        return None;
    }

    let shared_values = profile_a
        .unique_values
        .intersection(&profile_b.unique_values)
        .count();
    if shared_values < MIN_SHARED_INSTANCE_VALUES {
        return None;
    }

    let union_count = profile_a
        .unique_values
        .union(&profile_b.unique_values)
        .count();
    if union_count == 0 {
        return None;
    }

    let containment = shared_values as f64 / smaller_unique_count as f64;
    if containment < STRONG_INSTANCE_CONTAINMENT {
        return None;
    }

    let jaccard = shared_values as f64 / union_count as f64;
    let density_similarity = profile_a.non_empty_count.min(profile_b.non_empty_count) as f64
        / profile_a.non_empty_count.max(profile_b.non_empty_count) as f64;

    Some(((0.80 * containment) + (0.15 * jaccard) + (0.05 * density_similarity)).min(0.99))
}

fn combine_similarity_signals(name_score: Option<f64>, instance_score: Option<f64>) -> Option<f64> {
    match (name_score, instance_score) {
        (Some(name_score), Some(instance_score)) => {
            Some((1.0 - ((1.0 - name_score) * (1.0 - instance_score))).min(0.99))
        }
        (Some(name_score), None) => Some(name_score),
        (None, Some(instance_score)) => Some(instance_score),
        (None, None) => None,
    }
}

fn normalize_column_name(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    let mut prev_was_lower_or_digit = false;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() && prev_was_lower_or_digit {
            normalized.push(' ');
        }

        if ch.is_ascii_alphanumeric() {
            normalized.push(ch.to_ascii_lowercase());
            prev_was_lower_or_digit = ch.is_ascii_lowercase() || ch.is_ascii_digit();
        } else {
            normalized.push(' ');
            prev_was_lower_or_digit = false;
        }
    }

    normalized.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn tokenize_column_name(normalized: &str) -> Vec<String> {
    normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn canonical_column_alias(normalized: &str) -> Cow<'_, str> {
    match normalized {
        "display name" | "full name" => Cow::Borrowed("name"),
        "email address" | "email addr" => Cow::Borrowed("email"),
        "record id" | "record identifier" => Cow::Borrowed("id"),
        _ => Cow::Borrowed(normalized),
    }
}

fn build_column_profiles(
    csv_data: &CsvData,
    requested_columns: &[String],
) -> HashMap<String, ColumnValueProfile> {
    let header_indexes: HashMap<&str, usize> = csv_data
        .headers
        .iter()
        .enumerate()
        .map(|(index, header)| (header.as_str(), index))
        .collect();

    requested_columns
        .iter()
        .filter_map(|column| {
            header_indexes
                .get(column.as_str())
                .map(|index| (column.clone(), build_column_profile(csv_data, *index)))
        })
        .collect()
}

fn build_column_profile(csv_data: &CsvData, column_index: usize) -> ColumnValueProfile {
    let mut unique_values = HashSet::new();
    let mut non_empty_count = 0;
    let mut kind_counts: HashMap<ValueKind, usize> = HashMap::new();

    for row in &csv_data.rows {
        let Some(value) = row.get(column_index) else {
            continue;
        };

        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
            continue;
        }

        non_empty_count += 1;
        unique_values.insert(normalize_cell_value(trimmed));
        *kind_counts.entry(classify_value_kind(trimmed)).or_default() += 1;
    }

    let dominant_kind = kind_counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(kind, _)| kind)
        .unwrap_or(ValueKind::Text);

    ColumnValueProfile {
        unique_values,
        non_empty_count,
        dominant_kind,
    }
}

fn normalize_cell_value(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn classify_value_kind(value: &str) -> ValueKind {
    if is_uuid_like(value) {
        return ValueKind::Uuid;
    }

    if value.parse::<i64>().is_ok() {
        return ValueKind::Integer;
    }

    if value.parse::<f64>().is_ok() {
        return ValueKind::Decimal;
    }

    ValueKind::Text
}

fn is_uuid_like(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }

    bytes.iter().enumerate().all(|(index, byte)| match index {
        8 | 13 | 18 | 23 => *byte == b'-',
        _ => byte.is_ascii_hexdigit(),
    })
}

fn value_kinds_are_compatible(kind_a: ValueKind, kind_b: ValueKind) -> bool {
    matches!(
        (kind_a, kind_b),
        (ValueKind::Text, ValueKind::Text)
            | (ValueKind::Uuid, ValueKind::Uuid)
            | (ValueKind::Integer, ValueKind::Integer)
            | (ValueKind::Decimal, ValueKind::Decimal)
            | (ValueKind::Integer, ValueKind::Decimal)
            | (ValueKind::Decimal, ValueKind::Integer)
    )
}

fn token_jaccard(tokens_a: &[String], tokens_b: &[String]) -> f64 {
    if tokens_a.is_empty() || tokens_b.is_empty() {
        return 0.0;
    }

    let set_a: HashSet<&str> = tokens_a.iter().map(|s| s.as_str()).collect();
    let set_b: HashSet<&str> = tokens_b.iter().map(|s| s.as_str()).collect();

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.union(&set_b).count();

    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

fn acronym(tokens: &[String]) -> String {
    tokens.iter().filter_map(|t| t.chars().next()).collect()
}
