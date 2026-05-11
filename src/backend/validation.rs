use std::collections::HashSet;

use crate::backend::requests::{CompareRequest, CompareValidationError, MappingRequest};
use crate::data::json_fields::{label_has_physical_or_virtual_source, valid_column_labels};
use crate::data::types::{ColumnMapping, ComparisonConfig, CsvData, MappingType};

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct SelectedColumnsAudit {
    pub duplicates: Vec<String>,
    pub missing: Vec<String>,
}

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

    validate_selected_columns("Key columns for File A", csv_a, &key_columns_a)?;
    validate_selected_columns("Key columns for File B", csv_b, &key_columns_b)?;
    if !normalization.flexible_key_matching {
        validate_matching_counts(
            "Key columns for File A",
            key_columns_a.len(),
            "Key columns for File B",
            key_columns_b.len(),
        )?;
    }

    validate_selected_columns(
        "Comparison columns for File A",
        csv_a,
        &comparison_columns_a,
    )?;
    validate_selected_columns(
        "Comparison columns for File B",
        csv_b,
        &comparison_columns_b,
    )?;
    validate_matching_counts(
        "Comparison columns for File A",
        comparison_columns_a.len(),
        "Comparison columns for File B",
        comparison_columns_b.len(),
    )?;

    let column_mappings = build_column_mappings(
        csv_a,
        csv_b,
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
    csv_a: &CsvData,
    csv_b: &CsvData,
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
    let available_a = valid_column_labels(csv_a);
    let available_b = valid_column_labels(csv_b);
    let mut seen_a = HashSet::new();
    let mut seen_b = HashSet::new();
    let mut parsed_mappings = Vec::with_capacity(column_mappings.len());

    for mapping in column_mappings {
        if !available_a.contains(&mapping.file_a_column) {
            return Err(CompareValidationError::MissingColumns {
                selection: "Column mappings for File A",
                columns: vec![mapping.file_a_column],
            });
        }

        if !available_b.contains(&mapping.file_b_column) {
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
            ));
        }
    };

    Ok(ColumnMapping {
        file_a_column: mapping.file_a_column,
        file_b_column: mapping.file_b_column,
        mapping_type,
    })
}

pub(crate) fn validate_selected_columns(
    selection: &'static str,
    csv_data: &CsvData,
    selected: &[String],
) -> Result<(), CompareValidationError> {
    if selected.is_empty() {
        return Err(CompareValidationError::EmptyColumns(selection));
    }

    let audit = audit_selected_columns(csv_data, selected);

    if !audit.duplicates.is_empty() {
        return Err(CompareValidationError::DuplicateColumns {
            selection,
            columns: audit.duplicates,
        });
    }

    if audit.missing.is_empty() {
        Ok(())
    } else {
        Err(CompareValidationError::MissingColumns {
            selection,
            columns: audit.missing,
        })
    }
}

pub(crate) fn validate_selected_columns_by_physical_or_virtual_source(
    selection: &'static str,
    headers: &[String],
    selected: &[String],
) -> Result<(), CompareValidationError> {
    if selected.is_empty() {
        return Err(CompareValidationError::EmptyColumns(selection));
    }

    let audit = SelectedColumnsAudit {
        duplicates: duplicate_values(selected),
        missing: selected
            .iter()
            .filter(|column| !label_has_physical_or_virtual_source(headers, column))
            .cloned()
            .collect(),
    };

    if !audit.duplicates.is_empty() {
        return Err(CompareValidationError::DuplicateColumns {
            selection,
            columns: audit.duplicates,
        });
    }

    if audit.missing.is_empty() {
        Ok(())
    } else {
        Err(CompareValidationError::MissingColumns {
            selection,
            columns: audit.missing,
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

pub(crate) fn audit_selected_columns(
    csv_data: &CsvData,
    selected: &[String],
) -> SelectedColumnsAudit {
    let labels = valid_column_labels(csv_data);

    SelectedColumnsAudit {
        duplicates: duplicate_values(selected),
        missing: selected
            .iter()
            .filter(|column| !labels.contains(*column))
            .cloned()
            .collect(),
    }
}
