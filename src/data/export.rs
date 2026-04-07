use super::types::RowComparisonResult;
use csv::Writer;
use std::error::Error;
use std::fs::File;
use std::io::BufWriter;

/// Export comparison results to a CSV file
pub fn export_results(
    results: &[RowComparisonResult],
    file_path: &str,
) -> Result<(), Box<dyn Error>> {
    let file = File::create(file_path)?;
    let mut writer = Writer::from_writer(BufWriter::new(file));

    // Write header
    writer.write_record([
        "Result Type",
        "Key",
        "File A Values",
        "File B Values",
        "Differences",
    ])?;

    for result in results {
        match result {
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } => {
                writer.write_record([
                    "Match",
                    &key.join(";"),
                    &values_a.join(";"),
                    &values_b.join(";"),
                    "",
                ])?;
            }
            RowComparisonResult::Mismatch {
                key,
                values_a,
                values_b,
                differences,
            } => {
                let diff_str: Vec<String> = differences
                    .iter()
                    .map(|d| format!("{}: {} vs {}", d.column_a, d.value_a, d.value_b))
                    .collect();
                writer.write_record([
                    "Mismatch",
                    &key.join(";"),
                    &values_a.join(";"),
                    &values_b.join(";"),
                    &diff_str.join("; "),
                ])?;
            }
            RowComparisonResult::MissingLeft { key, values_b } => {
                writer.write_record([
                    "Missing Left",
                    &key.join(";"),
                    "",
                    &values_b.join(";"),
                    "",
                ])?;
            }
            RowComparisonResult::MissingRight { key, values_a } => {
                writer.write_record([
                    "Missing Right",
                    &key.join(";"),
                    &values_a.join(";"),
                    "",
                    "",
                ])?;
            }
            RowComparisonResult::Duplicate {
                key,
                source,
                values,
            } => {
                let source_str = match source {
                    super::types::DuplicateSource::FileA => "File A",
                    super::types::DuplicateSource::FileB => "File B",
                    super::types::DuplicateSource::Both => "Both Files",
                };
                let values_str: Vec<String> = values.iter().map(|v| v.join(",")).collect();
                writer.write_record([
                    &format!("Duplicate ({source_str})"),
                    &key.join(";"),
                    &values_str.join(" | "),
                    "",
                    "",
                ])?;
            }
        }
    }

    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
    }
}
