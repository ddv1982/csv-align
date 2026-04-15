use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::backend::requests::{LoadPairOrderResponse, PairOrderSelection};
use crate::backend::session::SessionData;

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
) -> Result<String, String> {
    let (headers_a, headers_b) = session_headers(session_data)?;
    validate_selection(headers_a, headers_b, &selection)?;

    serde_json::to_string_pretty(&PersistedPairOrder {
        version: PAIR_ORDER_FILE_VERSION,
        headers_a: headers_a.to_vec(),
        headers_b: headers_b.to_vec(),
        selection,
    })
    .map_err(|error| format!("Failed to serialize pair order: {error}"))
}

pub fn load_pair_order_workflow(
    session_data: &SessionData,
    contents: &str,
) -> Result<LoadPairOrderResponse, String> {
    let persisted: PersistedPairOrder = serde_json::from_str(contents)
        .map_err(|error| format!("Failed to parse pair-order file: {error}"))?;

    if persisted.version != PAIR_ORDER_FILE_VERSION {
        return Err(format!(
            "Unsupported pair-order file version {}",
            persisted.version
        ));
    }

    let (headers_a, headers_b) = session_headers(session_data)?;

    if !same_header_names(&persisted.headers_a, headers_a) {
        return Err(
            "Saved pair order does not match the currently loaded File A columns".to_string(),
        );
    }

    if !same_header_names(&persisted.headers_b, headers_b) {
        return Err(
            "Saved pair order does not match the currently loaded File B columns".to_string(),
        );
    }

    validate_selection(headers_a, headers_b, &persisted.selection)?;

    Ok(LoadPairOrderResponse {
        selection: persisted.selection,
    })
}

fn session_headers(session_data: &SessionData) -> Result<(&[String], &[String]), String> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| "File A not selected or loaded".to_string())?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| "File B not selected or loaded".to_string())?;

    Ok((&csv_a.headers, &csv_b.headers))
}

fn validate_selection(
    headers_a: &[String],
    headers_b: &[String],
    selection: &PairOrderSelection,
) -> Result<(), String> {
    validate_selected_columns(
        "Saved key columns for File A",
        headers_a,
        &selection.key_columns_a,
    )?;
    validate_selected_columns(
        "Saved key columns for File B",
        headers_b,
        &selection.key_columns_b,
    )?;
    validate_selected_columns(
        "Saved comparison columns for File A",
        headers_a,
        &selection.comparison_columns_a,
    )?;
    validate_selected_columns(
        "Saved comparison columns for File B",
        headers_b,
        &selection.comparison_columns_b,
    )?;

    Ok(())
}

fn validate_selected_columns(
    label: &'static str,
    headers: &[String],
    selected_columns: &[String],
) -> Result<(), String> {
    let mut seen = HashSet::new();
    let available: HashSet<&str> = headers.iter().map(String::as_str).collect();

    for column in selected_columns {
        if !available.contains(column.as_str()) {
            return Err(format!("{label} reference missing columns: {column}"));
        }

        if !seen.insert(column.as_str()) {
            return Err(format!("{label} contain duplicate columns: {column}"));
        }
    }

    Ok(())
}

fn same_header_names(saved_headers: &[String], current_headers: &[String]) -> bool {
    header_name_counts(saved_headers) == header_name_counts(current_headers)
}

fn header_name_counts(headers: &[String]) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();

    for header in headers {
        *counts.entry(header.as_str()).or_default() += 1;
    }

    counts
}
