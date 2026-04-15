use std::collections::HashSet;

use crate::backend::requests::{CompareRequest, CompareValidationError, MappingRequest};
use crate::comparison::value_compare::value_is_nullish;
use crate::data::types::{ColumnMapping, ComparisonConfig, CsvData, MappingType};

pub(crate) fn build_comparison_config(
    csv_a: &CsvData,
    csv_b: &CsvData,
    request: CompareRequest,
) -> Result<ComparisonConfig, CompareValidationError> {
    let CompareRequest {
        key_columns_a,
        key_columns_b,
        comparison_columns_a,
        comparison_columns_b,
        column_mappings,
        normalization,
    } = request;

    validate_selected_columns("Key columns for File A", &csv_a.headers, &key_columns_a)?;
    validate_selected_columns("Key columns for File B", &csv_b.headers, &key_columns_b)?;
    validate_matching_counts(
        "Key columns for File A",
        key_columns_a.len(),
        "Key columns for File B",
        key_columns_b.len(),
    )?;
    validate_key_column_values(
        "Key columns for File A",
        csv_a,
        &key_columns_a,
        &normalization,
    )?;
    validate_key_column_values(
        "Key columns for File B",
        csv_b,
        &key_columns_b,
        &normalization,
    )?;

    validate_selected_columns(
        "Comparison columns for File A",
        &csv_a.headers,
        &comparison_columns_a,
    )?;
    validate_selected_columns(
        "Comparison columns for File B",
        &csv_b.headers,
        &comparison_columns_b,
    )?;
    validate_matching_counts(
        "Comparison columns for File A",
        comparison_columns_a.len(),
        "Comparison columns for File B",
        comparison_columns_b.len(),
    )?;

    let column_mappings = build_column_mappings(
        &csv_a.headers,
        &csv_b.headers,
        &comparison_columns_a,
        &comparison_columns_b,
        column_mappings,
    )?;

    Ok(ComparisonConfig {
        key_columns_a,
        key_columns_b,
        comparison_columns_a,
        comparison_columns_b,
        column_mappings,
        normalization,
    })
}

fn build_column_mappings(
    headers_a: &[String],
    headers_b: &[String],
    comparison_columns_a: &[String],
    comparison_columns_b: &[String],
    column_mappings: Vec<MappingRequest>,
) -> Result<Vec<ColumnMapping>, CompareValidationError> {
    if column_mappings.is_empty() {
        return Ok(comparison_columns_a
            .iter()
            .zip(comparison_columns_b.iter())
            .map(|(file_a_column, file_b_column)| ColumnMapping {
                file_a_column: file_a_column.clone(),
                file_b_column: file_b_column.clone(),
                mapping_type: MappingType::ManualMatch,
            })
            .collect());
    }

    validate_matching_counts(
        "Provided column mappings for File A",
        column_mappings.len(),
        "selected comparison columns",
        comparison_columns_a.len(),
    )?;

    let allowed_a: HashSet<&str> = comparison_columns_a.iter().map(String::as_str).collect();
    let allowed_b: HashSet<&str> = comparison_columns_b.iter().map(String::as_str).collect();
    let available_a: HashSet<&str> = headers_a.iter().map(String::as_str).collect();
    let available_b: HashSet<&str> = headers_b.iter().map(String::as_str).collect();
    let mut seen_a = HashSet::new();
    let mut seen_b = HashSet::new();
    let mut parsed_mappings = Vec::with_capacity(column_mappings.len());

    for mapping in column_mappings {
        if !available_a.contains(mapping.file_a_column.as_str()) {
            return Err(CompareValidationError::MissingColumns {
                selection: "Column mappings for File A",
                columns: vec![mapping.file_a_column],
            });
        }

        if !available_b.contains(mapping.file_b_column.as_str()) {
            return Err(CompareValidationError::MissingColumns {
                selection: "Column mappings for File B",
                columns: vec![mapping.file_b_column],
            });
        }

        if !allowed_a.contains(mapping.file_a_column.as_str())
            || !allowed_b.contains(mapping.file_b_column.as_str())
        {
            return Err(CompareValidationError::InvalidMappings(
                "Column mappings must only reference selected comparison columns".to_string(),
            ));
        }

        if !seen_a.insert(mapping.file_a_column.clone())
            || !seen_b.insert(mapping.file_b_column.clone())
        {
            return Err(CompareValidationError::InvalidMappings(
                "Column mappings must pair each selected comparison column exactly once"
                    .to_string(),
            ));
        }

        parsed_mappings.push(parse_mapping_request(mapping)?);
    }

    if seen_a.len() != allowed_a.len() || seen_b.len() != allowed_b.len() {
        return Err(CompareValidationError::InvalidMappings(
            "Column mappings must cover every selected comparison column exactly once".to_string(),
        ));
    }

    Ok(parsed_mappings)
}

