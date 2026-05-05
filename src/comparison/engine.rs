use super::super::data::types::*;
use super::rows::{
    KeyedRows, extract_columns, flexible_keys_match, get_column_selections,
    split_rows_by_key_usable, wildcard_literal_count, wildcard_token_count,
};
use super::value_compare::{find_differences, normalize_display_value};
use crate::data::json_fields::ColumnSelection;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

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

    let context = ComparisonContext {
        csv_a,
        csv_b,
        config,
        key_selections_a: &key_selections_a,
        key_selections_b: &key_selections_b,
        comp_selections_a: &comp_selections_a,
        comp_selections_b: &comp_selections_b,
    };

    for row_index in nullish_rows_a {
        push_unkeyed_right(&mut results, row_index, &context);
    }

    for row_index in nullish_rows_b {
        push_unkeyed_left(&mut results, row_index, &context);
    }

    if config.normalization.flexible_key_matching {
        compare_key_groups_flexible(&mut results, &map_a, &map_b, &context);
    } else {
        compare_key_groups_exact(&mut results, &map_a, &map_b, &context);
    }

    results
}

struct ComparisonContext<'a> {
    csv_a: &'a CsvData,
    csv_b: &'a CsvData,
    config: &'a ComparisonConfig,
    key_selections_a: &'a [ColumnSelection],
    key_selections_b: &'a [ColumnSelection],
    comp_selections_a: &'a [ColumnSelection],
    comp_selections_b: &'a [ColumnSelection],
}

#[derive(Clone)]
struct FlexibleCandidate {
    key_a: Vec<String>,
    key_b: Vec<String>,
    exact_match: bool,
    literal_count: usize,
    wildcard_count: usize,
    first_index_a: usize,
    first_index_b: usize,
}

fn compare_key_groups_exact(
    results: &mut Vec<RowComparisonResult>,
    map_a: &HashMap<Vec<String>, KeyedRows>,
    map_b: &HashMap<Vec<String>, KeyedRows>,
    context: &ComparisonContext,
) {
    let mut processed_b = HashSet::new();

    // Process all keys from file A, preserving the existing map-driven exact path.
    for (key, keyed_rows_a) in map_a {
        if let Some(keyed_rows_b) = map_b.get(key) {
            processed_b.insert(key.clone());
            push_paired_group_results(results, keyed_rows_a, keyed_rows_b, context);
        } else {
            push_unmatched_a_results(results, keyed_rows_a, context);
        }
    }

    // Process keys only in File B.
    for (key, keyed_rows_b) in map_b {
        if processed_b.contains(key) {
            continue;
        }

        push_unmatched_b_results(results, keyed_rows_b, context);
    }
}

fn compare_key_groups_flexible(
    results: &mut Vec<RowComparisonResult>,
    map_a: &HashMap<Vec<String>, KeyedRows>,
    map_b: &HashMap<Vec<String>, KeyedRows>,
    context: &ComparisonContext,
) {
    let mut matched_a: HashSet<Vec<String>> = HashSet::new();
    let mut matched_b: HashSet<Vec<String>> = HashSet::new();
    let mut candidates = Vec::new();
    let candidate_rows_b: Vec<(&Vec<String>, &KeyedRows)> = map_b.iter().collect();

    for (key_a, keyed_rows_a) in map_a {
        collect_flexible_candidates_for_key(
            &mut candidates,
            key_a,
            keyed_rows_a,
            candidate_rows_b.iter().copied(),
        );
    }

    candidates.sort_by(compare_flexible_candidate_preference);

    for candidate in select_preferred_max_cardinality_flexible_matches(&candidates) {
        matched_a.insert(candidate.key_a.clone());
        matched_b.insert(candidate.key_b.clone());
        push_paired_group_results(
            results,
            map_a
                .get(&candidate.key_a)
                .expect("candidate File A key should exist"),
            map_b
                .get(&candidate.key_b)
                .expect("candidate File B key should exist"),
            context,
        );
    }

    let mut unmatched_a: Vec<&KeyedRows> = map_a
        .iter()
        .filter_map(|(key, keyed_rows)| (!matched_a.contains(key)).then_some(keyed_rows))
        .collect();
    unmatched_a.sort_by(|left, right| {
        left.first_index
            .cmp(&right.first_index)
            .then(left.normalized_key.cmp(&right.normalized_key))
    });
    for keyed_rows_a in unmatched_a {
        push_unmatched_a_results(results, keyed_rows_a, context);
    }

    let mut unmatched_b: Vec<&KeyedRows> = map_b
        .iter()
        .filter_map(|(key, keyed_rows)| (!matched_b.contains(key)).then_some(keyed_rows))
        .collect();
    unmatched_b.sort_by(|left, right| {
        left.first_index
            .cmp(&right.first_index)
            .then(left.normalized_key.cmp(&right.normalized_key))
    });
    for keyed_rows_b in unmatched_b {
        push_unmatched_b_results(results, keyed_rows_b, context);
    }
}

