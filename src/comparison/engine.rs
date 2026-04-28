use super::super::data::types::*;
use super::rows::{extract_columns, get_column_selections, split_rows_by_key_usable};
use super::value_compare::find_differences;

/// Compare two CSV datasets based on configuration
pub fn compare_csv_data(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: &ComparisonConfig,
) -> Vec<RowComparisonResult> {
    let mut results = Vec::new();

    // Get column indices for key columns
    let key_selections_a = get_column_selections(&csv_a.headers, &config.key_columns_a);
    let key_selections_b = get_column_selections(&csv_b.headers, &config.key_columns_b);

    // Get column indices for comparison columns
    let comp_selections_a = get_column_selections(&csv_a.headers, &config.comparison_columns_a);
    let comp_selections_b = get_column_selections(&csv_b.headers, &config.comparison_columns_b);

    // Create maps for quick lookup
    let (map_a, nullish_rows_a) =
        split_rows_by_key_usable(csv_a, &key_selections_a, &config.normalization);
    let (map_b, nullish_rows_b) =
        split_rows_by_key_usable(csv_b, &key_selections_b, &config.normalization);

    for row_index in nullish_rows_a {
        results.push(RowComparisonResult::UnkeyedRight {
            key: extract_columns(&csv_a.rows[row_index], &key_selections_a),
            values_a: extract_columns(&csv_a.rows[row_index], &comp_selections_a),
        });
    }

    for row_index in nullish_rows_b {
        results.push(RowComparisonResult::UnkeyedLeft {
            key: extract_columns(&csv_b.rows[row_index], &key_selections_b),
            values_b: extract_columns(&csv_b.rows[row_index], &comp_selections_b),
        });
    }

    // Track which keys we've processed
    let mut processed_keys = std::collections::HashSet::new();

    // Process all keys from file A
    for (key, keyed_rows_a) in &map_a {
        if processed_keys.contains(key) {
            continue;
        }
        processed_keys.insert(key.clone());

        // Handle duplicates in File A
        if keyed_rows_a.indices.len() > 1 {
            if let Some(keyed_rows_b) = map_b.get(key) {
                if keyed_rows_b.indices.len() > 1 {
                    // Multiple matches in both files - report explicit duplicates per side once.
                    let values_a: Vec<Vec<String>> = keyed_rows_a
                        .indices
                        .iter()
                        .map(|&i| extract_columns(&csv_a.rows[i], &comp_selections_a))
                        .collect();
                    let values_b: Vec<Vec<String>> = keyed_rows_b
                        .indices
                        .iter()
                        .map(|&i| extract_columns(&csv_b.rows[i], &comp_selections_b))
                        .collect();

                    results.push(RowComparisonResult::Duplicate {
                        key: keyed_rows_a.display_key.clone(),
                        values_a,
                        values_b,
                    });
                } else {
                    // Report duplicates from File A and still compare the first occurrence with File B.
                    let values_a_duplicates: Vec<Vec<String>> = keyed_rows_a
                        .indices
                        .iter()
                        .map(|&i| extract_columns(&csv_a.rows[i], &comp_selections_a))
                        .collect();
                    results.push(RowComparisonResult::Duplicate {
                        key: keyed_rows_a.display_key.clone(),
                        values_a: values_a_duplicates,
                        values_b: Vec::new(),
                    });

                    // Single match in File B - compare with first occurrence in File A
                    let values_a =
                        extract_columns(&csv_a.rows[keyed_rows_a.indices[0]], &comp_selections_a);
                    let values_b =
                        extract_columns(&csv_b.rows[keyed_rows_b.indices[0]], &comp_selections_b);

                    results.push(compare_single_match(
                        keyed_rows_a.display_key.clone(),
                        values_a,
                        values_b,
                        config,
                    ));
                }
            } else {
                let values_a: Vec<Vec<String>> = keyed_rows_a
                    .indices
                    .iter()
                    .map(|&i| extract_columns(&csv_a.rows[i], &comp_selections_a))
                    .collect();
                results.push(RowComparisonResult::Duplicate {
                    key: keyed_rows_a.display_key.clone(),
                    values_a,
                    values_b: Vec::new(),
                });
            }
            continue;
        }

        // Handle duplicates in File B
        if let Some(keyed_rows_b) = map_b.get(key)
            && keyed_rows_b.indices.len() > 1
        {
            // Report duplicates from File B
            let values: Vec<Vec<String>> = keyed_rows_b
                .indices
                .iter()
                .map(|&i| extract_columns(&csv_b.rows[i], &comp_selections_b))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: keyed_rows_a.display_key.clone(),
                values_a: Vec::new(),
                values_b: values,
            });

            // Compare the first occurrence in File B with File A
            let values_a =
                extract_columns(&csv_a.rows[keyed_rows_a.indices[0]], &comp_selections_a);
            let values_b =
                extract_columns(&csv_b.rows[keyed_rows_b.indices[0]], &comp_selections_b);

            results.push(compare_single_match(
                keyed_rows_a.display_key.clone(),
                values_a,
                values_b,
                config,
            ));
            continue;
        }

        // Single occurrence in both files or only in File A
        if let Some(keyed_rows_b) = map_b.get(key) {
            // Key exists in both files with single occurrences
            let values_a =
                extract_columns(&csv_a.rows[keyed_rows_a.indices[0]], &comp_selections_a);
            let values_b =
                extract_columns(&csv_b.rows[keyed_rows_b.indices[0]], &comp_selections_b);

            results.push(compare_single_match(
                keyed_rows_a.display_key.clone(),
                values_a,
                values_b,
                config,
            ));
        } else {
            // Key only in File A - missing from File B
            let values_a =
                extract_columns(&csv_a.rows[keyed_rows_a.indices[0]], &comp_selections_a);
            results.push(RowComparisonResult::MissingRight {
                key: keyed_rows_a.display_key.clone(),
                values_a,
            });
        }
    }

    // Process keys only in File B
    for (key, keyed_rows_b) in &map_b {
        if processed_keys.contains(key) {
            continue;
        }

        // Handle duplicates in File B (already processed in the main loop)
        if keyed_rows_b.indices.len() > 1 {
            // Report duplicates from File B
            let values: Vec<Vec<String>> = keyed_rows_b
                .indices
                .iter()
                .map(|&i| extract_columns(&csv_b.rows[i], &comp_selections_b))
                .collect();
            results.push(RowComparisonResult::Duplicate {
                key: keyed_rows_b.display_key.clone(),
                values_a: Vec::new(),
                values_b: values,
            });
            continue;
        }

        // Key only in File B - missing from File A
        let values_b = extract_columns(&csv_b.rows[keyed_rows_b.indices[0]], &comp_selections_b);
        results.push(RowComparisonResult::MissingLeft {
            key: keyed_rows_b.display_key.clone(),
            values_b,
        });
    }

    results
}

