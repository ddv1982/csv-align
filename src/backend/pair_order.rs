use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::backend::error::CsvAlignError;
use crate::backend::requests::CompareValidationError;
use crate::backend::requests::{LoadPairOrderResponse, PairOrderSelection};
use crate::backend::session::SessionData;
use crate::backend::validation::validate_selected_columns_by_physical_or_virtual_source;
use crate::data::types::CsvData;

const PAIR_ORDER_FILE_VERSION: u8 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct PersistedPairOrder {
    version: u8,
    headers_a: Vec<String>,
    headers_b: Vec<String>,
    selection: PairOrderSelection,
}

pub fn save_pair_order_workflow(
    session_data: &SessionData,
    selection: PairOrderSelection,
) -> Result<String, CsvAlignError> {
    let (csv_a, csv_b) = session_csvs(session_data)?;
    validate_selection(csv_a, csv_b, &selection)?;

    serde_json::to_string_pretty(&PersistedPairOrder {
        version: PAIR_ORDER_FILE_VERSION,
        headers_a: csv_a.headers.clone(),
        headers_b: csv_b.headers.clone(),
        selection,
    })
    .map_err(|error| CsvAlignError::Internal(format!("Failed to serialize pair order: {error}")))
}

pub fn load_pair_order_workflow(
    session_data: &SessionData,
    contents: &str,
) -> Result<LoadPairOrderResponse, CsvAlignError> {
    validate_pair_order_version(contents)?;

    let persisted: PersistedPairOrder = serde_json::from_str(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse pair-order file: {error}"))
    })?;

    if persisted.version != PAIR_ORDER_FILE_VERSION {
        return Err(CsvAlignError::BadInput(format!(
            "Unsupported pair-order file version {}",
            persisted.version
        )));
    }

    let (csv_a, csv_b) = session_csvs(session_data)?;

    if let Some(message) = header_mismatch_message("File A", &persisted.headers_a, &csv_a.headers) {
        return Err(CsvAlignError::BadInput(message));
    }

    if let Some(message) = header_mismatch_message("File B", &persisted.headers_b, &csv_b.headers) {
        return Err(CsvAlignError::BadInput(message));
    }

    validate_selection(csv_a, csv_b, &persisted.selection)?;

    Ok(LoadPairOrderResponse {
        selection: persisted.selection,
    })
}

fn validate_pair_order_version(contents: &str) -> Result<(), CsvAlignError> {
    let value: Value = serde_json::from_str(contents).map_err(|error| {
        CsvAlignError::Parse(format!("Failed to parse pair-order file: {error}"))
    })?;

    let version = value
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            CsvAlignError::Parse(
                "Failed to parse pair-order file: missing or invalid version field".to_string(),
            )
        })?;

    if version != u64::from(PAIR_ORDER_FILE_VERSION) {
        return Err(CsvAlignError::BadInput(format!(
            "Unsupported pair-order file version {version}"
        )));
    }

    Ok(())
}

fn session_csvs(session_data: &SessionData) -> Result<(&CsvData, &CsvData), CsvAlignError> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File A not selected or loaded".to_string()))?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File B not selected or loaded".to_string()))?;

    Ok((csv_a, csv_b))
}

fn validate_selection(
    csv_a: &CsvData,
    csv_b: &CsvData,
    selection: &PairOrderSelection,
) -> Result<(), CsvAlignError> {
    validate_saved_selected_columns(
        "Saved key columns for File A",
        &csv_a.headers,
        &selection.key_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved key columns for File B",
        &csv_b.headers,
        &selection.key_columns_b,
    )?;
    validate_saved_selected_columns(
        "Saved comparison columns for File A",
        &csv_a.headers,
        &selection.comparison_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved comparison columns for File B",
        &csv_b.headers,
        &selection.comparison_columns_b,
    )?;

    Ok(())
}

fn validate_saved_selected_columns(
    label: &'static str,
    headers: &[String],
    selected_columns: &[String],
) -> Result<(), CsvAlignError> {
    validate_selected_columns_by_physical_or_virtual_source(label, headers, selected_columns)
        .map_err(saved_selection_validation_error)
}

fn saved_selection_validation_error(error: CompareValidationError) -> CsvAlignError {
    match error {
        CompareValidationError::MissingColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} reference missing columns: {}",
                columns.join(", ")
            ))
        }
        CompareValidationError::DuplicateColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} contain duplicate columns: {}",
                columns.join(", ")
            ))
        }
        other => CsvAlignError::Validation(other),
    }
}

fn header_mismatch_message(
    file_label: &str,
    saved_headers: &[String],
    current_headers: &[String],
) -> Option<String> {
    let missing_from_saved = header_count_difference(current_headers, saved_headers);
    let unexpected_in_saved = header_count_difference(saved_headers, current_headers);

    if missing_from_saved.is_empty() && unexpected_in_saved.is_empty() {
        return None;
    }

    let mut details = Vec::new();

    if !missing_from_saved.is_empty() {
        details.push(format!(
            "missing from saved: {}",
            missing_from_saved.join(", ")
        ));
    }

    if !unexpected_in_saved.is_empty() {
        details.push(format!(
            "unexpected in saved: {}",
            unexpected_in_saved.join(", ")
        ));
    }

    Some(format!(
        "Saved pair order does not match the currently loaded {file_label} columns: {}",
        details.join("; ")
    ))
}

fn header_count_difference(expected_headers: &[String], actual_headers: &[String]) -> Vec<String> {
    let expected_counts = header_name_counts(expected_headers);
    let actual_counts = header_name_counts(actual_headers);
    let mut differences = Vec::new();

    for (header, expected_count) in expected_counts {
        let actual_count = actual_counts.get(header).copied().unwrap_or_default();
        let missing_count = expected_count.saturating_sub(actual_count);

        if missing_count == 1 {
            differences.push(header.to_string());
        } else if missing_count > 1 {
            differences.push(format!("{header} (x{missing_count})"));
        }
    }

    differences
}

fn header_name_counts(headers: &[String]) -> BTreeMap<&str, usize> {
    let mut counts = BTreeMap::new();

    for header in headers {
        *counts.entry(header.as_str()).or_default() += 1;
    }

    counts
}
