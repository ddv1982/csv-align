use csv_align::data::csv_loader::{detect_columns, load_csv, load_csv_from_bytes};
use csv_align::data::types::{ColumnDataType, CsvData};
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
fn load_csv_from_file_path() {
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
fn load_csv_from_bytes_semicolon_delimited() {
    let csv_data =
        load_csv_from_bytes(b"name;age;city\nAlice;30;New York\nBob;25;Paris\n").unwrap();

    assert_eq!(csv_data.headers, vec!["name", "age", "city"]);
    assert_eq!(csv_data.rows.len(), 2);
    assert_eq!(csv_data.rows[1], vec!["Bob", "25", "Paris"]);
}

#[test]
fn load_csv_from_bytes_utf16_bom() {
    let utf16_bytes = vec![
        0xFF, 0xFE, 0x6E, 0x00, 0x61, 0x00, 0x6D, 0x00, 0x65, 0x00, 0x3B, 0x00, 0x61, 0x00, 0x67,
        0x00, 0x65, 0x00, 0x0A, 0x00, 0x41, 0x00, 0x6C, 0x00, 0x69, 0x00, 0x63, 0x00, 0x65, 0x00,
        0x3B, 0x00, 0x33, 0x00, 0x30, 0x00, 0x0A, 0x00,
    ];

    let csv_data = load_csv_from_bytes(&utf16_bytes).unwrap();

    assert_eq!(csv_data.headers, vec!["name", "age"]);
    assert_eq!(
        csv_data.rows,
        vec![vec!["Alice".to_string(), "30".to_string()]]
    );
}

#[test]
fn load_csv_from_bytes_utf8_bom_is_trimmed() {
    let csv_data = load_csv_from_bytes(b"\xEF\xBB\xBFid,name\n1,Alice\n").unwrap();

    assert_eq!(csv_data.headers, vec!["id", "name"]);
    assert_eq!(
        csv_data.rows,
        vec![vec!["1".to_string(), "Alice".to_string()]]
    );
}

#[test]
fn load_csv_from_bytes_with_uneven_rows() {
    let csv_data = load_csv_from_bytes(b"id,name,city\n1,Alice,Paris\n2,Bob\n").unwrap();

    assert_eq!(csv_data.headers, vec!["id", "name", "city"]);
    assert_eq!(csv_data.rows.len(), 2);
    assert_eq!(csv_data.rows[0], vec!["1", "Alice", "Paris"]);
    assert_eq!(csv_data.rows[1], vec!["2", "Bob"]);
}

#[test]
fn detect_columns_infers_common_types() {
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