fn compare_single_match(
    key: Vec<String>,
    values_a: Vec<String>,
    values_b: Vec<String>,
    config: &ComparisonConfig,
) -> RowComparisonResult {
    let differences = find_differences(
        &config.comparison_columns_a,
        &config.comparison_columns_b,
        &values_a,
        &values_b,
        &config.column_mappings,
        &config.normalization,
    );

    if differences.is_empty() {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        }
    } else {
        RowComparisonResult::Mismatch {
            key,
            values_a,
            values_b,
            differences,
        }
    }
}

/// Generate summary statistics from comparison results
pub fn generate_summary(
    results: &[RowComparisonResult],
    total_rows_a: usize,
    total_rows_b: usize,
) -> ComparisonSummary {
    let mut summary = ComparisonSummary {
        total_rows_a,
        total_rows_b,
        matches: 0,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        unkeyed_left: 0,
        unkeyed_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
    };

    for result in results {
        match result {
            RowComparisonResult::Duplicate { .. } => match result.duplicate_source() {
                Some(DuplicateSource::FileA) => summary.duplicates_a += 1,
                Some(DuplicateSource::FileB) => summary.duplicates_b += 1,
                Some(DuplicateSource::Both) => {
                    summary.duplicates_a += 1;
                    summary.duplicates_b += 1;
                }
                None => {}
            },
            _ => match result.result_type() {
                ResultType::Match => summary.matches += 1,
                ResultType::Mismatch => summary.mismatches += 1,
                ResultType::MissingLeft => summary.missing_left += 1,
                ResultType::MissingRight => summary.missing_right += 1,
                ResultType::UnkeyedLeft => summary.unkeyed_left += 1,
                ResultType::UnkeyedRight => summary.unkeyed_right += 1,
                ResultType::DuplicateFileA
                | ResultType::DuplicateFileB
                | ResultType::DuplicateBoth => unreachable!(
                    "duplicate rows are handled by duplicate_source to preserve summary semantics"
                ),
            },
        }
    }

    summary
}
