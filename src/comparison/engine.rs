use super::super::data::types::*;
use chrono::{NaiveDate, NaiveDateTime};
use serde_json::Value;
use std::collections::HashMap;

const DEFAULT_DATE_FORMATS: &[&str] = &[
    "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%Y.%m.%d", "%d.%m.%Y",
    "%m.%d.%Y", "%Y%m%d", "%d %b %Y", "%d %B %Y", "%d-%b-%y",
];

/// Compare two CSV datasets based on configuration
pub fn compare_csv_data(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: &ComparisonConfig,
) -> Vec<RowComparisonResult> {
    let mut results = Vec::new();

    // Get column indices for key columns
    let key_indices_a = get_column_indices(&csv_a.headers, &config.key_columns_a);
    let key_indices_b = get_column_indices(&csv_b.headers, &config.key_columns_b);

    // Get column indices for comparison columns
    let comp_indices_a = get_column_indices(&csv_a.headers, &config.comparison_columns_a);
    let comp_indices_b = get_column_indices(&csv_b.headers, &config.comparison_columns_b);

    // Create maps for quick lookup
    let map_a = create_key_map(csv_a, &key_indices_a);
    let map_b = create_key_map(csv_b, &key_indices_b);

    // Track which keys we've processed
    let mut processed_keys = std::collections::HashSet::new();

    // Process all keys from file A
    for (key, indices_a) in &map_a {
        if processed_keys.contains(key) {
            continue;
        }
        processed_keys.insert(key.clone());

        // Handle duplicates in File A
        if indices_a.len() > 1 {
            // Report duplicates from File A
            let values: Vec<Vec<String>> = indices_a
                .iter()
                .map(|&i| extract_columns(&csv_a.rows[i], &comp_indices_a))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: key.clone(),
                source: DuplicateSource::FileA,
                values,
            });

            // Still compare the first occurrence with File B if it exists
            if let Some(indices_b) = map_b.get(key) {
                if indices_b.len() == 1 {
                    // Single match in File B - compare with first occurrence in File A
                    let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
                    let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

                    let differences = find_differences(
                        &config.comparison_columns_a,
                        &config.comparison_columns_b,
                        &values_a,
                        &values_b,
                        &config.column_mappings,
                        &config.normalization,
                    );

                    if differences.is_empty() {
                        results.push(RowComparisonResult::Match {
                            key: key.clone(),
                            values_a,
                            values_b,
                        });
                    } else {
                        results.push(RowComparisonResult::Mismatch {
                            key: key.clone(),
                            values_a,
                            values_b,
                            differences,
                        });
                    }
                } else {
                    // Multiple matches in both files - mark as duplicate in both
                    let values_a: Vec<Vec<String>> = indices_a
                        .iter()
                        .map(|&i| extract_columns(&csv_a.rows[i], &comp_indices_a))
                        .collect();
                    let values_b: Vec<Vec<String>> = indices_b
                        .iter()
                        .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                        .collect();

                    results.push(RowComparisonResult::Duplicate {
                        key: key.clone(),
                        source: DuplicateSource::Both,
                        values: [values_a, values_b].concat(),
                    });
                }
            } else {
                // Key only in File A - missing from File B
                // Already reported as duplicate, no need for missing right
            }
            continue;
        }

        // Handle duplicates in File B
        if let Some(indices_b) = map_b.get(key) {
            if indices_b.len() > 1 {
                // Report duplicates from File B
                let values: Vec<Vec<String>> = indices_b
                    .iter()
                    .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                    .collect();
                results.push(RowComparisonResult::Duplicate {
                    key: key.clone(),
                    source: DuplicateSource::FileB,
                    values,
                });

                // Compare the first occurrence in File B with File A
                let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
                let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

                let differences = find_differences(
                    &config.comparison_columns_a,
                    &config.comparison_columns_b,
                    &values_a,
                    &values_b,
                    &config.column_mappings,
                    &config.normalization,
                );

                if differences.is_empty() {
                    results.push(RowComparisonResult::Match {
                        key: key.clone(),
                        values_a,
                        values_b,
                    });
                } else {
                    results.push(RowComparisonResult::Mismatch {
                        key: key.clone(),
                        values_a,
                        values_b,
                        differences,
                    });
                }
                continue;
            }
        }

        // Single occurrence in both files or only in File A
        if let Some(indices_b) = map_b.get(key) {
            // Key exists in both files with single occurrences
            let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
            let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

            let differences = find_differences(
                &config.comparison_columns_a,
                &config.comparison_columns_b,
                &values_a,
                &values_b,
                &config.column_mappings,
                &config.normalization,
            );

            if differences.is_empty() {
                results.push(RowComparisonResult::Match {
                    key: key.clone(),
                    values_a,
                    values_b,
                });
            } else {
                results.push(RowComparisonResult::Mismatch {
                    key: key.clone(),
                    values_a,
                    values_b,
                    differences,
                });
            }
        } else {
            // Key only in File A - missing from File B
            let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
            results.push(RowComparisonResult::MissingRight {
                key: key.clone(),
                values_a,
            });
        }
    }

    // Process keys only in File B
    for (key, indices_b) in &map_b {
        if processed_keys.contains(key) {
            continue;
        }

        // Handle duplicates in File B (already processed in the main loop)
        if indices_b.len() > 1 {
            // Report duplicates from File B
            let values: Vec<Vec<String>> = indices_b
                .iter()
                .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: key.clone(),
                source: DuplicateSource::FileB,
                values,
            });
            continue;
        }

        // Key only in File B - missing from File A
        let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);
        results.push(RowComparisonResult::MissingLeft {
            key: key.clone(),
            values_b,
        });
    }

    results
}

