use super::types::{DuplicateSource, RowComparisonResult};
use csv::Writer;
use std::error::Error;
use std::fs::File;
use std::io::{BufWriter, Write};

#[derive(Debug, Default)]
struct ExportLayout {
    max_key_columns: usize,
    max_file_a_value_columns: usize,
    max_file_b_value_columns: usize,
    max_difference_groups: usize,
    max_duplicate_entries: usize,
    max_duplicate_entry_values: usize,
}

fn compute_layout(results: &[RowComparisonResult]) -> ExportLayout {
    let mut layout = ExportLayout::default();

    for result in results {
        match result {
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            }
            | RowComparisonResult::Mismatch {
                key,
                values_a,
                values_b,
                ..
            } => {
                layout.max_key_columns = layout.max_key_columns.max(key.len());
                layout.max_file_a_value_columns =
                    layout.max_file_a_value_columns.max(values_a.len());
                layout.max_file_b_value_columns =
                    layout.max_file_b_value_columns.max(values_b.len());
            }
            RowComparisonResult::MissingLeft { key, values_b } => {
                layout.max_key_columns = layout.max_key_columns.max(key.len());
                layout.max_file_b_value_columns =
                    layout.max_file_b_value_columns.max(values_b.len());
            }
            RowComparisonResult::MissingRight { key, values_a } => {
                layout.max_key_columns = layout.max_key_columns.max(key.len());
                layout.max_file_a_value_columns =
                    layout.max_file_a_value_columns.max(values_a.len());
            }
            RowComparisonResult::Duplicate { key, values, .. } => {
                layout.max_key_columns = layout.max_key_columns.max(key.len());
                layout.max_duplicate_entries = layout.max_duplicate_entries.max(values.len());
                let max_entry_values = values.iter().map(Vec::len).max().unwrap_or(0);
                layout.max_duplicate_entry_values =
                    layout.max_duplicate_entry_values.max(max_entry_values);
            }
        }

        if let RowComparisonResult::Mismatch { differences, .. } = result {
            layout.max_difference_groups = layout.max_difference_groups.max(differences.len());
        }
    }

    // Always produce at least one key/value slot so even tiny exports remain clear.
    layout.max_key_columns = layout.max_key_columns.max(1);
    layout.max_file_a_value_columns = layout.max_file_a_value_columns.max(1);
    layout.max_file_b_value_columns = layout.max_file_b_value_columns.max(1);

    layout
}

fn build_header(layout: &ExportLayout) -> Vec<String> {
    let mut header = vec!["Result Type".to_string()];

    for i in 1..=layout.max_key_columns {
        header.push(format!("Key {i}"));
    }

    for i in 1..=layout.max_file_a_value_columns {
        header.push(format!("File A Value {i}"));
    }

    for i in 1..=layout.max_file_b_value_columns {
        header.push(format!("File B Value {i}"));
    }

    for i in 1..=layout.max_difference_groups {
        header.push(format!("Difference {i} File A Column"));
        header.push(format!("Difference {i} File B Column"));
        header.push(format!("Difference {i} File A Value"));
        header.push(format!("Difference {i} File B Value"));
    }

    for entry_idx in 1..=layout.max_duplicate_entries {
        for value_idx in 1..=layout.max_duplicate_entry_values {
            header.push(format!("Duplicate {entry_idx} Value {value_idx}"));
        }
    }

    header
}

fn append_padded_columns(record: &mut Vec<String>, values: &[String], target_len: usize) {
    for i in 0..target_len {
        record.push(values.get(i).cloned().unwrap_or_default());
    }
}

fn append_difference_columns(
    record: &mut Vec<String>,
    result: &RowComparisonResult,
    max_difference_groups: usize,
) {
    let differences = match result {
        RowComparisonResult::Mismatch { differences, .. } => differences.as_slice(),
        _ => &[],
    };

    for i in 0..max_difference_groups {
        if let Some(diff) = differences.get(i) {
            record.push(diff.column_a.clone());
            record.push(diff.column_b.clone());
            record.push(diff.value_a.clone());
            record.push(diff.value_b.clone());
        } else {
            record.push(String::new());
            record.push(String::new());
            record.push(String::new());
            record.push(String::new());
        }
    }
}

