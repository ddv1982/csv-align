use super::types::{ComparisonConfig, DuplicateSource, RowComparisonResult};
use crate::backend::CsvAlignError;
use csv::Writer;
use serde_json::to_string;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;

#[derive(Debug, Default)]
struct ExportLayout {
    max_key_columns: usize,
    max_file_a_value_columns: usize,
    max_file_b_value_columns: usize,
}

fn compute_layout(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
) -> ExportLayout {
    let mut layout = ExportLayout::default();

    for result in results {
        layout.max_key_columns = layout.max_key_columns.max(result.key().len());

        match result {
            RowComparisonResult::Match {
                values_a, values_b, ..
            }
            | RowComparisonResult::Mismatch {
                values_a, values_b, ..
            } => {
                layout.max_file_a_value_columns =
                    layout.max_file_a_value_columns.max(values_a.len());
                layout.max_file_b_value_columns =
                    layout.max_file_b_value_columns.max(values_b.len());
            }
            RowComparisonResult::MissingLeft { values_b, .. } => {
                layout.max_file_b_value_columns =
                    layout.max_file_b_value_columns.max(values_b.len());
            }
            RowComparisonResult::MissingRight { values_a, .. } => {
                layout.max_file_a_value_columns =
                    layout.max_file_a_value_columns.max(values_a.len());
            }
            RowComparisonResult::UnkeyedLeft { values_b, .. } => {
                layout.max_file_b_value_columns =
                    layout.max_file_b_value_columns.max(values_b.len());
            }
            RowComparisonResult::UnkeyedRight { values_a, .. } => {
                layout.max_file_a_value_columns =
                    layout.max_file_a_value_columns.max(values_a.len());
            }
            RowComparisonResult::Duplicate { .. } => {}
        }
    }

    if let Some(config) = config {
        layout.max_key_columns = layout
            .max_key_columns
            .max(config.key_columns_a.len().max(config.key_columns_b.len()));
        layout.max_file_a_value_columns = layout
            .max_file_a_value_columns
            .max(config.comparison_columns_a.len());
        layout.max_file_b_value_columns = layout
            .max_file_b_value_columns
            .max(config.comparison_columns_b.len());
    }

    // Always produce at least one key/value slot so even tiny exports remain clear.
    layout.max_key_columns = layout.max_key_columns.max(1);
    layout.max_file_a_value_columns = layout.max_file_a_value_columns.max(1);
    layout.max_file_b_value_columns = layout.max_file_b_value_columns.max(1);

    layout
}

fn paired_label(
    prefix: &str,
    label_a: Option<&str>,
    label_b: Option<&str>,
    position: usize,
) -> String {
    match (label_a, label_b) {
        (Some(a), Some(b)) if a == b => format!("{prefix}: {a}"),
        (Some(a), Some(b)) => format!("{prefix}: {a} / {b}"),
        (Some(a), None) => format!("{prefix}: {a}"),
        (None, Some(b)) => format!("{prefix}: {b}"),
        (None, None) => format!("{prefix} {position}"),
    }
}

fn build_header(layout: &ExportLayout, config: Option<&ComparisonConfig>) -> Vec<String> {
    let mut header = vec!["Result".to_string()];

    for i in 1..=layout.max_key_columns {
        header.push(match config {
            Some(config) => paired_label(
                "Key",
                config.key_columns_a.get(i - 1).map(String::as_str),
                config.key_columns_b.get(i - 1).map(String::as_str),
                i,
            ),
            None => format!("Key {i}"),
        });
    }

    for i in 1..=layout.max_file_a_value_columns {
        header.push(match config {
            Some(config) => config
                .comparison_columns_a
                .get(i - 1)
                .map(|column| format!("File A: {column}"))
                .unwrap_or_else(|| format!("File A Value {i}")),
            None => format!("File A Value {i}"),
        });
    }

    for i in 1..=layout.max_file_b_value_columns {
        header.push(match config {
            Some(config) => config
                .comparison_columns_b
                .get(i - 1)
                .map(|column| format!("File B: {column}"))
                .unwrap_or_else(|| format!("File B Value {i}")),
            None => format!("File B Value {i}"),
        });
    }

    header.push("Difference Summary".to_string());
    header.push("Duplicate Rows File A".to_string());
    header.push("Duplicate Rows File B".to_string());
    header.push("Duplicate Summary".to_string());

    header
}

