use csv_align::backend::{
    apply_csv_to_session, suggest_mappings_workflow, SessionData, SuggestMappingsRequest,
};
use csv_align::comparison::suggest_mappings;
use csv_align::data::csv_loader;
use csv_align::data::types::FileSide;

#[test]
fn mapping_suggestions_use_loaded_column_values_when_headers_do_not_match() {
    let mut session = SessionData::new();

    let csv_a = csv_loader::load_csv_from_bytes(
        b"legacy_id,legacy_name,legacy_sire,legacy_status,legacy_phase,legacy_score\n101,Alpha,Bull A,open,open,10\n102,Beta,Bull B,closed,closed,11\n103,Gamma,Bull C,open,pending,12\n104,Delta,Bull D,closed,open,10\n",
    )
    .expect("csv a should parse");
    let csv_b = csv_loader::load_csv_from_bytes(
        b"animal_number,animal_name,sire_name,lifecycle,workflow_phase,rank_value\n101,Alpha,Bull A,active,open,10\n102,Beta,Bull B,inactive,closed,11\n103,Gamma,Bull C,active,pending,12\n104,Delta,Bull D,inactive,open,10\n",
    )
    .expect("csv b should parse");

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let response = suggest_mappings_workflow(
        Some(&mut session),
        &SuggestMappingsRequest {
            columns_a: vec![
                "legacy_id".to_string(),
                "legacy_name".to_string(),
                "legacy_sire".to_string(),
                "legacy_status".to_string(),
                "legacy_phase".to_string(),
                "legacy_score".to_string(),
            ],
            columns_b: vec![
                "animal_number".to_string(),
                "animal_name".to_string(),
                "sire_name".to_string(),
                "lifecycle".to_string(),
                "workflow_phase".to_string(),
                "rank_value".to_string(),
            ],
        },
    );

    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "legacy_id"
            && mapping.file_b_column == "animal_number"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "legacy_name"
            && mapping.file_b_column == "animal_name"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "legacy_sire"
            && mapping.file_b_column == "sire_name"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(!response
        .mappings
        .iter()
        .any(|mapping| mapping.file_a_column == "legacy_status"));
    assert!(!response
        .mappings
        .iter()
        .any(|mapping| mapping.file_a_column == "legacy_phase"));
    assert!(!response
        .mappings
        .iter()
        .any(|mapping| mapping.file_a_column == "legacy_score"));
}

#[test]
fn header_only_mapping_still_leaves_unreliable_headers_unmatched_without_instance_data() {
    let mappings = suggest_mappings(
        &[
            "legacy_id".to_string(),
            "legacy_name".to_string(),
            "legacy_sire".to_string(),
        ],
        &[
            "animal_number".to_string(),
            "animal_name".to_string(),
            "sire_name".to_string(),
        ],
    );

    assert!(mappings.is_empty());
}