fn collect_flexible_candidates_for_key<'a>(
    candidates: &mut Vec<FlexibleCandidate>,
    key_a: &[String],
    keyed_rows_a: &KeyedRows,
    candidate_rows_b: impl Iterator<Item = (&'a Vec<String>, &'a KeyedRows)>,
) {
    for (key_b, keyed_rows_b) in candidate_rows_b {
        if !flexible_keys_match(&keyed_rows_a.normalized_key, &keyed_rows_b.normalized_key) {
            continue;
        }

        candidates.push(FlexibleCandidate {
            key_a: key_a.to_vec(),
            key_b: key_b.clone(),
            exact_match: keyed_rows_a.normalized_key == keyed_rows_b.normalized_key,
            literal_count: wildcard_literal_count(
                &keyed_rows_a.normalized_key,
                &keyed_rows_b.normalized_key,
            ),
            wildcard_count: wildcard_token_count(
                &keyed_rows_a.normalized_key,
                &keyed_rows_b.normalized_key,
            ),
            first_index_a: keyed_rows_a.first_index,
            first_index_b: keyed_rows_b.first_index,
        });
    }
}

fn compare_flexible_candidate_preference(
    left: &FlexibleCandidate,
    right: &FlexibleCandidate,
) -> Ordering {
    right
        .exact_match
        .cmp(&left.exact_match)
        .then(right.literal_count.cmp(&left.literal_count))
        .then(left.wildcard_count.cmp(&right.wildcard_count))
        .then(left.first_index_a.cmp(&right.first_index_a))
        .then(left.first_index_b.cmp(&right.first_index_b))
        .then(left.key_a.cmp(&right.key_a))
        .then(left.key_b.cmp(&right.key_b))
}

fn select_preferred_max_cardinality_flexible_matches(
    candidates: &[FlexibleCandidate],
) -> Vec<FlexibleCandidate> {
    let target_count = maximum_flexible_match_count(candidates, &[]);
    let mut selected_indices = Vec::new();
    let mut selected_a = HashSet::new();
    let mut selected_b = HashSet::new();

    for candidate_index in 0..candidates.len() {
        if selected_indices.len() == target_count {
            break;
        }

        let candidate = &candidates[candidate_index];
        if selected_a.contains(&candidate.key_a) || selected_b.contains(&candidate.key_b) {
            continue;
        }

        let mut trial_indices = selected_indices.clone();
        trial_indices.push(candidate_index);
        if maximum_flexible_match_count(candidates, &trial_indices) == target_count {
            selected_indices = trial_indices;
            selected_a.insert(candidate.key_a.clone());
            selected_b.insert(candidate.key_b.clone());
        }
    }

    selected_indices
        .into_iter()
        .map(|candidate_index| candidates[candidate_index].clone())
        .collect()
}

