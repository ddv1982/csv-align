use super::super::data::types::*;
use std::collections::HashMap;

/// Compare two CSV datasets based on configuration
pub fn compare_csv_data(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: &ComparisonConfig,
) -> Vec<RowComparisonResult> {
    let mut results = Vec::new();

    // Get column indices for key columns
    let key_indices_a = get_column_indices(&csv_a.headers, &config.key_columns_a);
    let key_indices_b = get_column_indices(&csv_b.headers, &config.key_columns_b);

    // Get column indices for comparison columns
    let comp_indices_a = get_column_indices(&csv_a.headers, &config.comparison_columns_a);
    let comp_indices_b = get_column_indices(&csv_b.headers, &config.comparison_columns_b);

    // Create maps for quick lookup
    let map_a = create_key_map(csv_a, &key_indices_a);
    let map_b = create_key_map(csv_b, &key_indices_b);

    // Track which keys we've processed
    let mut processed_keys = std::collections::HashSet::new();

    // Process all keys from file A
    for (key, indices_a) in &map_a {
        if processed_keys.contains(key) {
            continue;
        }
        processed_keys.insert(key.clone());

        // Handle duplicates in File A
        if indices_a.len() > 1 {
            // Report duplicates from File A
            let values: Vec<Vec<String>> = indices_a
                .iter()
                .map(|&i| extract_columns(&csv_a.rows[i], &comp_indices_a))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: key.clone(),
                source: DuplicateSource::FileA,
                values,
            });

            // Still compare the first occurrence with File B if it exists
            if let Some(indices_b) = map_b.get(key) {
                if indices_b.len() == 1 {
                    // Single match in File B - compare with first occurrence in File A
                    let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
                    let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

                    let differences = find_differences(
                        &config.comparison_columns_a,
                        &config.comparison_columns_b,
                        &values_a,
                        &values_b,
                        &config.column_mappings,
                    );

                    if differences.is_empty() {
                        results.push(RowComparisonResult::Match {
                            key: key.clone(),
                            values_a,
                            values_b,
                        });
                    } else {
                        results.push(RowComparisonResult::Mismatch {
                            key: key.clone(),
                            values_a,
                            values_b,
                            differences,
                        });
                    }
                } else {
                    // Multiple matches in both files - mark as duplicate in both
                    let values_a: Vec<Vec<String>> = indices_a
                        .iter()
                        .map(|&i| extract_columns(&csv_a.rows[i], &comp_indices_a))
                        .collect();
                    let values_b: Vec<Vec<String>> = indices_b
                        .iter()
                        .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                        .collect();

                    results.push(RowComparisonResult::Duplicate {
                        key: key.clone(),
                        source: DuplicateSource::Both,
                        values: [values_a, values_b].concat(),
                    });
                }
            } else {
                // Key only in File A - missing from File B
                // Already reported as duplicate, no need for missing right
            }
            continue;
        }

        // Handle duplicates in File B
        if let Some(indices_b) = map_b.get(key) {
            if indices_b.len() > 1 {
                // Report duplicates from File B
                let values: Vec<Vec<String>> = indices_b
                    .iter()
                    .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                    .collect();
                results.push(RowComparisonResult::Duplicate {
                    key: key.clone(),
                    source: DuplicateSource::FileB,
                    values,
                });

                // Compare the first occurrence in File B with File A
                let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
                let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

                let differences = find_differences(
                    &config.comparison_columns_a,
                    &config.comparison_columns_b,
                    &values_a,
                    &values_b,
                    &config.column_mappings,
                );

                if differences.is_empty() {
                    results.push(RowComparisonResult::Match {
                        key: key.clone(),
                        values_a,
                        values_b,
                    });
                } else {
                    results.push(RowComparisonResult::Mismatch {
                        key: key.clone(),
                        values_a,
                        values_b,
                        differences,
                    });
                }
                continue;
            }
        }

        // Single occurrence in both files or only in File A
        if let Some(indices_b) = map_b.get(key) {
            // Key exists in both files with single occurrences
            let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
            let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);

            let differences = find_differences(
                &config.comparison_columns_a,
                &config.comparison_columns_b,
                &values_a,
                &values_b,
                &config.column_mappings,
            );

            if differences.is_empty() {
                results.push(RowComparisonResult::Match {
                    key: key.clone(),
                    values_a,
                    values_b,
                });
            } else {
                results.push(RowComparisonResult::Mismatch {
                    key: key.clone(),
                    values_a,
                    values_b,
                    differences,
                });
            }
        } else {
            // Key only in File A - missing from File B
            let values_a = extract_columns(&csv_a.rows[indices_a[0]], &comp_indices_a);
            results.push(RowComparisonResult::MissingRight {
                key: key.clone(),
                values_a,
            });
        }
    }

    // Process keys only in File B
    for (key, indices_b) in &map_b {
        if processed_keys.contains(key) {
            continue;
        }

        // Handle duplicates in File B (already processed in the main loop)
        if indices_b.len() > 1 {
            // Report duplicates from File B
            let values: Vec<Vec<String>> = indices_b
                .iter()
                .map(|&i| extract_columns(&csv_b.rows[i], &comp_indices_b))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: key.clone(),
                source: DuplicateSource::FileB,
                values,
            });
            continue;
        }

        // Key only in File B - missing from File A
        let values_b = extract_columns(&csv_b.rows[indices_b[0]], &comp_indices_b);
        results.push(RowComparisonResult::MissingLeft {
            key: key.clone(),
            values_b,
        });
    }

    results
}

