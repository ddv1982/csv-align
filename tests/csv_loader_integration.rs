use csv_align::backend::limits::{MAX_CSV_COLUMNS, MAX_CSV_ROWS};
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
fn load_csv_from_bytes_ignores_quoted_delimiters_when_detecting_delimiter() {
    let csv_data = load_csv_from_bytes(
        b"name;description;city\nAlice;\"likes commas, a lot\";Paris\nBob;\"uses; semicolons\";Lyon\n",
    )
    .unwrap();

    assert_eq!(csv_data.headers, vec!["name", "description", "city"]);
    assert_eq!(
        csv_data.rows[0],
        vec!["Alice", "likes commas, a lot", "Paris"]
    );
    assert_eq!(csv_data.rows[1], vec!["Bob", "uses; semicolons", "Lyon"]);
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
fn load_csv_from_bytes_rejects_rows_with_missing_columns() {
    let error =
        load_csv_from_bytes(b"id,name,city\n1,Alice,Paris\n2,Bob\n").expect_err("should fail");

    assert_eq!(error.to_string(), "Row 3 has 2 columns, expected 3 columns");
}

#[test]
fn load_csv_from_bytes_rejects_duplicate_headers() {
    let error = load_csv_from_bytes(b"id,name,name\n1,Alice,Alicia\n")
        .expect_err("duplicate headers should fail");

    assert_eq!(
        error.to_string(),
        "Duplicate CSV headers are not supported: name"
    );
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

#[test]
fn csv_column_limit_accepts_the_boundary_and_rejects_one_more() {
    let at_limit = (0..MAX_CSV_COLUMNS)
        .map(|index| format!("column_{index}"))
        .collect::<Vec<_>>()
        .join(",");
    let csv = load_csv_from_bytes(at_limit.as_bytes()).expect("column boundary should pass");
    assert_eq!(csv.headers.len(), MAX_CSV_COLUMNS);

    let over_limit = format!("{at_limit},one_more");
    let error =
        load_csv_from_bytes(over_limit.as_bytes()).expect_err("column limit plus one should fail");
    assert!(error.to_string().contains("CSV columns limit exceeded"));
    assert!(error.to_string().contains(&MAX_CSV_COLUMNS.to_string()));
}

#[test]
fn csv_row_limit_accepts_the_boundary_and_rejects_one_more() {
    let mut contents = String::with_capacity(MAX_CSV_ROWS * 2 + 3);
    contents.push_str("id\n");
    for _ in 0..MAX_CSV_ROWS {
        contents.push_str("1\n");
    }

    let csv = load_csv_from_bytes(contents.as_bytes()).expect("row boundary should pass");
    assert_eq!(csv.rows.len(), MAX_CSV_ROWS);

    contents.push_str("1\n");
    let error =
        load_csv_from_bytes(contents.as_bytes()).expect_err("row limit plus one should fail");
    assert!(error.to_string().contains("CSV rows limit exceeded"));
    assert!(error.to_string().contains(&MAX_CSV_ROWS.to_string()));
}
