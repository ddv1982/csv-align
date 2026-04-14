use csv::Reader;
use csv_align::data::{
    export::{
        export_results, export_results_to_bytes, export_results_to_bytes_with_config,
        export_results_with_config,
    },
    types::{
        ComparisonConfig, ComparisonNormalizationConfig, RowComparisonResult, ValueDifference,
    },
};
use tempfile::NamedTempFile;

#[test]
fn test_export_results() {
    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["record_id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["display_name".to_string()],
        column_mappings: Vec::new(),
        normalization: ComparisonNormalizationConfig::default(),
    };
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
    let path = temp_file.path();

    export_results_with_config(&results, Some(&config), path).unwrap();

    let content = std::fs::read_to_string(path).unwrap();
    assert!(content.contains("Match"));
    assert!(content.contains("Mismatch"));
    assert!(content.contains("Key: id / record_id"));
    assert!(content.contains("File A: name"));
    assert!(content.contains("File B: display_name"));
}

#[test]
fn test_export_results_public_api_remains_backward_compatible() {
    let results = vec![RowComparisonResult::Match {
        key: vec!["1".to_string()],
        values_a: vec!["Alice".to_string()],
        values_b: vec!["Alice".to_string()],
    }];

    let bytes = export_results_to_bytes(&results).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());
    let headers = reader.headers().unwrap().clone();
    assert_eq!(
        headers.iter().collect::<Vec<_>>(),
        vec![
            "Result",
            "Key 1",
            "File A Value 1",
            "File B Value 1",
            "Difference Summary",
            "Duplicate Rows File A",
            "Duplicate Rows File B",
            "Duplicate Summary",
        ]
    );

    let temp_file = NamedTempFile::new().unwrap();
    export_results(&results, temp_file.path()).unwrap();
    let content = std::fs::read_to_string(temp_file.path()).unwrap();
    assert!(content.contains("File A Value 1"));
}

#[test]
fn test_export_results_to_bytes_uses_selected_column_labels_and_summary_columns() {
    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string(), "region".to_string()],
        key_columns_b: vec!["identifier".to_string(), "region".to_string()],
        comparison_columns_a: vec!["name".to_string(), "amount".to_string()],
        comparison_columns_b: vec!["full_name".to_string(), "total".to_string()],
        column_mappings: Vec::new(),
        normalization: ComparisonNormalizationConfig::default(),
    };
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
                    column_b: "full_name".to_string(),
                    value_a: "Bob".to_string(),
                    value_b: "Robert".to_string(),
                },
                ValueDifference {
                    column_a: "amount".to_string(),
                    column_b: "total".to_string(),
                    value_a: "200".to_string(),
                    value_b: "999".to_string(),
                },
            ],
        },
        RowComparisonResult::Duplicate {
            key: vec!["3".to_string()],
            values_a: vec![
                vec!["Carol".to_string(), "300".to_string()],
                vec!["Carol".to_string(), "301".to_string()],
            ],
            values_b: Vec::new(),
        },
    ];

    let bytes = export_results_to_bytes_with_config(&results, Some(&config)).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());

    let headers = reader.headers().unwrap().clone();
    let key_2_idx = headers.iter().position(|h| h == "Key: region").unwrap();
    let file_a_2_idx = headers.iter().position(|h| h == "File A: amount").unwrap();
    let difference_summary_idx = headers
        .iter()
        .position(|h| h == "Difference Summary")
        .unwrap();
    let duplicate_summary_idx = headers
        .iter()
        .position(|h| h == "Duplicate Summary")
        .unwrap();
    let duplicate_file_a_idx = headers
        .iter()
        .position(|h| h == "Duplicate Rows File A")
        .unwrap();
    let duplicate_file_b_idx = headers
        .iter()
        .position(|h| h == "Duplicate Rows File B")
        .unwrap();

    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();
    assert_eq!(records.len(), 3);
    for record in &records {
        assert_eq!(record.len(), headers.len());
    }

    assert_eq!(records[0].get(key_2_idx), Some("A"));
    assert_eq!(records[0].get(file_a_2_idx), Some("100"));

    assert_eq!(
        records[1].get(difference_summary_idx),
        Some("name -> full_name: Bob -> Robert; amount -> total: 200 -> 999")
    );

    assert_eq!(
        records[2].get(duplicate_summary_idx),
        Some("File A: [Carol, 300] | [Carol, 301]")
    );
    assert_eq!(
        records[2].get(duplicate_file_a_idx),
        Some("[[\"Carol\",\"300\"],[\"Carol\",\"301\"]]")
    );
    assert_eq!(records[2].get(duplicate_file_b_idx), Some(""));
}

