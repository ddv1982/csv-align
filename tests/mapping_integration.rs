use std::collections::HashSet;

use csv_align::comparison::suggest_mappings;
use csv_align::data::MappingType;

#[test]
fn mapping_suggest_mappings_returns_exact_matches_for_case_insensitive_names() {
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
        .any(|mapping| mapping.mapping_type == MappingType::ExactMatch));
}

#[test]
fn mapping_suggest_mappings_returns_fuzzy_match_for_similar_identifiers() {
    let columns_a = vec!["alpha_num_code".to_string()];
    let columns_b = vec!["alpha_number_code".to_string()];

    let mappings = suggest_mappings(&columns_a, &columns_b);

    assert_eq!(mappings.len(), 1);
    assert!(matches!(
        mappings[0].mapping_type,
        MappingType::FuzzyMatch(_)
    ));
}

#[test]
fn mapping_suggest_mappings_treats_normalized_names_as_exact_matches() {
    let columns_a = vec!["FirstName".to_string()];
    let columns_b = vec!["first_name".to_string()];

    let mappings = suggest_mappings(&columns_a, &columns_b);

    assert_eq!(mappings.len(), 1);
    assert!(matches!(mappings[0].mapping_type, MappingType::ExactMatch));
}

#[test]
fn mapping_suggest_mappings_preserves_one_to_one_target_assignments() {
    let columns_a = vec!["left_key".to_string(), "right_key".to_string()];
    let columns_b = vec!["left_right_key".to_string()];

    let mappings = suggest_mappings(&columns_a, &columns_b);

    assert_eq!(mappings.len(), 1);

    let unique_targets: HashSet<String> = mappings
        .iter()
        .map(|mapping| mapping.file_b_column.clone())
        .collect();
    assert_eq!(unique_targets.len(), mappings.len());
}

#[test]
fn mapping_suggest_mappings_skips_unrelated_columns() {
    let columns_a = vec!["XYZ".to_string()];
    let columns_b = vec!["ABC".to_string()];

    let mappings = suggest_mappings(&columns_a, &columns_b);

    assert!(mappings.is_empty());
}
