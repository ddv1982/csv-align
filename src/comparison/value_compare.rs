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

pub(crate) fn normalize_key_value(
    value: &str,
    normalization: &ComparisonNormalizationConfig,
) -> Option<String> {
    match normalize_value(value, normalization) {
        NormalizedValue::Null => None,
        NormalizedValue::Text(value) => Some(value),
    }
}

pub(crate) fn normalize_display_value(
    value: &str,
    normalization: &ComparisonNormalizationConfig,
) -> String {
    let rounding_candidate = if normalization.trim_whitespace {
        value.trim()
    } else {
        value
    };

    if normalization.decimal_rounding.enabled
        && let Some(rounded_number) =
            round_numeric_value(rounding_candidate, normalization.decimal_rounding.decimals)
    {
        return rounded_number;
    }

    value.to_string()
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

    if normalization.date_normalization.enabled
        && let Some(parsed_date) =
            normalize_date_value(&normalized, &normalization.date_normalization)
    {
        normalized = parsed_date;
    }

    if normalization.decimal_rounding.enabled {
        if let Some(rounded_number) =
            round_numeric_value(&normalized, normalization.decimal_rounding.decimals)
        {
            normalized = rounded_number;
        } else if normalization.numeric_equivalence
            && let Some(parsed_number) = normalize_numeric_value(&normalized)
        {
            normalized = parsed_number;
        }
    } else if normalization.numeric_equivalence
        && let Some(parsed_number) = normalize_numeric_value(&normalized)
    {
        normalized = parsed_number;
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

fn normalize_numeric_value(value: &str) -> Option<String> {
    let (is_negative, integer_part, fractional_part) = parse_numeric_parts(value)?;
    Some(format_numeric_parts(
        is_negative,
        normalize_integer_digits(integer_part),
        fractional_part.trim_end_matches('0'),
    ))
}

fn round_numeric_value(value: &str, decimals: u32) -> Option<String> {
    let (is_negative, integer_part, fractional_part) = parse_numeric_parts(value)?;
    let integer = normalize_integer_digits(integer_part);
    let decimals = usize::try_from(decimals).ok()?;

    if decimals >= fractional_part.len() {
        return Some(format_numeric_parts(
            is_negative,
            integer,
            fractional_part.trim_end_matches('0'),
        ));
    }

    let mut scaled = format!("{integer}{}", &fractional_part[..decimals]);
    if scaled.is_empty() {
        scaled.push('0');
    }

    if fractional_part.as_bytes()[decimals] >= b'5' {
        scaled = increment_digit_string(&scaled);
    }

    if decimals == 0 {
        let number = normalize_integer_digits(&scaled).to_string();
        return Some(apply_numeric_sign(is_negative, number));
    }

    let minimum_width = decimals + 1;
    if scaled.len() < minimum_width {
        scaled = format!("{scaled:0>minimum_width$}");
    }

    let split_index = scaled.len() - decimals;
    let integer = normalize_integer_digits(&scaled[..split_index]);
    let fractional = scaled[split_index..].trim_end_matches('0');

    Some(format_numeric_parts(is_negative, integer, fractional))
}

fn parse_numeric_parts(value: &str) -> Option<(bool, &str, &str)> {
    let (is_negative, unsigned) = match value.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, value.strip_prefix('+').unwrap_or(value)),
    };

    if unsigned.is_empty() || unsigned.chars().filter(|ch| *ch == '.').count() > 1 {
        return None;
    }

    let (integer_part, fractional_part) = unsigned.split_once('.').unwrap_or((unsigned, ""));
    if integer_part.is_empty() && fractional_part.is_empty() {
        return None;
    }

    if !integer_part.chars().all(|ch| ch.is_ascii_digit())
        || !fractional_part.chars().all(|ch| ch.is_ascii_digit())
    {
        return None;
    }

    Some((is_negative, integer_part, fractional_part))
}

fn normalize_integer_digits(value: &str) -> &str {
    let normalized = value.trim_start_matches('0');
    if normalized.is_empty() {
        "0"
    } else {
        normalized
    }
}

fn increment_digit_string(value: &str) -> String {
    let mut digits: Vec<u8> = value.bytes().collect();
    let mut carry = true;

    for digit in digits.iter_mut().rev() {
        if !carry {
            break;
        }

        if *digit == b'9' {
            *digit = b'0';
        } else {
            *digit += 1;
            carry = false;
        }
    }

    let mut incremented: String = digits.into_iter().map(char::from).collect();
    if carry {
        incremented.insert(0, '1');
    }

    incremented
}

fn format_numeric_parts(is_negative: bool, integer: &str, fractional: &str) -> String {
    let number = if fractional.is_empty() {
        integer.to_string()
    } else {
        format!("{integer}.{fractional}")
    };

    apply_numeric_sign(is_negative, number)
}

fn apply_numeric_sign(is_negative: bool, number: String) -> String {
    if is_negative && number != "0" {
        format!("-{number}")
    } else {
        number
    }
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
                value_a: normalize_display_value(&values_a[index_a], normalization),
                value_b: normalize_display_value(&values_b[index_b], normalization),
            });
        }
    }

    differences
}