fn maximum_flexible_match_count(
    candidates: &[FlexibleCandidate],
    forced_indices: &[usize],
) -> usize {
    let mut forced_a = HashSet::new();
    let mut forced_b = HashSet::new();
    for &candidate_index in forced_indices {
        let candidate = &candidates[candidate_index];
        if !forced_a.insert(candidate.key_a.clone()) || !forced_b.insert(candidate.key_b.clone()) {
            return 0;
        }
    }

    let mut a_index_by_key = HashMap::new();
    let mut b_index_by_key = HashMap::new();
    let mut candidate_b_indices = Vec::new();
    let mut adjacency: Vec<Vec<usize>> = Vec::new();

    for candidate in candidates {
        if forced_a.contains(&candidate.key_a) || forced_b.contains(&candidate.key_b) {
            continue;
        }

        let next_a_index = a_index_by_key.len();
        let a_index = *a_index_by_key
            .entry(candidate.key_a.clone())
            .or_insert_with(|| {
                adjacency.push(Vec::new());
                next_a_index
            });

        let next_b_index = b_index_by_key.len();
        let b_index = *b_index_by_key
            .entry(candidate.key_b.clone())
            .or_insert(next_b_index);

        adjacency[a_index].push(candidate_b_indices.len());
        candidate_b_indices.push(b_index);
    }

    let mut matched_a_by_b: Vec<Option<usize>> = vec![None; b_index_by_key.len()];
    let mut match_count = forced_indices.len();
    for a_index in 0..adjacency.len() {
        let mut seen_b = vec![false; b_index_by_key.len()];
        if try_match_flexible_key(
            a_index,
            &adjacency,
            &candidate_b_indices,
            &mut seen_b,
            &mut matched_a_by_b,
        ) {
            match_count += 1;
        }
    }

    match_count
}

fn try_match_flexible_key(
    a_index: usize,
    adjacency: &[Vec<usize>],
    candidate_b_indices: &[usize],
    seen_b: &mut [bool],
    matched_a_by_b: &mut [Option<usize>],
) -> bool {
    for &edge_index in &adjacency[a_index] {
        let b_index = candidate_b_indices[edge_index];
        if seen_b[b_index] {
            continue;
        }
        seen_b[b_index] = true;

        let can_match = match matched_a_by_b[b_index] {
            Some(matched_a_index) => try_match_flexible_key(
                matched_a_index,
                adjacency,
                candidate_b_indices,
                seen_b,
                matched_a_by_b,
            ),
            None => true,
        };

        if can_match {
            matched_a_by_b[b_index] = Some(a_index);
            return true;
        }
    }

    false
}

fn push_unkeyed_right(
    results: &mut Vec<RowComparisonResult>,
    row_index: usize,
    context: &ComparisonContext,
) {
    results.push(RowComparisonResult::UnkeyedRight {
        key: display_values(
            extract_columns(&context.csv_a.rows[row_index], context.key_selections_a),
            &context.config.normalization,
        ),
        values_a: display_values(
            extract_columns(&context.csv_a.rows[row_index], context.comp_selections_a),
            &context.config.normalization,
        ),
    });
}

fn push_unkeyed_left(
    results: &mut Vec<RowComparisonResult>,
    row_index: usize,
    context: &ComparisonContext,
) {
    results.push(RowComparisonResult::UnkeyedLeft {
        key: display_values(
            extract_columns(&context.csv_b.rows[row_index], context.key_selections_b),
            &context.config.normalization,
        ),
        values_b: display_values(
            extract_columns(&context.csv_b.rows[row_index], context.comp_selections_b),
            &context.config.normalization,
        ),
    });
}

fn push_paired_group_results(
    results: &mut Vec<RowComparisonResult>,
    keyed_rows_a: &KeyedRows,
    keyed_rows_b: &KeyedRows,
    context: &ComparisonContext,
) {
    if keyed_rows_a.indices.len() > 1 && keyed_rows_b.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_a.display_key.clone(),
            values_a: comparison_display_values_a(keyed_rows_a, context),
            values_b: comparison_display_values_b(keyed_rows_b, context),
        });
        return;
    }

    if keyed_rows_a.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_a.display_key.clone(),
            values_a: comparison_display_values_a(keyed_rows_a, context),
            values_b: Vec::new(),
        });
    }

    if keyed_rows_b.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_a.display_key.clone(),
            values_a: Vec::new(),
            values_b: comparison_display_values_b(keyed_rows_b, context),
        });
    }

    results.push(compare_first_rows(keyed_rows_a, keyed_rows_b, context));
}

