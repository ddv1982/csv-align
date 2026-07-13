use csv::Reader;
use csv_align::data::{
    export::{export_results_to_bytes, write_export_results},
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

    write_export_results(&results, Some(&config), path).unwrap();

    let content = std::fs::read_to_string(path).unwrap();
    assert!(content.contains("Match"));
    assert!(content.contains("Mismatch"));
    assert!(content.contains("Key: id / record_id"));
    assert!(content.contains("File A: name"));
    assert!(content.contains("File B: display_name"));
}

#[test]
fn test_export_results_public_api_uses_optional_config() {
    let results = vec![RowComparisonResult::Match {
        key: vec!["1".to_string()],
        values_a: vec!["Alice".to_string()],
        values_b: vec!["Alice".to_string()],
    }];

    let bytes = export_results_to_bytes(&results, None).unwrap();
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
    write_export_results(&results, None, temp_file.path()).unwrap();
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

    let bytes = export_results_to_bytes(&results, Some(&config)).unwrap();
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

    let bytes = export_results_to_bytes(&results, Some(&config)).unwrap();
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

    let bytes = export_results_to_bytes(&results, Some(&config)).unwrap();
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

#[test]
fn test_export_results_neutralizes_spreadsheet_formulas_at_the_writer_boundary() {
    let dangerous = [
        "=SUM(A1:A2)",
        "+cmd",
        "-10",
        "@name",
        "  =leading-space",
        "\tleading-tab",
        "\rleading-carriage-return",
        "\nleading-line-feed",
    ];
    let results = vec![
        RowComparisonResult::Mismatch {
            key: dangerous.iter().map(|value| (*value).to_string()).collect(),
            values_a: dangerous[..4]
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
            values_b: dangerous[4..]
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
            differences: vec![ValueDifference {
                column_a: "=column".to_string(),
                column_b: "=column".to_string(),
                value_a: "safe-left".to_string(),
                value_b: "safe-right".to_string(),
            }],
        },
        RowComparisonResult::Match {
            key: vec![
                "plain".to_string(),
                "  plain".to_string(),
                "'=already-safe".to_string(),
            ],
            values_a: vec!["42".to_string()],
            values_b: vec!["text".to_string()],
        },
    ];

    let bytes = export_results_to_bytes(&results, None).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());
    let headers = reader.headers().unwrap().clone();
    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();

    assert_eq!(headers.get(0), Some("Result"));
    assert_eq!(records.len(), 2);
    assert_eq!(records[0].len(), headers.len());
    assert_eq!(records[1].len(), headers.len());

    for (offset, original) in dangerous.iter().enumerate() {
        let expected = format!("'{original}");
        assert_eq!(records[0].get(1 + offset), Some(expected.as_str()));
    }

    let file_a_start = 1 + dangerous.len();
    for (offset, original) in dangerous[..4].iter().enumerate() {
        let expected = format!("'{original}");
        assert_eq!(
            records[0].get(file_a_start + offset),
            Some(expected.as_str())
        );
    }

    let file_b_start = file_a_start + 4;
    for (offset, original) in dangerous[4..].iter().enumerate() {
        let expected = format!("'{original}");
        assert_eq!(
            records[0].get(file_b_start + offset),
            Some(expected.as_str())
        );
    }

    let difference_summary = headers
        .iter()
        .position(|header| header == "Difference Summary")
        .unwrap();
    assert_eq!(
        records[0].get(difference_summary),
        Some("'=column: safe-left -> safe-right")
    );

    assert_eq!(records[1].get(1), Some("plain"));
    assert_eq!(records[1].get(2), Some("  plain"));
    assert_eq!(records[1].get(3), Some("'=already-safe"));
    assert_eq!(records[1].get(file_a_start), Some("42"));
    assert_eq!(records[1].get(file_b_start), Some("text"));
}

#[test]
fn test_export_results_preserves_duplicate_payloads_and_rectangular_shape() {
    let results = vec![RowComparisonResult::Duplicate {
        key: vec!["=duplicate-key".to_string()],
        values_a: vec![vec!["=formula".to_string(), "+command".to_string()]],
        values_b: vec![vec!["-value".to_string(), "@value".to_string()]],
    }];

    let bytes = export_results_to_bytes(&results, None).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());
    let headers = reader.headers().unwrap().clone();
    let duplicate_file_a = headers
        .iter()
        .position(|header| header == "Duplicate Rows File A")
        .unwrap();
    let duplicate_file_b = headers
        .iter()
        .position(|header| header == "Duplicate Rows File B")
        .unwrap();
    let duplicate_summary = headers
        .iter()
        .position(|header| header == "Duplicate Summary")
        .unwrap();
    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();

    assert_eq!(records.len(), 1);
    assert_eq!(records[0].len(), headers.len());
    assert_eq!(records[0].get(1), Some("'=duplicate-key"));
    assert_eq!(
        records[0].get(duplicate_file_a),
        Some("[[\"=formula\",\"+command\"]]")
    );
    assert_eq!(
        records[0].get(duplicate_file_b),
        Some("[[\"-value\",\"@value\"]]")
    );
    assert_eq!(
        records[0].get(duplicate_summary),
        Some("File A: [=formula, +command] ; File B: [-value, @value]")
    );
}

#[test]
fn test_export_results_uses_clearer_labels_for_one_sided_and_ignored_rows() {
    let results = vec![
        RowComparisonResult::MissingLeft {
            key: vec!["2".to_string()],
            values_b: vec!["only in b".to_string()],
        },
        RowComparisonResult::MissingRight {
            key: vec!["3".to_string()],
            values_a: vec!["only in a".to_string()],
        },
        RowComparisonResult::UnkeyedLeft {
            key: vec!["NULL".to_string()],
            values_b: vec!["ignored b".to_string()],
        },
        RowComparisonResult::UnkeyedRight {
            key: vec!["".to_string()],
            values_a: vec!["ignored a".to_string()],
        },
    ];

    let bytes = export_results_to_bytes(&results, None).unwrap();
    let mut reader = Reader::from_reader(bytes.as_slice());
    let records: Vec<csv::StringRecord> = reader.records().map(Result::unwrap).collect();

    assert_eq!(records[0].get(0), Some("Only in File B"));
    assert_eq!(records[1].get(0), Some("Only in File A"));
    assert_eq!(records[2].get(0), Some("Ignored in File B"));
    assert_eq!(records[3].get(0), Some("Ignored in File A"));
}
