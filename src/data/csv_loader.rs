use super::types::{ColumnCatalog, ColumnDataType, ColumnInfo, CsvData};
use crate::backend::limits::{
    MAX_CSV_CELLS, MAX_CSV_COLUMNS, MAX_CSV_ROWS, MAX_DECODED_CSV_BYTES, MAX_RAW_CSV_BYTES,
    MAX_RETAINED_CSV_BYTES,
};
use crate::data::json_fields::discover_virtual_headers;
use csv::ReaderBuilder;
use encoding_rs_io::DecodeReaderBytesBuilder;
use std::collections::HashSet;
use std::error::Error;
use std::fmt;
use std::fs::File;
use std::io::{Cursor, Read};
use std::mem::size_of;

/// Load a CSV file and return structured data
pub fn load_csv(file_path: &str) -> Result<CsvData, Box<dyn Error>> {
    let raw_bytes = std::fs::metadata(file_path)?.len() as usize;
    ensure_limit("raw CSV bytes", raw_bytes, MAX_RAW_CSV_BYTES)?;

    let file = File::open(file_path)?;
    let bytes = read_raw_csv_bytes_with_limit(file, MAX_RAW_CSV_BYTES)?;

    let mut csv_data = load_csv_from_bytes(&bytes)?;
    csv_data.file_path = Some(file_path.to_string());
    ensure_retained_csv_limit(&csv_data)?;

    Ok(csv_data)
}

/// Load CSV from raw file bytes provided by the app
pub fn load_csv_from_bytes(bytes: &[u8]) -> Result<CsvData, Box<dyn Error>> {
    ensure_limit("raw CSV bytes", bytes.len(), MAX_RAW_CSV_BYTES)?;
    let csv_text = decode_csv_text(Cursor::new(bytes))?;
    parse_csv_text(&csv_text)
}

fn read_raw_csv_bytes_with_limit<R: Read>(
    reader: R,
    limit: usize,
) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut bytes = Vec::new();
    reader
        .take((limit as u64).saturating_add(1))
        .read_to_end(&mut bytes)?;
    ensure_limit("raw CSV bytes", bytes.len(), limit)?;
    Ok(bytes)
}

fn decode_csv_text<R: Read>(reader: R) -> Result<String, Box<dyn Error>> {
    decode_csv_text_with_limit(reader, MAX_DECODED_CSV_BYTES)
}

fn decode_csv_text_with_limit<R: Read>(reader: R, limit: usize) -> Result<String, Box<dyn Error>> {
    let decoder = DecodeReaderBytesBuilder::new().encoding(None).build(reader);
    let mut decoded = Vec::new();
    decoder
        .take((limit as u64).saturating_add(1))
        .read_to_end(&mut decoded)?;
    ensure_limit("decoded CSV bytes", decoded.len(), limit)?;

    String::from_utf8(decoded).map_err(|error| Box::new(error) as Box<dyn Error>)
}