/// Get column indices for given column names
fn get_column_indices(headers: &[String], column_names: &[String]) -> Vec<usize> {
    column_names
        .iter()
        .filter_map(|name| headers.iter().position(|h| h == name))
        .collect()
}

/// Create a map from key values to row indices
fn create_key_map(csv_data: &CsvData, key_indices: &[usize]) -> HashMap<Vec<String>, Vec<usize>> {
    let mut map = HashMap::new();

    for (i, row) in csv_data.rows.iter().enumerate() {
        let key: Vec<String> = key_indices
            .iter()
            .map(|&idx| row.get(idx).cloned().unwrap_or_default())
            .collect();

        map.entry(key).or_insert_with(Vec::new).push(i);
    }

    map
}

/// Extract values from specified column indices
fn extract_columns(row: &[String], indices: &[usize]) -> Vec<String> {
    indices
        .iter()
        .map(|&idx| row.get(idx).cloned().unwrap_or_default())
        .collect()
}

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

/// Find differences between two sets of values
fn find_differences(
    columns_a: &[String],
    columns_b: &[String],
    values_a: &[String],
    values_b: &[String],
    mappings: &[ColumnMapping],
    normalization: &ComparisonNormalizationConfig,
) -> Vec<ValueDifference> {
    let mut differences = Vec::new();

    // Create a map from file A columns to file B columns
    let column_map: HashMap<&str, &str> = mappings
        .iter()
        .map(|m| (m.file_a_column.as_str(), m.file_b_column.as_str()))
        .collect();

    // Compare each selected comparison column.
    // Prefer explicit mapping, then fall back to positional pairing.
    for (i, col_a) in columns_a.iter().enumerate() {
        let mapped_or_positional_col_b = column_map
            .get(col_a.as_str())
            .copied()
            .or_else(|| columns_b.get(i).map(|c| c.as_str()));

        let Some(col_b_name) = mapped_or_positional_col_b else {
            continue;
        };

        let Some(j) = columns_b.iter().position(|c| c == col_b_name) else {
            continue;
        };

        if i < values_a.len()
            && j < values_b.len()
            && !values_match_with_config(&values_a[i], &values_b[j], normalization)
        {
            differences.push(ValueDifference {
                column_a: col_a.clone(),
                column_b: col_b_name.to_string(),
                value_a: values_a[i].clone(),
                value_b: values_b[j].clone(),
            });
        }
    }

    differences
}

/// Generate summary statistics from comparison results
pub fn generate_summary(
    results: &[RowComparisonResult],
    total_rows_a: usize,
    total_rows_b: usize,
) -> ComparisonSummary {
    let mut summary = ComparisonSummary {
        total_rows_a,
        total_rows_b,
        matches: 0,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
    };

    for result in results {
        match result {
            RowComparisonResult::Match { .. } => summary.matches += 1,
            RowComparisonResult::Mismatch { .. } => summary.mismatches += 1,
            RowComparisonResult::MissingLeft { .. } => summary.missing_left += 1,
            RowComparisonResult::MissingRight { .. } => summary.missing_right += 1,
            RowComparisonResult::Duplicate { source, .. } => match source {
                DuplicateSource::FileA => summary.duplicates_a += 1,
                DuplicateSource::FileB => summary.duplicates_b += 1,
                DuplicateSource::Both => {
                    summary.duplicates_a += 1;
                    summary.duplicates_b += 1;
                }
            },
        }
    }

    summary
}
