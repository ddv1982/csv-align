use super::super::data::types::{ColumnMapping, MappingType};
use strsim::normalized_levenshtein;

/// Suggest column mappings between two sets of column names
pub fn suggest_mappings(columns_a: &[String], columns_b: &[String]) -> Vec<ColumnMapping> {
    let mut mappings = Vec::new();

    // First pass: exact matches
    for col_a in columns_a {
        for col_b in columns_b {
            if col_a.to_lowercase() == col_b.to_lowercase() {
                mappings.push(ColumnMapping {
                    file_a_column: col_a.clone(),
                    file_b_column: col_b.clone(),
                    mapping_type: MappingType::ExactMatch,
                });
            }
        }
    }

    // Second pass: fuzzy matches for remaining columns
    let mapped_a: Vec<String> = mappings.iter().map(|m| m.file_a_column.clone()).collect();
    let mapped_b: Vec<String> = mappings.iter().map(|m| m.file_b_column.clone()).collect();

    for col_a in columns_a {
        if mapped_a.contains(col_a) {
            continue;
        }

        let mut best_match: Option<(&String, f64)> = None;

        for col_b in columns_b {
            if mapped_b.contains(col_b) {
                continue;
            }

            let similarity = normalized_levenshtein(&col_a.to_lowercase(), &col_b.to_lowercase());

            if similarity > 0.7 {
                // 70% similarity threshold
                if best_match.is_none() || similarity > best_match.unwrap().1 {
                    best_match = Some((col_b, similarity));
                }
            }
        }

        if let Some((matched_col, similarity)) = best_match {
            mappings.push(ColumnMapping {
                file_a_column: col_a.clone(),
                file_b_column: matched_col.clone(),
                mapping_type: MappingType::FuzzyMatch(similarity),
            });
        }
    }

    mappings
}

/// Get columns that couldn't be mapped
pub fn get_unmapped_columns(
    columns: &[String],
    mappings: &[ColumnMapping],
    is_file_a: bool,
) -> Vec<String> {
    let mapped_columns: Vec<&String> = if is_file_a {
        mappings.iter().map(|m| &m.file_a_column).collect()
    } else {
        mappings.iter().map(|m| &m.file_b_column).collect()
    };

    columns
        .iter()
        .filter(|col| !mapped_columns.contains(col))
        .cloned()
        .collect()
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
        let columns_a = vec!["FirstName".to_string(), "LastName".to_string()];
        let columns_b = vec!["first_name".to_string(), "surname".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert!(mappings.len() > 0);
        assert!(mappings
            .iter()
            .any(|m| matches!(m.mapping_type, MappingType::FuzzyMatch(_))));
    }

    #[test]
    fn test_no_match() {
        let columns_a = vec!["XYZ".to_string()];
        let columns_b = vec!["ABC".to_string()];

        let mappings = suggest_mappings(&columns_a, &columns_b);

        assert_eq!(mappings.len(), 0);
    }
}
