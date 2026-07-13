use super::types::{ComparisonConfig, DuplicateSource, RowComparisonResult};
use crate::backend::CsvAlignError;
use csv::Writer;
use serde_json::to_string;
use std::borrow::Cow;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

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

fn append_padded_columns<'a>(
    record: &mut Vec<Cow<'a, str>>,
    values: &'a [String],
    target_len: usize,
) {
    for i in 0..target_len {
        record.push(
            values
                .get(i)
                .map_or(Cow::Borrowed(""), |value| Cow::Borrowed(value.as_str())),
        );
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

fn build_record<'a>(result: &'a RowComparisonResult, layout: &ExportLayout) -> Vec<Cow<'a, str>> {
    let mut record = Vec::new();

    match result {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        } => {
            record.push(Cow::Borrowed("Match"));
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
            record.push(Cow::Borrowed("Mismatch"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::MissingLeft { key, values_b } => {
            record.push(Cow::Borrowed("Only in File B"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::MissingRight { key, values_a } => {
            record.push(Cow::Borrowed("Only in File A"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, values_a, layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
        RowComparisonResult::UnkeyedLeft { key, values_b } => {
            record.push(Cow::Borrowed("Ignored in File B"));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, values_b, layout.max_file_b_value_columns);
        }
        RowComparisonResult::UnkeyedRight { key, values_a } => {
            record.push(Cow::Borrowed("Ignored in File A"));
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

            record.push(Cow::Owned(format!("Duplicate ({source_str})")));
            append_padded_columns(&mut record, key, layout.max_key_columns);
            append_padded_columns(&mut record, &[], layout.max_file_a_value_columns);
            append_padded_columns(&mut record, &[], layout.max_file_b_value_columns);
        }
    }

    record.push(match result {
        RowComparisonResult::Mismatch { .. } => Cow::Owned(format_difference_summary(result)),
        _ => Cow::Borrowed(""),
    });
    match result {
        RowComparisonResult::Duplicate {
            values_a, values_b, ..
        } => {
            record.push(Cow::Owned(format_duplicate_side_rows(values_a)));
            record.push(Cow::Owned(format_duplicate_side_rows(values_b)));
        }
        _ => {
            record.push(Cow::Borrowed(""));
            record.push(Cow::Borrowed(""));
        }
    }
    record.push(match result {
        RowComparisonResult::Duplicate { .. } => Cow::Owned(format_duplicate_summary(result)),
        _ => Cow::Borrowed(""),
    });
    record
}

fn spreadsheet_safe_field(value: &str) -> Cow<'_, str> {
    let begins_with_control = value
        .as_bytes()
        .first()
        .is_some_and(|byte| matches!(*byte, b'\t' | b'\r' | b'\n'));
    let first_meaningful = value.chars().find(|character| !character.is_whitespace());
    let begins_with_formula = matches!(first_meaningful, Some('=' | '+' | '-' | '@'));

    if begins_with_control || begins_with_formula {
        let mut escaped = String::with_capacity(value.len().saturating_add(1));
        escaped.push('\'');
        escaped.push_str(value);
        Cow::Owned(escaped)
    } else {
        Cow::Borrowed(value)
    }
}

fn write_spreadsheet_safe_record<W: Write, S: AsRef<str>>(
    writer: &mut Writer<W>,
    record: &[S],
) -> Result<(), csv::Error> {
    let safe_fields = record
        .iter()
        .map(|field| spreadsheet_safe_field(field.as_ref()))
        .collect::<Vec<_>>();
    writer.write_record(safe_fields.iter().map(|field| field.as_bytes()))
}

fn csv_write_error(context: &str, error: csv::Error) -> CsvAlignError {
    let message = error.to_string();
    match error.into_kind() {
        csv::ErrorKind::Io(error) => CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("{context}: {error}"),
        )),
        _ => CsvAlignError::Internal(format!("{context}: {message}")),
    }
}

fn write_results_to_writer<W: Write>(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
    writer: W,
) -> Result<(), CsvAlignError> {
    let layout = compute_layout(results, config);
    let mut csv_writer = Writer::from_writer(writer);
    let header = build_header(&layout, config);

    write_spreadsheet_safe_record(&mut csv_writer, &header)
        .map_err(|error| csv_write_error("Failed to write CSV header", error))?;

    for result in results {
        let record = build_record(result, &layout);
        write_spreadsheet_safe_record(&mut csv_writer, &record)
            .map_err(|error| csv_write_error("Failed to write CSV record", error))?;
    }

    csv_writer.flush().map_err(|error| {
        CsvAlignError::Io(std::io::Error::new(
            error.kind(),
            format!("Failed to flush CSV export: {error}"),
        ))
    })?;
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

fn contextual_io_error(context: impl std::fmt::Display, error: std::io::Error) -> CsvAlignError {
    CsvAlignError::Io(std::io::Error::new(
        error.kind(),
        format!("{context}: {error}"),
    ))
}

fn resolve_atomic_destination(file_path: &Path) -> Result<PathBuf, CsvAlignError> {
    match fs::symlink_metadata(file_path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            fs::canonicalize(file_path).map_err(|error| {
                contextual_io_error("Failed to resolve CSV export destination", error)
            })
        }
        Ok(_) => Ok(file_path.to_path_buf()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(file_path.to_path_buf()),
        Err(error) => Err(contextual_io_error(
            "Failed to inspect CSV export destination",
            error,
        )),
    }
}

fn write_atomically_with_sync(
    file_path: &Path,
    write: impl FnOnce(&mut File) -> Result<(), CsvAlignError>,
    sync: impl FnOnce(&mut File) -> std::io::Result<()>,
) -> Result<(), CsvAlignError> {
    // Resolve an existing symlink once so publication replaces its target and
    // leaves the user-selected link intact. Atomic replacement creates a new
    // inode, so only portable permissions—not ACLs, xattrs, or hard links—are
    // preserved for an existing regular destination.
    let destination = resolve_atomic_destination(file_path)?;
    let existing_permissions = match fs::metadata(&destination) {
        Ok(metadata) if metadata.is_file() => Some(metadata.permissions()),
        Ok(_) => None,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return Err(contextual_io_error(
                "Failed to inspect existing CSV export permissions",
                error,
            ));
        }
    };
    let parent = destination
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temporary = tempfile::Builder::new()
        .prefix(".csv-align-export-")
        .tempfile_in(parent)
        .map_err(|error| {
            contextual_io_error(
                format!(
                    "Failed to create temporary CSV export for {}",
                    destination.display()
                ),
                error,
            )
        })?;

    write(temporary.as_file_mut())?;

    if let Some(permissions) = existing_permissions {
        temporary
            .as_file_mut()
            .set_permissions(permissions)
            .map_err(|error| {
                contextual_io_error("Failed to preserve CSV export permissions", error)
            })?;
    }

    sync(temporary.as_file_mut()).map_err(|error| {
        contextual_io_error(
            format!(
                "Failed to synchronize CSV export for {}",
                destination.display()
            ),
            error,
        )
    })?;
    temporary.persist(&destination).map_err(|error| {
        contextual_io_error(
            format!("Failed to publish CSV export to {}", destination.display()),
            error.error,
        )
    })?;
    Ok(())
}

fn write_atomically(
    file_path: &Path,
    write: impl FnOnce(&mut File) -> Result<(), CsvAlignError>,
) -> Result<(), CsvAlignError> {
    write_atomically_with_sync(file_path, write, |file| file.sync_all())
}

/// Export comparison results to a CSV file with optional config-aware labels.
pub fn write_export_results(
    results: &[RowComparisonResult],
    config: Option<&ComparisonConfig>,
    file_path: impl AsRef<Path>,
) -> Result<(), CsvAlignError> {
    write_atomically(file_path.as_ref(), |file| {
        write_results_to_writer(results, config, BufWriter::new(file))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FailAfter {
        remaining: usize,
    }

    impl Write for FailAfter {
        fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
            if self.remaining == 0 {
                return Err(std::io::Error::other("injected write failure"));
            }

            let written = self.remaining.min(buffer.len());
            self.remaining -= written;
            Ok(written)
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn mid_stream_writer_failures_remain_typed_io_errors() {
        let results = vec![RowComparisonResult::Match {
            key: vec!["1".to_string()],
            values_a: vec!["x".repeat(20_000)],
            values_b: vec!["x".repeat(20_000)],
        }];

        let error = write_results_to_writer(&results, None, FailAfter { remaining: 128 })
            .expect_err("the injected writer should fail during record output");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(error.to_string().contains("Failed to write CSV record"));
        assert!(error.to_string().contains("injected write failure"));
    }

    #[test]
    fn atomic_write_failure_preserves_an_existing_destination() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();

        let error = write_atomically(&destination, |file| {
            file.write_all(b"partial replacement")?;
            Err(CsvAlignError::Io(std::io::Error::other(
                "injected export failure",
            )))
        })
        .expect_err("the injected export should fail before publication");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert_eq!(std::fs::read(&destination).unwrap(), b"original export");
    }

    #[test]
    fn atomic_write_create_failures_include_stage_context() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("missing").join("results.csv");

        let error = write_atomically(&destination, |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .expect_err("a missing destination directory should reject the export");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(
            error
                .to_string()
                .contains("Failed to create temporary CSV export")
        );
    }

    #[test]
    fn atomic_write_sync_failures_include_context_and_preserve_destination() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();

        let error = write_atomically_with_sync(
            &destination,
            |file| {
                file.write_all(b"replacement")?;
                Ok(())
            },
            |_| Err(std::io::Error::other("injected sync failure")),
        )
        .expect_err("the injected synchronization should fail");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(
            error
                .to_string()
                .contains("Failed to synchronize CSV export")
        );
        assert!(error.to_string().contains("injected sync failure"));
        assert_eq!(std::fs::read(&destination).unwrap(), b"original export");
    }

    #[test]
    fn atomic_write_publish_failures_include_stage_context() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("existing-directory");
        std::fs::create_dir(&destination).unwrap();

        let error = write_atomically(&destination, |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .expect_err("a directory cannot be replaced by the CSV export");

        assert!(matches!(error, CsvAlignError::Io(_)));
        assert!(error.to_string().contains("Failed to publish CSV export"));
    }

    #[cfg(unix)]
    #[test]
    fn atomic_replacement_preserves_existing_unix_permissions() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("results.csv");
        std::fs::write(&destination, b"original export").unwrap();
        std::fs::set_permissions(&destination, std::fs::Permissions::from_mode(0o644)).unwrap();

        write_atomically(&destination, |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .unwrap();

        assert_eq!(std::fs::read(&destination).unwrap(), b"replacement");
        assert_eq!(
            std::fs::metadata(&destination).unwrap().mode() & 0o777,
            0o644
        );
    }

    #[cfg(unix)]
    #[test]
    fn atomic_replacement_preserves_symlink_and_read_only_target() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt, symlink};

        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.csv");
        let destination = directory.path().join("results.csv");
        std::fs::write(&target, b"original export").unwrap();
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o444)).unwrap();
        symlink(&target, &destination).unwrap();

        write_atomically(&destination, |file| {
            file.write_all(b"replacement")?;
            Ok(())
        })
        .unwrap();

        assert!(
            std::fs::symlink_metadata(&destination)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(std::fs::read(&target).unwrap(), b"replacement");
        assert_eq!(std::fs::metadata(&target).unwrap().mode() & 0o777, 0o444);
    }
}