#[test]
fn test_export_results_to_bytes_duplicate_rows_do_not_widen_file_columns() {
    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["record_id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["display_name".to_string()],
        column_mappings: Vec::new(),
        normalization: ComparisonNormalizationConfig::default(),
    };
    let results = vec![RowComparisonResult::Duplicate {
        key: vec!["3".to_string()],
        values_a: vec![
            vec!["Carol".to_string(), "300".to_string(), "east".to_string()],
            vec!["Carol".to_string(), "301".to_string(), "west".to_string()],
        ],
        values_b: Vec::new(),
    }];

    let bytes = export_results_to_bytes_with_config(&results, Some(&config)).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());

    let headers = reader.headers().unwrap().clone();
    assert_eq!(
        headers.iter().collect::<Vec<_>>(),
        vec![
            "Result",
            "Key: id / record_id",
            "File A: name",
            "File B: display_name",
            "Difference Summary",
            "Duplicate Rows File A",
            "Duplicate Rows File B",
            "Duplicate Summary",
        ]
    );

    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].len(), headers.len());
    assert_eq!(records[0].get(2), Some(""));
    assert_eq!(records[0].get(3), Some(""));
    assert_eq!(
        records[0].get(5),
        Some("[[\"Carol\",\"300\",\"east\"],[\"Carol\",\"301\",\"west\"]]")
    );
    assert_eq!(records[0].get(6), Some(""));
    assert_eq!(
        records[0].get(7),
        Some("File A: [Carol, 300, east] | [Carol, 301, west]")
    );
}

#[test]
fn test_export_results_to_bytes_duplicate_rows_include_stable_side_specific_columns_for_both() {
    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["record_id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["display_name".to_string()],
        column_mappings: Vec::new(),
        normalization: ComparisonNormalizationConfig::default(),
    };
    let results = vec![RowComparisonResult::Duplicate {
        key: vec!["3".to_string()],
        values_a: vec![vec!["Carol".to_string()], vec!["Caroline".to_string()]],
        values_b: vec![vec!["Caro".to_string()], vec!["Carrie".to_string()]],
    }];

    let bytes = export_results_to_bytes_with_config(&results, Some(&config)).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());
    let headers = reader.headers().unwrap().clone();
    let duplicate_file_a_idx = headers
        .iter()
        .position(|h| h == "Duplicate Rows File A")
        .unwrap();
    let duplicate_file_b_idx = headers
        .iter()
        .position(|h| h == "Duplicate Rows File B")
        .unwrap();
    let duplicate_summary_idx = headers
        .iter()
        .position(|h| h == "Duplicate Summary")
        .unwrap();

    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();
    assert_eq!(records.len(), 1);
    assert_eq!(
        records[0].get(duplicate_file_a_idx),
        Some("[[\"Carol\"],[\"Caroline\"]]")
    );
    assert_eq!(
        records[0].get(duplicate_file_b_idx),
        Some("[[\"Caro\"],[\"Carrie\"]]")
    );
    assert_eq!(
        records[0].get(duplicate_summary_idx),
        Some("File A: [Carol] | [Caroline] ; File B: [Caro] | [Carrie]")
    );
}