/// Get column indices for given column names
fn get_column_indices(headers: &[String], column_names: &[String]) -> Vec<usize> {
    column_names
        .iter()
        .filter_map(|name| headers.iter().position(|h| h == name))
        .collect()
}

/// Create a map from key values to row indices
fn create_key_map(csv_data: &CsvData, key_indices: &[usize]) -> HashMap<Vec<String>, Vec<usize>> {
    let mut map = HashMap::new();

    for (i, row) in csv_data.rows.iter().enumerate() {
        let key: Vec<String> = key_indices
            .iter()
            .map(|&idx| row.get(idx).cloned().unwrap_or_default())
            .collect();

        map.entry(key).or_insert_with(Vec::new).push(i);
    }

    map
}

/// Extract values from specified column indices
fn extract_columns(row: &[String], indices: &[usize]) -> Vec<String> {
    indices
        .iter()
        .map(|&idx| row.get(idx).cloned().unwrap_or_default())
        .collect()
}

/// Find differences between two sets of values
fn find_differences(
    columns_a: &[String],
    columns_b: &[String],
    values_a: &[String],
    values_b: &[String],
    mappings: &[ColumnMapping],
) -> Vec<ValueDifference> {
    let mut differences = Vec::new();

    // Create a map from file B columns to file A columns
    let column_map: HashMap<&str, &str> = mappings
        .iter()
        .map(|m| (m.file_b_column.as_str(), m.file_a_column.as_str()))
        .collect();

    // Compare each mapped column
    for (i, col_a) in columns_a.iter().enumerate() {
        if let Some(&mapped_col_b) = column_map.get(col_a.as_str()) {
            if let Some(j) = columns_b.iter().position(|c| c == mapped_col_b) {
                if i < values_a.len() && j < values_b.len() {
                    if values_a[i] != values_b[j] {
                        differences.push(ValueDifference {
                            column_a: col_a.clone(),
                            column_b: mapped_col_b.to_string(),
                            value_a: values_a[i].clone(),
                            value_b: values_b[j].clone(),
                        });
                    }
                }
            }
        }
    }

    differences
}