fn push_unmatched_a_results(
    results: &mut Vec<RowComparisonResult>,
    keyed_rows_a: &KeyedRows,
    context: &ComparisonContext,
) {
    if keyed_rows_a.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_a.display_key.clone(),
            values_a: comparison_display_values_a(keyed_rows_a, context),
            values_b: Vec::new(),
        });
        return;
    }

    let values_a = extract_columns(
        &context.csv_a.rows[keyed_rows_a.indices[0]],
        context.comp_selections_a,
    );
    results.push(RowComparisonResult::MissingRight {
        key: keyed_rows_a.display_key.clone(),
        values_a: display_values(values_a, &context.config.normalization),
    });
}

fn push_unmatched_b_results(
    results: &mut Vec<RowComparisonResult>,
    keyed_rows_b: &KeyedRows,
    context: &ComparisonContext,
) {
    if keyed_rows_b.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_b.display_key.clone(),
            values_a: Vec::new(),
            values_b: comparison_display_values_b(keyed_rows_b, context),
        });
        return;
    }

    let values_b = extract_columns(
        &context.csv_b.rows[keyed_rows_b.indices[0]],
        context.comp_selections_b,
    );
    results.push(RowComparisonResult::MissingLeft {
        key: keyed_rows_b.display_key.clone(),
        values_b: display_values(values_b, &context.config.normalization),
    });
}

fn compare_first_rows(
    keyed_rows_a: &KeyedRows,
    keyed_rows_b: &KeyedRows,
    context: &ComparisonContext,
) -> RowComparisonResult {
    let values_a = extract_columns(
        &context.csv_a.rows[keyed_rows_a.indices[0]],
        context.comp_selections_a,
    );
    let values_b = extract_columns(
        &context.csv_b.rows[keyed_rows_b.indices[0]],
        context.comp_selections_b,
    );

    compare_single_match(
        keyed_rows_a.display_key.clone(),
        values_a,
        values_b,
        context.config,
    )
}

fn comparison_display_values_a(
    keyed_rows_a: &KeyedRows,
    context: &ComparisonContext,
) -> Vec<Vec<String>> {
    keyed_rows_a
        .indices
        .iter()
        .map(|&index| {
            display_values(
                extract_columns(&context.csv_a.rows[index], context.comp_selections_a),
                &context.config.normalization,
            )
        })
        .collect()
}

fn comparison_display_values_b(
    keyed_rows_b: &KeyedRows,
    context: &ComparisonContext,
) -> Vec<Vec<String>> {
    keyed_rows_b
        .indices
        .iter()
        .map(|&index| {
            display_values(
                extract_columns(&context.csv_b.rows[index], context.comp_selections_b),
                &context.config.normalization,
            )
        })
        .collect()
}

fn display_values(
    values: Vec<String>,
    normalization: &ComparisonNormalizationConfig,
) -> Vec<String> {
    values
        .into_iter()
        .map(|value| normalize_display_value(&value, normalization))
        .collect()
}

fn compare_single_match(
    key: Vec<String>,
    values_a: Vec<String>,
    values_b: Vec<String>,
    config: &ComparisonConfig,
) -> RowComparisonResult {
    let display_values_a = display_values(values_a.clone(), &config.normalization);
    let display_values_b = display_values(values_b.clone(), &config.normalization);
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
            values_a: display_values_a,
            values_b: display_values_b,
        }
    } else {
        RowComparisonResult::Mismatch {
            key,
            values_a: display_values_a,
            values_b: display_values_b,
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
