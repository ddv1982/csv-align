use super::types::{ColumnDataType, ColumnInfo, CsvData};
use csv::ReaderBuilder;
use encoding_rs_io::DecodeReaderBytesBuilder;
use std::error::Error;
use std::fs::File;
use std::io::{Cursor, Read};

/// Load a CSV file and return structured data
pub fn load_csv(file_path: &str) -> Result<CsvData, Box<dyn Error>> {
    let file = File::open(file_path)?;
    let csv_data = decode_csv_text(file)?;
    let mut csv_data = parse_csv_text(&csv_data)?;
    csv_data.file_path = Some(file_path.to_string());

    Ok(csv_data)
}

/// Load CSV from bytes (for web uploads)
pub fn load_csv_from_bytes(bytes: &[u8]) -> Result<CsvData, Box<dyn Error>> {
    let csv_data = decode_csv_text(Cursor::new(bytes))?;
    parse_csv_text(&csv_data)
}

fn decode_csv_text<R: Read>(reader: R) -> Result<String, Box<dyn Error>> {
    let mut decoder = DecodeReaderBytesBuilder::new().encoding(None).build(reader);
    let mut csv_data = String::new();
    decoder.read_to_string(&mut csv_data)?;
    Ok(csv_data)
}

fn parse_csv_text(csv_data: &str) -> Result<CsvData, Box<dyn Error>> {
    let delimiter = detect_delimiter(csv_data);
    let mut reader = ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .from_reader(Cursor::new(csv_data.as_bytes()));

    let headers: Vec<String> = reader.headers()?.iter().map(|h| h.to_string()).collect();

    let mut rows = Vec::new();
    for result in reader.records() {
        let record = result?;
        let row: Vec<String> = record.iter().map(|field| field.to_string()).collect();
        rows.push(row);
    }

    Ok(CsvData {
        file_path: None,
        headers,
        rows,
    })
}

fn detect_delimiter(csv_data: &str) -> u8 {
    let first_row = csv_data
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");

    let comma_count = first_row.matches(',').count();
    let semicolon_count = first_row.matches(';').count();

    if semicolon_count > comma_count {
        b';'
    } else {
        b','
    }
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
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_load_csv() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "name,age,city").unwrap();
        writeln!(temp_file, "Alice,30,New York").unwrap();
        writeln!(temp_file, "Bob,25,San Francisco").unwrap();

        let csv_data = load_csv(temp_file.path().to_str().unwrap()).unwrap();

        assert_eq!(csv_data.headers, vec!["name", "age", "city"]);
        assert_eq!(csv_data.rows.len(), 2);
        assert_eq!(csv_data.rows[0], vec!["Alice", "30", "New York"]);
    }

    #[test]
    fn test_load_csv_from_bytes_semicolon_delimited() {
        let csv_data =
            load_csv_from_bytes(b"name;age;city\nAlice;30;New York\nBob;25;Paris\n").unwrap();

        assert_eq!(csv_data.headers, vec!["name", "age", "city"]);
        assert_eq!(csv_data.rows.len(), 2);
        assert_eq!(csv_data.rows[1], vec!["Bob", "25", "Paris"]);
    }

    #[test]
    fn test_load_csv_from_bytes_utf16_bom() {
        let utf16_bytes = vec![
            0xFF, 0xFE, 0x6E, 0x00, 0x61, 0x00, 0x6D, 0x00, 0x65, 0x00, 0x3B, 0x00, 0x61, 0x00,
            0x67, 0x00, 0x65, 0x00, 0x0A, 0x00, 0x41, 0x00, 0x6C, 0x00, 0x69, 0x00, 0x63, 0x00,
            0x65, 0x00, 0x3B, 0x00, 0x33, 0x00, 0x30, 0x00, 0x0A, 0x00,
        ];

        let csv_data = load_csv_from_bytes(&utf16_bytes).unwrap();

        assert_eq!(csv_data.headers, vec!["name", "age"]);
        assert_eq!(
            csv_data.rows,
            vec![vec!["Alice".to_string(), "30".to_string()]]
        );
    }

    #[test]
    fn test_detect_columns() {
        let csv_data = CsvData {
            file_path: None,
            headers: vec!["name".to_string(), "age".to_string(), "salary".to_string()],
            rows: vec![
                vec![
                    "Alice".to_string(),
                    "30".to_string(),
                    "50000.50".to_string(),
                ],
                vec!["Bob".to_string(), "25".to_string(), "45000.00".to_string()],
            ],
        };

        let columns = detect_columns(&csv_data);

        assert_eq!(columns.len(), 3);
        assert_eq!(columns[0].data_type, ColumnDataType::String);
        assert_eq!(columns[1].data_type, ColumnDataType::Integer);
        assert_eq!(columns[2].data_type, ColumnDataType::Float);
    }
}
