use super::super::data::types::{
    ColumnMapping, ComparisonNormalizationConfig, DateNormalizationConfig, ValueDifference,
};
use chrono::{NaiveDate, NaiveDateTime};
use serde_json::Value;
use std::collections::HashMap;

const DEFAULT_DATE_FORMATS: &[&str] = &[
    "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%Y.%m.%d", "%d.%m.%Y",
    "%m.%d.%Y", "%Y%m%d", "%d %b %Y", "%d %B %Y", "%d-%b-%y",
];

#[derive(Debug, Clone, PartialEq, Eq)]
enum NormalizedValue {
    Null,
    Text(String),
}

fn values_match_with_config(
    value_a: &str,
    value_b: &str,
    normalization: &ComparisonNormalizationConfig,
) -> bool {
    let normalized_a = normalize_value(value_a, normalization);
    let normalized_b = normalize_value(value_b, normalization);

    match (normalized_a, normalized_b) {
        (NormalizedValue::Null, NormalizedValue::Null) => true,
        (NormalizedValue::Null, _) | (_, NormalizedValue::Null) => false,
        (NormalizedValue::Text(a), NormalizedValue::Text(b)) => {
            match (
                serde_json::from_str::<Value>(&a),
                serde_json::from_str::<Value>(&b),
            ) {
                (Ok(json_a), Ok(json_b)) => json_a == json_b,
                _ => a == b,
            }
        }
    }
}

fn normalize_value(value: &str, normalization: &ComparisonNormalizationConfig) -> NormalizedValue {
    let mut normalized = if normalization.trim_whitespace {
        value.trim().to_string()
    } else {
        value.to_string()
    };

    if normalization.treat_empty_as_null && normalized.is_empty() {
        return NormalizedValue::Null;
    }

    if is_null_token(&normalized, normalization) {
        return NormalizedValue::Null;
    }

    if normalization.date_normalization.enabled {
        if let Some(parsed_date) =
            normalize_date_value(&normalized, &normalization.date_normalization)
        {
            normalized = parsed_date;
        }
    }

    if normalization.case_insensitive {
        normalized = normalized.to_lowercase();
    }

    NormalizedValue::Text(normalized)
}

fn is_null_token(value: &str, normalization: &ComparisonNormalizationConfig) -> bool {
    normalization.null_tokens.iter().any(|token| {
        if normalization.null_token_case_insensitive {
            value.to_lowercase() == token.to_lowercase()
        } else {
            value == token
        }
    })
}

fn normalize_date_value(value: &str, config: &DateNormalizationConfig) -> Option<String> {
    let formats: Vec<&str> = if config.formats.is_empty() {
        DEFAULT_DATE_FORMATS.to_vec()
    } else {
        config.formats.iter().map(String::as_str).collect()
    };

    for format in formats {
        if let Ok(date) = NaiveDate::parse_from_str(value, format) {
            return Some(date.format("%Y-%m-%d").to_string());
        }

        if let Ok(date_time) = NaiveDateTime::parse_from_str(value, format) {
            return Some(date_time.format("%Y-%m-%dT%H:%M:%S").to_string());
        }
    }

    None
}

pub(super) fn find_differences(
    columns_a: &[String],
    columns_b: &[String],
    values_a: &[String],
    values_b: &[String],
    mappings: &[ColumnMapping],
    normalization: &ComparisonNormalizationConfig,
) -> Vec<ValueDifference> {
    let mut differences = Vec::new();

    let column_map: HashMap<&str, &str> = mappings
        .iter()
        .map(|mapping| {
            (
                mapping.file_a_column.as_str(),
                mapping.file_b_column.as_str(),
            )
        })
        .collect();

    for (index_a, column_a) in columns_a.iter().enumerate() {
        let mapped_column_b = column_map
            .get(column_a.as_str())
            .copied()
            .or_else(|| columns_b.get(index_a).map(|column| column.as_str()));

        let Some(column_b_name) = mapped_column_b else {
            continue;
        };

        let Some(index_b) = columns_b.iter().position(|column| column == column_b_name) else {
            continue;
        };

        if index_a < values_a.len()
            && index_b < values_b.len()
            && !values_match_with_config(&values_a[index_a], &values_b[index_b], normalization)
        {
            differences.push(ValueDifference {
                column_a: column_a.clone(),
                column_b: column_b_name.to_string(),
                value_a: values_a[index_a].clone(),
                value_b: values_b[index_b].clone(),
            });
        }
    }

    differences
}