fn parse_csv_text(csv_data: &str) -> Result<CsvData, Box<dyn Error>> {
    let csv_data = csv_data.trim_start_matches('\u{feff}');
    let delimiter = detect_delimiter(csv_data);
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .flexible(false)
        .from_reader(Cursor::new(csv_data.as_bytes()));

    let headers: Vec<String> = reader.headers()?.iter().map(|h| h.to_string()).collect();
    ensure_limit("CSV columns", headers.len(), MAX_CSV_COLUMNS)?;
    validate_unique_headers(&headers)?;

    let mut parsed = CsvData {
        file_path: None,
        headers,
        rows: Vec::new(),
    };
    let mut retained_csv_bytes = parsed.retained_size_bytes();
    ensure_limit(
        "retained CSV allocation bytes",
        retained_csv_bytes,
        MAX_RETAINED_CSV_BYTES,
    )?;
    let mut cell_count = 0usize;
    for result in reader.records() {
        let record = result.map_err(|error| {
            if let csv::ErrorKind::UnequalLengths {
                expected_len,
                len,
                pos,
            } = error.kind()
            {
                Box::new(MalformedRowError {
                    row_number: pos
                        .as_ref()
                        .map(|position| position.line())
                        .unwrap_or((parsed.rows.len() + 2) as u64),
                    actual_columns: *len,
                    expected_columns: *expected_len,
                }) as Box<dyn Error>
            } else {
                Box::new(error) as Box<dyn Error>
            }
        })?;
        ensure_limit(
            "CSV rows",
            parsed.rows.len().saturating_add(1),
            MAX_CSV_ROWS,
        )?;
        cell_count = cell_count.saturating_add(record.len());
        ensure_limit("CSV cells", cell_count, MAX_CSV_CELLS)?;

        let row: Vec<String> = record.iter().map(|field| field.to_string()).collect();
        let row_allocation = retained_row_allocation_bytes(&row, row.capacity());
        let previous_rows_capacity = parsed.rows.capacity();
        let required_rows = parsed.rows.len().saturating_add(1);
        let minimum_growth = if required_rows > previous_rows_capacity {
            size_of::<Vec<String>>()
        } else {
            0
        };
        ensure_limit(
            "retained CSV allocation bytes",
            retained_csv_bytes
                .saturating_add(row_allocation)
                .saturating_add(minimum_growth),
            MAX_RETAINED_CSV_BYTES,
        )?;

        if required_rows > previous_rows_capacity {
            let retained_before_growth = retained_csv_bytes.saturating_add(row_allocation);
            let remaining_bytes = MAX_RETAINED_CSV_BYTES.saturating_sub(retained_before_growth);
            let additional_capacity = remaining_bytes / size_of::<Vec<String>>();
            let maximum_capacity = previous_rows_capacity.saturating_add(additional_capacity);
            let target_capacity = previous_rows_capacity
                .saturating_mul(2)
                .max(required_rows)
                .min(maximum_capacity);

            if target_capacity < required_rows
                || parsed
                    .rows
                    .try_reserve_exact(target_capacity.saturating_sub(parsed.rows.len()))
                    .is_err()
            {
                return Err(Box::new(ResourceLimitError {
                    name: "retained CSV allocation bytes",
                    actual: MAX_RETAINED_CSV_BYTES.saturating_add(1),
                    limit: MAX_RETAINED_CSV_BYTES,
                }));
            }
        }

        let rows_capacity_growth = parsed
            .rows
            .capacity()
            .saturating_sub(previous_rows_capacity)
            .saturating_mul(size_of::<Vec<String>>());
        retained_csv_bytes = retained_csv_bytes
            .saturating_add(row_allocation)
            .saturating_add(rows_capacity_growth);
        ensure_limit(
            "retained CSV allocation bytes",
            retained_csv_bytes,
            MAX_RETAINED_CSV_BYTES,
        )?;
        parsed.rows.push(row);
    }

    Ok(parsed)
}

/// Detect both physical column types and bounded virtual JSON labels once.
pub fn detect_column_catalog(csv_data: &CsvData) -> Result<ColumnCatalog, Box<dyn Error>> {
    validate_csv_data_limits(csv_data)?;
    let virtual_headers =
        discover_virtual_headers(csv_data).map_err(|error| Box::new(error) as Box<dyn Error>)?;
    Ok(ColumnCatalog::new(
        detect_columns(csv_data),
        virtual_headers,
    ))
}

fn retained_row_allocation_bytes(row: &[String], capacity: usize) -> usize {
    row.iter().fold(
        capacity.saturating_mul(size_of::<String>()),
        |total, value| total.saturating_add(value.capacity()),
    )
}

fn validate_csv_data_limits(csv_data: &CsvData) -> Result<(), Box<dyn Error>> {
    ensure_limit("CSV columns", csv_data.headers.len(), MAX_CSV_COLUMNS)?;
    ensure_limit("CSV rows", csv_data.rows.len(), MAX_CSV_ROWS)?;
    let cells = csv_data
        .rows
        .iter()
        .fold(0usize, |total, row| total.saturating_add(row.len()));
    ensure_limit("CSV cells", cells, MAX_CSV_CELLS)?;
    ensure_retained_csv_limit(csv_data)
}

fn ensure_retained_csv_limit(csv_data: &CsvData) -> Result<(), Box<dyn Error>> {
    ensure_limit(
        "retained CSV allocation bytes",
        csv_data.retained_size_bytes(),
        MAX_RETAINED_CSV_BYTES,
    )
}

fn ensure_limit(name: &'static str, actual: usize, limit: usize) -> Result<(), Box<dyn Error>> {
    if actual > limit {
        tracing::warn!(limit_name = name, actual, limit, "resource limit exceeded");
        return Err(Box::new(ResourceLimitError {
            name,
            actual,
            limit,
        }));
    }

    Ok(())
}

#[derive(Debug)]
struct ResourceLimitError {
    name: &'static str,
    actual: usize,
    limit: usize,
}

impl fmt::Display for ResourceLimitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} limit exceeded: retained/observed {}, maximum {}",
            self.name, self.actual, self.limit
        )
    }
}

impl Error for ResourceLimitError {}

#[derive(Debug)]
struct MalformedRowError {
    row_number: u64,
    actual_columns: u64,
    expected_columns: u64,
}

impl fmt::Display for MalformedRowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Row {} has {} columns, expected {} columns",
            self.row_number, self.actual_columns, self.expected_columns
        )
    }
}

impl Error for MalformedRowError {}

