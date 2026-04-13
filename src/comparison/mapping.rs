use super::super::data::types::{ColumnMapping, MappingType};
use std::cmp::Ordering;
use std::collections::HashSet;
use strsim::{jaro_winkler, normalized_levenshtein};

/// Suggest column mappings between two sets of column names
pub fn suggest_mappings(columns_a: &[String], columns_b: &[String]) -> Vec<ColumnMapping> {
    let mut candidates = Vec::new();

    for (idx_a, col_a) in columns_a.iter().enumerate() {
        for (idx_b, col_b) in columns_b.iter().enumerate() {
            if let Some((score, mapping_type)) = score_mapping_candidate(col_a, col_b) {
                candidates.push((idx_a, idx_b, score, mapping_type));
            }
        }
    }

    // Highest confidence candidates first
    candidates.sort_by(|a, b| {
        b.2.partial_cmp(&a.2)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
            .then_with(|| a.1.cmp(&b.1))
    });

    let mut used_a = HashSet::new();
    let mut used_b = HashSet::new();
    let mut mappings = Vec::new();

    for (idx_a, idx_b, _score, mapping_type) in candidates {
        if used_a.contains(&idx_a) || used_b.contains(&idx_b) {
            continue;
        }

        mappings.push(ColumnMapping {
            file_a_column: columns_a[idx_a].clone(),
            file_b_column: columns_b[idx_b].clone(),
            mapping_type,
        });

        used_a.insert(idx_a);
        used_b.insert(idx_b);
    }

    mappings
}

fn score_mapping_candidate(col_a: &str, col_b: &str) -> Option<(f64, MappingType)> {
    // Strong exact match on raw value ignoring case
    if col_a.eq_ignore_ascii_case(col_b) {
        return Some((1.0, MappingType::ExactMatch));
    }

    let normalized_a = normalize_column_name(col_a);
    let normalized_b = normalize_column_name(col_b);
    let compact_a = normalized_a.replace(' ', "");
    let compact_b = normalized_b.replace(' ', "");

    // Equivalent after normalization (snake/camel/spacing differences)
    if normalized_a == normalized_b || compact_a == compact_b {
        return Some((0.98, MappingType::ExactMatch));
    }

    let tokens_a = tokenize_column_name(&normalized_a);
    let tokens_b = tokenize_column_name(&normalized_b);

    let lev = normalized_levenshtein(&normalized_a, &normalized_b);
    let jw = jaro_winkler(&normalized_a, &normalized_b);
    let token_overlap = token_jaccard(&tokens_a, &tokens_b);

    // Acronym compatibility helps with abbreviated identifiers.
    let acronym_a = acronym(&tokens_a);
    let acronym_b = acronym(&tokens_b);
    let acronym_bonus = if (!acronym_a.is_empty() && acronym_a == compact_b)
        || (!acronym_b.is_empty() && acronym_b == compact_a)
    {
        0.08
    } else {
        0.0
    };

    let mut score = (0.45 * jw) + (0.35 * lev) + (0.20 * token_overlap) + acronym_bonus;
    if score > 1.0 {
        score = 1.0;
    }

    // Conservative threshold to avoid over-mapping unrelated columns.
    if score >= 0.70 {
        Some((score, MappingType::FuzzyMatch(score)))
    } else {
        None
    }
}

fn normalize_column_name(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    let mut prev_was_lower_or_digit = false;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() && prev_was_lower_or_digit {
            normalized.push(' ');
        }

        if ch.is_ascii_alphanumeric() {
            normalized.push(ch.to_ascii_lowercase());
            prev_was_lower_or_digit = ch.is_ascii_lowercase() || ch.is_ascii_digit();
        } else {
            normalized.push(' ');
            prev_was_lower_or_digit = false;
        }
    }

    normalized.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn tokenize_column_name(normalized: &str) -> Vec<String> {
    normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn token_jaccard(tokens_a: &[String], tokens_b: &[String]) -> f64 {
    if tokens_a.is_empty() || tokens_b.is_empty() {
        return 0.0;
    }

    let set_a: HashSet<&str> = tokens_a.iter().map(|s| s.as_str()).collect();
    let set_b: HashSet<&str> = tokens_b.iter().map(|s| s.as_str()).collect();

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.union(&set_b).count();

    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

fn acronym(tokens: &[String]) -> String {
    tokens.iter().filter_map(|t| t.chars().next()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        let columns_a = vec!["Name".to_string(), "Age".to_string(), "City".to_string()];
        let columns_b = vec![
            "name".to_string(),
            "age".to_string(),
            "location".to_string(),
        ];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert_eq!(mappings.len(), 2);
        assert!(mappings
            .iter()
            .any(|m| m.mapping_type == MappingType::ExactMatch));
    }

    #[test]
    fn test_fuzzy_match() {
        let columns_a = vec!["alpha_num_code".to_string()];
        let columns_b = vec!["alpha_number_code".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert_eq!(mappings.len(), 1);
        assert!(mappings
            .iter()
            .any(|m| matches!(m.mapping_type, MappingType::FuzzyMatch(_))));
    }

    #[test]
    fn test_normalized_exact_match() {
        let columns_a = vec!["FirstName".to_string()];
        let columns_b = vec!["first_name".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert_eq!(mappings.len(), 1);
        assert!(matches!(mappings[0].mapping_type, MappingType::ExactMatch));
    }

    #[test]
    fn test_one_to_one_mapping() {
        let columns_a = vec!["left_key".to_string(), "right_key".to_string()];
        let columns_b = vec!["left_right_key".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        // Only one target column exists, so at most one mapping should be produced.
        assert_eq!(mappings.len(), 1);

        let unique_targets: HashSet<String> =
            mappings.iter().map(|m| m.file_b_column.clone()).collect();
        assert_eq!(unique_targets.len(), mappings.len());
    }

    #[test]
    fn test_no_match() {
        let columns_a = vec!["XYZ".to_string()];
        let columns_b = vec!["ABC".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert_eq!(mappings.len(), 0);
    }
}