fn append_duplicate_columns(
    record: &mut Vec<String>,
    result: &RowComparisonResult,
    layout: &ExportLayout,
) {
    let values: &[Vec<String>] = match result {
        RowComparisonResult::Duplicate { values, .. } => values.as_slice(),
        _ => &[],
    };

    for entry_idx in 0..layout.max_duplicate_entries {
        for value_idx in 0..layout.max_duplicate_entry_values {
            let cell = values
                .get(entry_idx)
                .and_then(|entry| entry.get(value_idx))
                .cloned()
                .unwrap_or_default();
            record.push(cell);
        }
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
            record.push("Missing Left".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::MissingRight { key, values_a } => {
            record.push("Missing Right".to_string());
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
        RowComparisonResult::Duplicate { key, source, .. } => {
            let source_str = match source {
                DuplicateSource::FileA => "File A",
                DuplicateSource::FileB => "File B",
                DuplicateSource::Both => "Both Files",
            };

            record.push(format!("Duplicate ({source_str})"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
    }

    append_difference_columns(&mut record, result, layout.max_difference_groups);
    append_duplicate_columns(&mut record, result, layout);
    record
}

fn write_results_to_writer<W: Write>(
    results: &[RowComparisonResult],
    writer: W,
) -> Result<(), Box<dyn Error>> {
    let layout = compute_layout(results);
    let mut csv_writer = Writer::from_writer(writer);

    csv_writer.write_record(build_header(&layout))?;

    for result in results {
        csv_writer.write_record(build_record(result, &layout))?;
    }

    csv_writer.flush()?;
    Ok(())
}

/// Export comparison results to in-memory CSV bytes
pub fn export_results_to_bytes(results: &[RowComparisonResult]) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut buffer = Vec::new();
    write_results_to_writer(results, &mut buffer)?;
    Ok(buffer)
}

/// Export comparison results to a CSV file
pub fn export_results(
    results: &[RowComparisonResult],
    file_path: &str,
) -> Result<(), Box<dyn Error>> {
    let file = File::create(file_path)?;
    write_results_to_writer(results, BufWriter::new(file))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::types::ValueDifference;
    use csv::Reader;
    use tempfile::NamedTempFile;

    #[test]
    fn test_export_results() {
        let results = vec![
            RowComparisonResult::Match {
                key: vec!["1".to_string()],
                values_a: vec!["Alice".to_string()],
                values_b: vec!["Alice".to_string()],
            },
            RowComparisonResult::Mismatch {
                key: vec!["2".to_string()],
                values_a: vec!["Bob".to_string()],
                values_b: vec!["Robert".to_string()],
                differences: vec![],
            },
        ];

        let temp_file = NamedTempFile::new().unwrap();
        let path = temp_file.path().to_str().unwrap();

        export_results(&results, path).unwrap();

        // Verify file was created and has content
        let content = std::fs::read_to_string(path).unwrap();
        assert!(content.contains("Match"));
        assert!(content.contains("Mismatch"));
        assert!(content.contains("Key 1"));
        assert!(content.contains("File A Value 1"));
    }

    #[test]
    fn test_export_results_to_bytes_splits_columns_and_keeps_rectangular_rows() {
        let results = vec![
            RowComparisonResult::Match {
                key: vec!["1".to_string(), "A".to_string()],
                values_a: vec!["Alice".to_string(), "100".to_string()],
                values_b: vec!["Alice".to_string(), "100".to_string()],
            },
            RowComparisonResult::Mismatch {
                key: vec!["2".to_string()],
                values_a: vec!["Bob".to_string(), "200".to_string()],
                values_b: vec!["Robert".to_string(), "999".to_string()],
                differences: vec![
                    ValueDifference {
                        column_a: "name".to_string(),
                        column_b: "name".to_string(),
                        value_a: "Bob".to_string(),
                        value_b: "Robert".to_string(),
                    },
                    ValueDifference {
                        column_a: "amount".to_string(),
                        column_b: "amount".to_string(),
                        value_a: "200".to_string(),
                        value_b: "999".to_string(),
                    },
                ],
            },
            RowComparisonResult::Duplicate {
                key: vec!["3".to_string()],
                source: DuplicateSource::FileA,
                values: vec![
                    vec!["Carol".to_string(), "300".to_string()],
                    vec!["Carol".to_string(), "301".to_string()],
                ],
            },
        ];

        let bytes = export_results_to_bytes(&results).unwrap();
        let mut reader = Reader::from_reader(bytes.as_slice());

        let headers = reader.headers().unwrap().clone();
        let key_2_idx = headers.iter().position(|h| h == "Key 2").unwrap();
        let file_a_2_idx = headers.iter().position(|h| h == "File A Value 2").unwrap();
        let diff_2_value_b_idx = headers
            .iter()
            .position(|h| h == "Difference 2 File B Value")
            .unwrap();
        let duplicate_2_value_2_idx = headers
            .iter()
            .position(|h| h == "Duplicate 2 Value 2")
            .unwrap();

        let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();
        assert_eq!(records.len(), 3);
        for record in &records {
            assert_eq!(record.len(), headers.len());
        }

        assert_eq!(records[0].get(key_2_idx), Some("A"));
        assert_eq!(records[0].get(file_a_2_idx), Some("100"));

        assert_eq!(records[1].get(diff_2_value_b_idx), Some("999"));

        assert_eq!(records[2].get(duplicate_2_value_2_idx), Some("301"));
    }
}
