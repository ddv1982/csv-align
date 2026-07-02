use super::super::data::types::*;
use super::rows::{
    FlexibleKeyMatch, KeyTokenCache, KeyedRows, classify_flexible_key_match, extract_columns,
    get_column_selections, get_missing_column_selections, split_rows_by_key_usable,
    wildcard_literal_count, wildcard_token_count,
};
use super::value_compare::{find_differences, normalize_display_value};
use crate::data::json_fields::ColumnSelection;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fmt;

pub(crate) const MAX_FLEXIBLE_KEY_CANDIDATES: usize = 10_000;
pub(crate) const MAX_FLEXIBLE_KEY_COMPARISONS: usize = 1_000_000;

/// Caps applied while planning flexible-key matching.
#[derive(Clone, Copy)]
pub(crate) struct FlexibleKeyLimits {
    pub(crate) comparisons: usize,
    pub(crate) candidates: usize,
}

impl FlexibleKeyLimits {
    pub(crate) const DEFAULT: Self = Self {
        comparisons: MAX_FLEXIBLE_KEY_COMPARISONS,
        candidates: MAX_FLEXIBLE_KEY_CANDIDATES,
    };

    const UNBOUNDED: Self = Self {
        comparisons: usize::MAX,
        candidates: usize::MAX,
    };
}

/// Which flexible-key limit a plan exceeded, with the bounded count that
/// tripped it (at most limit + 1, mirroring the previous bounded counters).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FlexibleKeyExcess {
    Comparisons(usize),
    Candidates(usize),
}

/// Everything derived from the inputs that both cap validation and the actual
/// comparison need: key splits, and (for flexible matching) the classified
/// candidate pairs. Building this once replaces the previous flow that split
/// and classified the same data up to four times per comparison run.
pub(crate) struct ComparisonPlan {
    key_selections_a: Vec<ColumnSelection>,
    key_selections_b: Vec<ColumnSelection>,
    comp_selections_a: Vec<ColumnSelection>,
    comp_selections_b: Vec<ColumnSelection>,
    map_a: HashMap<Vec<String>, KeyedRows>,
    map_b: HashMap<Vec<String>, KeyedRows>,
    nullish_rows_a: Vec<usize>,
    nullish_rows_b: Vec<usize>,
    flexible_candidates: Vec<FlexibleCandidate>,
    flexible_excess: Option<FlexibleKeyExcess>,
}

impl ComparisonPlan {
    pub(crate) fn build(
        csv_a: &CsvData,
        csv_b: &CsvData,
        config: &ComparisonConfig,
        limits: FlexibleKeyLimits,
    ) -> Result<Self, ComparisonColumnSelectionError> {
        let key_selections_a = required_column_selections(
            &csv_a.headers,
            &config.key_columns_a,
            "Key columns for File A",
        )?;
        let key_selections_b = required_column_selections(
            &csv_b.headers,
            &config.key_columns_b,
            "Key columns for File B",
        )?;
        let comp_selections_a = required_column_selections(
            &csv_a.headers,
            &config.comparison_columns_a,
            "Comparison columns for File A",
        )?;
        let comp_selections_b = required_column_selections(
            &csv_b.headers,
            &config.comparison_columns_b,
            "Comparison columns for File B",
        )?;

        let (map_a, nullish_rows_a) =
            split_rows_by_key_usable(csv_a, &key_selections_a, &config.normalization);
        let (map_b, nullish_rows_b) =
            split_rows_by_key_usable(csv_b, &key_selections_b, &config.normalization);

        let mut plan = Self {
            key_selections_a,
            key_selections_b,
            comp_selections_a,
            comp_selections_b,
            map_a,
            map_b,
            nullish_rows_a,
            nullish_rows_b,
            flexible_candidates: Vec::new(),
            flexible_excess: None,
        };

        if config.normalization.flexible_key_matching {
            plan.survey_flexible_candidates(limits);
        }

        Ok(plan)
    }

    pub(crate) fn flexible_excess(&self) -> Option<FlexibleKeyExcess> {
        self.flexible_excess
    }