/// Generate summary statistics from comparison results
pub fn generate_summary(results: &[RowComparisonResult]) -> ComparisonSummary {
    let mut summary = ComparisonSummary {
        total_rows_a: 0,
        total_rows_b: 0,
        matches: 0,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
    };

    for result in results {
        match result {
            RowComparisonResult::Match { .. } => summary.matches += 1,
            RowComparisonResult::Mismatch { .. } => summary.mismatches += 1,
            RowComparisonResult::MissingLeft { .. } => summary.missing_left += 1,
            RowComparisonResult::MissingRight { .. } => summary.missing_right += 1,
            RowComparisonResult::Duplicate { source, .. } => match source {
                DuplicateSource::FileA => summary.duplicates_a += 1,
                DuplicateSource::FileB => summary.duplicates_b += 1,
                DuplicateSource::Both => {
                    summary.duplicates_a += 1;
                    summary.duplicates_b += 1;
                }
            },
        }
    }

    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_csv_a() -> CsvData {
        CsvData {
            file_path: Some("test_a.csv".to_string()),
            headers: vec!["id".to_string(), "name".to_string(), "value".to_string()],
            rows: vec![
                vec!["1".to_string(), "Alice".to_string(), "100".to_string()],
                vec!["2".to_string(), "Bob".to_string(), "200".to_string()],
                vec!["3".to_string(), "Charlie".to_string(), "300".to_string()],
                vec!["2".to_string(), "Bob".to_string(), "200".to_string()], // duplicate
            ],
        }
    }

    fn create_test_csv_b() -> CsvData {
        CsvData {
            file_path: Some("test_b.csv".to_string()),
            headers: vec!["id".to_string(), "name".to_string(), "amount".to_string()],
            rows: vec![
                vec!["1".to_string(), "Alice".to_string(), "100".to_string()],
                vec!["2".to_string(), "Robert".to_string(), "200".to_string()], // mismatch
                vec!["4".to_string(), "David".to_string(), "400".to_string()],  // missing left
            ],
        }
    }

    fn create_test_config() -> ComparisonConfig {
        ComparisonConfig {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["id".to_string()],
            comparison_columns_a: vec!["name".to_string(), "value".to_string()],
            comparison_columns_b: vec!["name".to_string(), "amount".to_string()],
            column_mappings: vec![
                ColumnMapping {
                    file_a_column: "name".to_string(),
                    file_b_column: "name".to_string(),
                    mapping_type: MappingType::ExactMatch,
                },
                ColumnMapping {
                    file_a_column: "value".to_string(),
                    file_b_column: "amount".to_string(),
                    mapping_type: MappingType::ExactMatch,
                },
            ],
        }
    }

    #[test]
    fn test_compare_csv_data() {
        let csv_a = create_test_csv_a();
        let csv_b = create_test_csv_b();
        let config = create_test_config();

        let results = compare_csv_data(&csv_a, &csv_b, &config);

        // Debug output
        println!("Results count: {}", results.len());
        for (i, result) in results.iter().enumerate() {
            println!("Result {}: {:?}", i, result);
        }

        // Should have: 1 match, 1 mismatch, 1 missing right, 1 missing left, 1 duplicate from file A
        assert_eq!(results.len(), 5);

        let matches = results
            .iter()
            .filter(|r| matches!(r, RowComparisonResult::Match { .. }))
            .count();
        let mismatches = results
            .iter()
            .filter(|r| matches!(r, RowComparisonResult::Mismatch { .. }))
            .count();
        let missing_left = results
            .iter()
            .filter(|r| matches!(r, RowComparisonResult::MissingLeft { .. }))
            .count();
        let missing_right = results
            .iter()
            .filter(|r| matches!(r, RowComparisonResult::MissingRight { .. }))
            .count();
        let duplicates = results
            .iter()
            .filter(|r| matches!(r, RowComparisonResult::Duplicate { .. }))
            .count();

        assert_eq!(matches, 1);
        assert_eq!(mismatches, 1);
        assert_eq!(missing_left, 1);
        assert_eq!(missing_right, 1);
        assert_eq!(duplicates, 1);
    }

    #[test]
    fn test_generate_summary() {
        let results = vec![
            RowComparisonResult::Match {
                key: vec!["1".to_string()],
                values_a: vec![],
                values_b: vec![],
            },
            RowComparisonResult::Mismatch {
                key: vec!["2".to_string()],
                values_a: vec![],
                values_b: vec![],
                differences: vec![],
            },
            RowComparisonResult::MissingLeft {
                key: vec!["3".to_string()],
                values_b: vec![],
            },
        ];

        let summary = generate_summary(&results);

        assert_eq!(summary.matches, 1);
        assert_eq!(summary.mismatches, 1);
        assert_eq!(summary.missing_left, 1);
    }
}