fn validate_unique_headers(headers: &[String]) -> Result<(), Box<dyn Error>> {
    let mut seen = HashSet::new();
    let mut duplicates = Vec::new();

    for header in headers {
        if !seen.insert(header.as_str()) && !duplicates.iter().any(|duplicate| duplicate == header)
        {
            duplicates.push(header.clone());
        }
    }

    if duplicates.is_empty() {
        Ok(())
    } else {
        Err(Box::new(DuplicateHeaderError {
            headers: duplicates,
        }))
    }
}

#[derive(Debug)]
struct DuplicateHeaderError {
    headers: Vec<String>,
}

impl fmt::Display for DuplicateHeaderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Duplicate CSV headers are not supported: {}",
            self.headers.join(", ")
        )
    }
}

impl Error for DuplicateHeaderError {}

fn detect_delimiter(csv_data: &str) -> u8 {
    let first_row = csv_data
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");

    let comma_count = count_unquoted_delimiters(first_row, ',');
    let semicolon_count = count_unquoted_delimiters(first_row, ';');

    if semicolon_count > comma_count {
        b';'
    } else {
        b','
    }
}

fn count_unquoted_delimiters(row: &str, delimiter: char) -> usize {
    let mut count = 0;
    let mut in_quotes = false;
    let mut chars = row.chars().peekable();

    while let Some(character) = chars.next() {
        if character == '"' {
            if in_quotes && chars.peek() == Some(&'"') {
                chars.next();
            } else {
                in_quotes = !in_quotes;
            }
        } else if character == delimiter && !in_quotes {
            count += 1;
        }
    }

    count
}

/// Detect column information from CSV data
pub fn detect_columns(csv_data: &CsvData) -> Vec<ColumnInfo> {
    csv_data
        .headers
        .iter()
        .enumerate()
        .map(|(index, name)| {
            let data_type = detect_column_type(csv_data, index);
            ColumnInfo {
                index,
                name: name.clone(),
                data_type,
            }
        })
        .collect()
}

/// Detect the data type of a column based on its values
fn detect_column_type(csv_data: &CsvData, column_index: usize) -> ColumnDataType {
    let mut int_count = 0;
    let mut float_count = 0;
    let mut date_count = 0;
    let mut total_count = 0;

    for row in &csv_data.rows {
        if column_index < row.len() {
            let value = &row[column_index];
            if value.is_empty() {
                continue;
            }

            total_count += 1;

            if value.parse::<i64>().is_ok() {
                int_count += 1;
            } else if value.parse::<f64>().is_ok() {
                float_count += 1;
            } else if is_date_like(value) {
                date_count += 1;
            }
        }
    }

    if total_count == 0 {
        return ColumnDataType::String;
    }

    let threshold = 0.8; // 80% of values should match the type

    if (int_count as f64 / total_count as f64) >= threshold {
        ColumnDataType::Integer
    } else if ((int_count + float_count) as f64 / total_count as f64) >= threshold {
        ColumnDataType::Float
    } else if (date_count as f64 / total_count as f64) >= threshold {
        ColumnDataType::Date
    } else {
        ColumnDataType::String
    }
}

/// Check if a string looks like a date
fn is_date_like(value: &str) -> bool {
    // Simple date detection - could be enhanced
    let value = value.trim();

    // Check for common date patterns
    if value.len() >= 8 && value.len() <= 10 && (value.contains('-') || value.contains('/')) {
        let parts: Vec<&str> = if value.contains('-') {
            value.split('-').collect()
        } else {
            value.split('/').collect()
        };

        if parts.len() == 3 {
            // Check if all parts are numeric
            if parts.iter().all(|p| p.parse::<u32>().is_ok()) {
                return true;
            }
        }
    }

    false
}

#[cfg(test)]
mod resource_limit_tests {
    use super::*;

    #[test]
    fn actual_raw_read_accepts_exact_bytes_and_rejects_one_more() {
        assert_eq!(
            read_raw_csv_bytes_with_limit(Cursor::new(b"abcd"), 4).unwrap(),
            b"abcd"
        );
        let error = read_raw_csv_bytes_with_limit(Cursor::new(b"abcde"), 4).unwrap_err();
        assert!(error.to_string().contains("raw CSV bytes limit exceeded"));
    }

    #[test]
    fn decoded_read_accepts_exact_bytes_and_rejects_one_more() {
        assert_eq!(
            decode_csv_text_with_limit(Cursor::new(b"abcd"), 4).unwrap(),
            "abcd"
        );
        let error = decode_csv_text_with_limit(Cursor::new(b"abcde"), 4).unwrap_err();
        assert!(
            error
                .to_string()
                .contains("decoded CSV bytes limit exceeded")
        );
    }
}