fn parse_mapping_request(mapping: MappingRequest) -> Result<ColumnMapping, CompareValidationError> {
    let mapping_type = match mapping.mapping_type.as_str() {
        "exact" => MappingType::ExactMatch,
        "manual" => MappingType::ManualMatch,
        "fuzzy" => {
            let similarity = mapping.similarity.ok_or_else(|| {
                CompareValidationError::InvalidSimilarity(
                    "Fuzzy mappings require a similarity value between 0.0 and 1.0".to_string(),
                )
            })?;

            if !(0.0..=1.0).contains(&similarity) {
                return Err(CompareValidationError::InvalidSimilarity(
                    "Fuzzy mappings require a similarity value between 0.0 and 1.0".to_string(),
                ));
            }

            MappingType::FuzzyMatch(similarity)
        }
        other => {
            return Err(CompareValidationError::UnknownMappingType(
                other.to_string(),
            ))
        }
    };

    Ok(ColumnMapping {
        file_a_column: mapping.file_a_column,
        file_b_column: mapping.file_b_column,
        mapping_type,
    })
}

fn validate_selected_columns(
    selection: &'static str,
    headers: &[String],
    selected: &[String],
) -> Result<(), CompareValidationError> {
    if selected.is_empty() {
        return Err(CompareValidationError::EmptyColumns(selection));
    }

    let duplicates = duplicate_values(selected);
    if !duplicates.is_empty() {
        return Err(CompareValidationError::DuplicateColumns {
            selection,
            columns: duplicates,
        });
    }

    let header_set: HashSet<&str> = headers.iter().map(String::as_str).collect();
    let missing: Vec<String> = selected
        .iter()
        .filter(|column| !header_set.contains(column.as_str()))
        .cloned()
        .collect();

    if missing.is_empty() {
        Ok(())
    } else {
        Err(CompareValidationError::MissingColumns {
            selection,
            columns: missing,
        })
    }
}

fn validate_matching_counts(
    selection_a: &'static str,
    count_a: usize,
    selection_b: &'static str,
    count_b: usize,
) -> Result<(), CompareValidationError> {
    if count_a == count_b {
        Ok(())
    } else {
        Err(CompareValidationError::MismatchedColumnCounts {
            selection_a,
            count_a,
            selection_b,
            count_b,
        })
    }
}

fn validate_key_column_values(
    selection: &'static str,
    csv: &CsvData,
    selected: &[String],
    normalization: &crate::data::types::ComparisonNormalizationConfig,
) -> Result<(), CompareValidationError> {
    let offending_columns: Vec<String> = selected
        .iter()
        .filter(|column| {
            let Some(index) = csv.headers.iter().position(|header| header == *column) else {
                return false;
            };

            csv.rows.iter().any(|row| {
                row.get(index)
                    .map(|value| value_is_nullish(value, normalization))
                    .unwrap_or_else(|| value_is_nullish("", normalization))
            })
        })
        .cloned()
        .collect();

    if offending_columns.is_empty() {
        Ok(())
    } else {
        Err(CompareValidationError::NullishKeyValues {
            selection,
            columns: offending_columns,
        })
    }
}

fn duplicate_values(values: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut duplicates = Vec::new();

    for value in values {
        if !seen.insert(value.as_str()) && !duplicates.iter().any(|duplicate| duplicate == value) {
            duplicates.push(value.clone());
        }
    }

    duplicates
}
