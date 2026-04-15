use csv_align::comparison::suggest_mappings;
use csv_align::data::MappingType;

#[test]
fn mapping_suggest_mappings_matches_known_header_aliases_with_high_confidence() {
    let mappings = suggest_mappings(
        &["full_name".to_string(), "email_address".to_string()],
        &["display_name".to_string(), "email".to_string()],
    );

    let full_name_mapping = mappings
        .iter()
        .find(|mapping| mapping.file_a_column == "full_name")
        .expect("expected full_name mapping");
    assert_eq!(full_name_mapping.file_b_column, "display_name");
    assert!(matches!(
        full_name_mapping.mapping_type,
        MappingType::FuzzyMatch(score) if score >= 0.90
    ));

    let email_mapping = mappings
        .iter()
        .find(|mapping| mapping.file_a_column == "email_address")
        .expect("expected email_address mapping");
    assert_eq!(email_mapping.file_b_column, "email");
    assert!(matches!(
        email_mapping.mapping_type,
        MappingType::FuzzyMatch(score) if score >= 0.90
    ));
}

#[test]
fn mapping_suggest_mappings_keeps_distinct_name_variants_unmapped_without_alias_support() {
    let mappings = suggest_mappings(&["first_name".to_string()], &["last_name".to_string()]);

    assert!(mappings.is_empty());
}