fn append_padded_columns(record: &mut Vec<String>, values: &[String], target_len: usize) {
    for i in 0..target_len {
        record.push(values.get(i).cloned().unwrap_or_default());
    }
}

fn format_difference_summary(result: &RowComparisonResult) -> String {
    match result {
        RowComparisonResult::Mismatch { .. } => result
            .differences()
            .iter()
            .map(|diff| {
                let columns = if diff.column_a == diff.column_b {
                    diff.column_a.clone()
                } else {
                    format!("{} -> {}", diff.column_a, diff.column_b)
                };
                format!("{columns}: {} -> {}", diff.value_a, diff.value_b)
            })
            .collect::<Vec<_>>()
            .join("; "),
        _ => String::new(),
    }
}

fn format_duplicate_summary(result: &RowComparisonResult) -> String {
    match result {
        RowComparisonResult::Duplicate {
            values_a, values_b, ..
        } => {
            let mut segments = Vec::new();

            if !values_a.is_empty() {
                segments.push(format!(
                    "File A: {}",
                    values_a
                        .iter()
                        .map(|entry| format!("[{}]", entry.join(", ")))
                        .collect::<Vec<_>>()
                        .join(" | ")
                ));
            }

            if !values_b.is_empty() {
                segments.push(format!(
                    "File B: {}",
                    values_b
                        .iter()
                        .map(|entry| format!("[{}]", entry.join(", ")))
                        .collect::<Vec<_>>()
                        .join(" | ")
                ));
            }

            segments.join(" ; ")
        }
        _ => String::new(),
    }
}

fn format_duplicate_side_rows(values: &[Vec<String>]) -> String {
    if values.is_empty() {
        String::new()
    } else {
        to_string(values).unwrap_or_default()
    }
}

fn build_record(result: &RowComparisonResult, layout: &ExportLayout) -> Vec<String> {
    let mut record = Vec::new();

    match result {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        } => {
            record.push("Match".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::Mismatch {
            key,
            values_a,
            values_b,
            ..
        } => {
            record.push("Mismatch".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::MissingLeft { key, values_b } => {
            record.push("Only in File B".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::MissingRight { key, values_a } => {
            record.push("Only in File A".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
        RowComparisonResult::UnkeyedLeft { key, values_b } => {
            record.push("Ignored in File B".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::UnkeyedRight { key, values_a } => {
            record.push("Ignored in File A".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
        RowComparisonResult::Duplicate { key, .. } => {
            let source_str = match result.duplicate_source() {
                Some(DuplicateSource::FileA) => "File A",
                Some(DuplicateSource::FileB) => "File B",
                Some(DuplicateSource::Both) | None => "Both Files",
            };

            record.push(format!("Duplicate ({source_str})"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
    }

    record.push(format_difference_summary(result));
    match result {
        RowComparisonResult::Duplicate {
            values_a, values_b, ..
        } => {
            record.push(format_duplicate_side_rows(values_a));
            record.push(format_duplicate_side_rows(values_b));
        }
        _ => {
            record.push(String::new());
            record.push(String::new());
        }
    }
    record.push(format_duplicate_summary(result));
    record
}

fn write_results_to_writer<W: Write>(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
    writer: W,
) -> Result<(), CsvAlignError> {
    let layout = compute_layout(results, config);
    let mut csv_writer = Writer::from_writer(writer);

    csv_writer
        .write_record(build_header(&layout, config))
        .map_err(|error| CsvAlignError::Internal(format!("Failed to write CSV header: {error}")))?;

    for result in results {
        csv_writer
            .write_record(build_record(result, &layout))
            .map_err(|error| {
                CsvAlignError::Internal(format!("Failed to write CSV record: {error}"))
            })?;
    }

    csv_writer.flush()?;
    Ok(())
}

/// Export comparison results to in-memory CSV bytes with optional config-aware labels.
pub fn export_results_to_bytes(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
) -> Result<Vec<u8>, CsvAlignError> {
    let mut buffer = Vec::new();
    write_results_to_writer(results, config, &mut buffer)?;
    Ok(buffer)
}

/// Export comparison results to a CSV file with optional config-aware labels.
pub fn write_export_results(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
    file_path: impl AsRef<Path>,
) -> Result<(), CsvAlignError> {
    let file = File::create(file_path.as_ref())?;
    write_results_to_writer(results, config, BufWriter::new(file))
}