    /// Classify every A×B key pair exactly once, keeping the same candidate
    /// filter as before: weak shared-text matches survive only when both keys
    /// have no other flexible match at all.
    fn survey_flexible_candidates(&mut self, limits: FlexibleKeyLimits) {
        if self.map_a.is_empty() || self.map_b.is_empty() {
            return;
        }

        if self.map_a.len() > limits.comparisons / self.map_b.len() {
            self.flexible_excess = Some(FlexibleKeyExcess::Comparisons(limits.comparisons + 1));
            return;
        }

        let token_cache = KeyTokenCache::for_keys(self.map_a.keys().chain(self.map_b.keys()));
        let rows_a: Vec<&KeyedRows> = self.map_a.values().collect();
        let rows_b: Vec<&KeyedRows> = self.map_b.values().collect();

        let mut classified: Vec<(usize, usize, FlexibleKeyMatch)> = Vec::new();
        let mut weak_by_a = vec![0usize; rows_a.len()];
        let mut weak_by_b = vec![0usize; rows_b.len()];
        let mut total_by_a = vec![0usize; rows_a.len()];
        let mut total_by_b = vec![0usize; rows_b.len()];

        for (index_a, keyed_rows_a) in rows_a.iter().enumerate() {
            for (index_b, keyed_rows_b) in rows_b.iter().enumerate() {
                let Some(match_kind) = classify_flexible_key_match(
                    &keyed_rows_a.normalized_key,
                    &keyed_rows_b.normalized_key,
                    &token_cache,
                ) else {
                    continue;
                };

                total_by_a[index_a] += 1;
                total_by_b[index_b] += 1;
                if match_kind == FlexibleKeyMatch::SharedTextToken {
                    weak_by_a[index_a] += 1;
                    weak_by_b[index_b] += 1;
                }

                classified.push((index_a, index_b, match_kind));
            }
        }

        let mut candidates = Vec::new();
        for (index_a, index_b, match_kind) in classified {
            let keep = match_kind != FlexibleKeyMatch::SharedTextToken
                || (weak_by_a[index_a] == 1
                    && weak_by_b[index_b] == 1
                    && total_by_a[index_a] == 1
                    && total_by_b[index_b] == 1);
            if !keep {
                continue;
            }

            if candidates.len() >= limits.candidates {
                self.flexible_excess = Some(FlexibleKeyExcess::Candidates(limits.candidates + 1));
                return;
            }

            let keyed_rows_a = rows_a[index_a];
            let keyed_rows_b = rows_b[index_b];
            candidates.push(FlexibleCandidate {
                key_a: keyed_rows_a.normalized_key.clone(),
                key_b: keyed_rows_b.normalized_key.clone(),
                match_kind,
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

        self.flexible_candidates = candidates;
    }

    pub(crate) fn execute(
        self,
        csv_a: &CsvData,
        csv_b: &CsvData,
        config: &ComparisonConfig,
    ) -> Vec<RowComparisonResult> {
        let mut results = Vec::new();
        let context = ComparisonContext {
            csv_a,
            csv_b,
            config,
            key_selections_a: &self.key_selections_a,
            key_selections_b: &self.key_selections_b,
            comp_selections_a: &self.comp_selections_a,
            comp_selections_b: &self.comp_selections_b,
        };

        for &row_index in &self.nullish_rows_a {
            push_unkeyed_right(&mut results, row_index, &context);
        }

        for &row_index in &self.nullish_rows_b {
            push_unkeyed_left(&mut results, row_index, &context);
        }

        if config.normalization.flexible_key_matching {
            compare_key_groups_flexible(
                &mut results,
                &self.map_a,
                &self.map_b,
                self.flexible_candidates,
                &context,
            );
        } else {
            compare_key_groups_exact(&mut results, &self.map_a, &self.map_b, &context);
        }

        results
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComparisonColumnSelectionError {
    pub selection: &'static str,
    pub columns: Vec<String>,
}

impl fmt::Display for ComparisonColumnSelectionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} reference missing columns: {}",
            self.selection,
            self.columns.join(", ")
        )
    }
}

impl std::error::Error for ComparisonColumnSelectionError {}

fn required_column_selections(
    headers: &[String],
    column_names: &[String],
    selection: &'static str,
) -> Result<Vec<ColumnSelection>, ComparisonColumnSelectionError> {
    let missing = get_missing_column_selections(headers, column_names);
    if missing.is_empty() {
        Ok(get_column_selections(headers, column_names))
    } else {
        Err(ComparisonColumnSelectionError {
            selection,
            columns: missing,
        })
    }
}

/// Compare two CSV datasets based on a prevalidated configuration.
///
/// Prefer [`try_compare_csv_data`] when the configuration comes from user input.
///
/// # Panics
///
/// Panics when the configuration references columns that are not present in the
/// provided CSV headers.
pub fn compare_csv_data(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: &ComparisonConfig,
) -> Vec<RowComparisonResult> {
    try_compare_csv_data(csv_a, csv_b, config).unwrap_or_else(|error| {
        panic!("Invalid comparison configuration: {error}");
    })
}

/// Compare two CSV datasets, returning an error when the configuration references unknown columns.
pub fn try_compare_csv_data(
    csv_a: &CsvData,
    csv_b: &CsvData,
    config: &ComparisonConfig,
) -> Result<Vec<RowComparisonResult>, ComparisonColumnSelectionError> {
    let plan = ComparisonPlan::build(csv_a, csv_b, config, FlexibleKeyLimits::UNBOUNDED)?;
    Ok(plan.execute(csv_a, csv_b, config))
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
    match_kind: FlexibleKeyMatch,
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

    let mut keyed_rows_a: Vec<(&Vec<String>, &KeyedRows)> = map_a.iter().collect();
    keyed_rows_a.sort_by(|left, right| compare_keyed_rows(left.1, right.1));

    // Process all keys from file A in source-row order for stable UI/export output.
    for (key, keyed_rows_a) in keyed_rows_a {
        if let Some(keyed_rows_b) = map_b.get(key) {
            processed_b.insert(key.clone());
            push_paired_group_results(results, keyed_rows_a, keyed_rows_b, context);
        } else {
            push_unmatched_a_results(results, keyed_rows_a, context);
        }
    }

    let mut keyed_rows_b: Vec<(&Vec<String>, &KeyedRows)> = map_b.iter().collect();
    keyed_rows_b.sort_by(|left, right| compare_keyed_rows(left.1, right.1));

    // Process keys only in File B in source-row order for stable UI/export output.
    for (key, keyed_rows_b) in keyed_rows_b {
        if processed_b.contains(key) {
            continue;
        }

        push_unmatched_b_results(results, keyed_rows_b, context);
    }
}

fn compare_keyed_rows(left: &KeyedRows, right: &KeyedRows) -> Ordering {
    left.first_index
        .cmp(&right.first_index)
        .then(left.normalized_key.cmp(&right.normalized_key))
}

fn compare_key_groups_flexible(
    results: &mut Vec<RowComparisonResult>,
    map_a: &HashMap<Vec<String>, KeyedRows>,
    map_b: &HashMap<Vec<String>, KeyedRows>,
    mut candidates: Vec<FlexibleCandidate>,
    context: &ComparisonContext,
) {
    let mut matched_a: HashSet<Vec<String>> = HashSet::new();
    let mut matched_b: HashSet<Vec<String>> = HashSet::new();

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
    unmatched_a.sort_by(|left, right| compare_keyed_rows(left, right));
    for keyed_rows_a in unmatched_a {
        push_unmatched_a_results(results, keyed_rows_a, context);
    }

    let mut unmatched_b: Vec<&KeyedRows> = map_b
        .iter()
        .filter_map(|(key, keyed_rows)| (!matched_b.contains(key)).then_some(keyed_rows))
        .collect();
    unmatched_b.sort_by(|left, right| compare_keyed_rows(left, right));
    for keyed_rows_b in unmatched_b {
        push_unmatched_b_results(results, keyed_rows_b, context);
    }
}

fn compare_flexible_candidate_preference(
    left: &FlexibleCandidate,
    right: &FlexibleCandidate,
) -> Ordering {
    right
        .match_kind
        .preference_rank()
        .cmp(&left.match_kind.preference_rank())
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
    // Degree per key over the full candidate list. A candidate whose keys both
    // have degree 1 is an isolated edge: it belongs to some maximum matching
    // and can never conflict, so it skips the expensive verification below.
    let mut degree_a: HashMap<&Vec<String>, usize> = HashMap::new();
    let mut degree_b: HashMap<&Vec<String>, usize> = HashMap::new();
    for candidate in candidates {
        *degree_a.entry(&candidate.key_a).or_default() += 1;
        *degree_b.entry(&candidate.key_b).or_default() += 1;
    }

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

        let is_isolated_edge = degree_a.get(&candidate.key_a) == Some(&1)
            && degree_b.get(&candidate.key_b) == Some(&1);

        if is_isolated_edge {
            selected_indices.push(candidate_index);
            selected_a.insert(candidate.key_a.clone());
            selected_b.insert(candidate.key_b.clone());
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
    // Paired rows intentionally use File A's display key as the canonical result key.
    // Flexible matching can pair different key shapes, so the left-side key preserves
    // the existing API/export contract while unmatched File B rows still show File B keys.
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
        return;
    }

    if keyed_rows_b.indices.len() > 1 {
        results.push(RowComparisonResult::Duplicate {
            key: keyed_rows_a.display_key.clone(),
            values_a: Vec::new(),
            values_b: comparison_display_values_b(keyed_rows_b, context),
        });
        return;
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
