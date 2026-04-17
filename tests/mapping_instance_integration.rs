use csv_align::backend::{
    SessionData, SuggestMappingsRequest, apply_csv_to_session, suggest_mappings_workflow,
};
use csv_align::comparison::suggest_mappings;
use csv_align::data::csv_loader;
use csv_align::data::types::FileSide;

#[test]
fn mapping_suggestions_use_loaded_column_values_when_headers_do_not_match() {
    let mut session = SessionData::new();

    let csv_a = csv_loader::load_csv_from_bytes(
        b"source_id,display_label,group_label,status_flag,review_phase,score_bucket\n101,Alpha,Group A,open,open,10\n102,Beta,Group B,closed,closed,11\n103,Gamma,Group C,open,pending,12\n104,Delta,Group D,closed,open,10\n",
    )
    .expect("csv a should parse");
    let csv_b = csv_loader::load_csv_from_bytes(
        b"external_key,public_name,category_name,lifecycle_state,workflow_phase,rank_value\n101,Alpha,Group A,active,open,10\n102,Beta,Group B,inactive,closed,11\n103,Gamma,Group C,active,pending,12\n104,Delta,Group D,inactive,open,10\n",
    )
    .expect("csv b should parse");

    apply_csv_to_session(&mut session, FileSide::A, csv_a);
    apply_csv_to_session(&mut session, FileSide::B, csv_b);

    let response = suggest_mappings_workflow(
        Some(&mut session),
        &SuggestMappingsRequest {
            columns_a: vec![
                "source_id".to_string(),
                "display_label".to_string(),
                "group_label".to_string(),
                "status_flag".to_string(),
                "review_phase".to_string(),
                "score_bucket".to_string(),
            ],
            columns_b: vec![
                "external_key".to_string(),
                "public_name".to_string(),
                "category_name".to_string(),
                "lifecycle_state".to_string(),
                "workflow_phase".to_string(),
                "rank_value".to_string(),
            ],
        },
    );

    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "source_id"
            && mapping.file_b_column == "external_key"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "display_label"
            && mapping.file_b_column == "public_name"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(response.mappings.iter().any(|mapping| {
        mapping.file_a_column == "group_label"
            && mapping.file_b_column == "category_name"
            && mapping.similarity.unwrap_or_default() >= 0.85
    }));
    assert!(
        !response
            .mappings
            .iter()
            .any(|mapping| mapping.file_a_column == "status_flag")
    );
    assert!(
        !response
            .mappings
            .iter()
            .any(|mapping| mapping.file_a_column == "review_phase")
    );
    assert!(
        !response
            .mappings
            .iter()
            .any(|mapping| mapping.file_a_column == "score_bucket")
    );
}

#[test]
fn header_only_mapping_still_leaves_unreliable_headers_unmatched_without_instance_data() {
    let mappings = suggest_mappings(
        &[
            "source_id".to_string(),
            "display_label".to_string(),
            "group_label".to_string(),
        ],
        &[
            "external_key".to_string(),
            "public_name".to_string(),
            "category_name".to_string(),
        ],
    );

    assert!(mappings.is_empty());
}
