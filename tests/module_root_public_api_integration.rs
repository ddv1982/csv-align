use csv_align::api::{
    compare, create_session, delete_session, export_csv, health_check, load_csv_file,
    suggest_mappings, AppState, CompareRequest, ErrorResponse, HealthResponse, MappingRequest,
    SessionData, SessionResponse, SuggestMappingsRequest,
};
use csv_align::data::{
    detect_columns, export_results, export_results_to_bytes, export_results_to_bytes_with_config,
    export_results_with_config, load_csv, load_csv_from_bytes, ColumnDataType, ComparisonConfig,
    ComparisonNormalizationConfig, CsvData, RowComparisonResult,
};
use csv_align::presentation::{
    compare_response, file_load_response, suggest_mappings_response, ColumnResponse,
    CompareResponse, DifferenceResponse, FileLoadResponse, MappingResponse, ResultResponse,
    SuggestMappingsResponse, SummaryResponse,
};

#[test]
fn api_module_root_re_exports_legacy_entry_points() {
    let _app_state = AppState::new();
    let _session_data = SessionData::new();
    let _compare_request = CompareRequest {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["name".to_string()],
        column_mappings: vec![MappingRequest {
            file_a_column: "name".to_string(),
            file_b_column: "name".to_string(),
            mapping_type: "manual".to_string(),
            similarity: None,
        }],
        normalization: ComparisonNormalizationConfig::default(),
    };
    let _suggest_request = SuggestMappingsRequest {
        columns_a: vec!["name".to_string()],
        columns_b: vec!["name".to_string()],
    };
    let _session_response = SessionResponse {
        session_id: "session-1".to_string(),
    };
    let _health_response = HealthResponse {
        status: "ok".to_string(),
        version: "1.0.0".to_string(),
    };
    let _error_response = ErrorResponse {
        error: "nope".to_string(),
    };

    let _ = health_check;
    let _ = create_session;
    let _ = delete_session;
    let _ = load_csv_file;
    let _ = suggest_mappings;
    let _ = compare;
    let _ = export_csv;
}

#[test]
fn data_and_presentation_module_roots_re_export_legacy_entry_points() {
    let csv_data = load_csv_from_bytes(b"id,name\n1,Alice\n").unwrap();
    let _load_csv_fn = load_csv;
    let columns = detect_columns(&csv_data);
    assert_eq!(columns[0].data_type, ColumnDataType::Integer);

    let config = ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["name".to_string()],
        comparison_columns_b: vec!["name".to_string()],
        column_mappings: Vec::new(),
        normalization: ComparisonNormalizationConfig::default(),
    };
    let results = vec![RowComparisonResult::Match {
        key: vec!["1".to_string()],
        values_a: vec!["Alice".to_string()],
        values_b: vec!["Alice".to_string()],
    }];

    let bytes = export_results_to_bytes(&results).unwrap();
    assert!(!bytes.is_empty());
    let configured_bytes = export_results_to_bytes_with_config(&results, Some(&config)).unwrap();
    assert!(!configured_bytes.is_empty());

    let output = tempfile::NamedTempFile::new().unwrap();
    export_results(&results, output.path()).unwrap();
    export_results_with_config(&results, Some(&config), output.path()).unwrap();

    let file_response =
        file_load_response(csv_align::data::FileSide::A, csv_data.headers, &columns, 1);
    let mapping_response = suggest_mappings_response(&[]);
    let compare_response = compare_response(
        &results,
        &csv_align::data::ComparisonSummary {
            total_rows_a: 1,
            total_rows_b: 1,
            matches: 1,
            mismatches: 0,
            missing_left: 0,
            missing_right: 0,
            duplicates_a: 0,
            duplicates_b: 0,
        },
    );

    let _: FileLoadResponse = file_response;
    let _: SuggestMappingsResponse = mapping_response;
    let _: CompareResponse = compare_response;
    let _: Option<ColumnResponse> = None;
    let _: Option<MappingResponse> = None;
    let _: Option<ResultResponse> = None;
    let _: Option<DifferenceResponse> = None;
    let _: Option<SummaryResponse> = None;
    let _: CsvData = load_csv_from_bytes(b"id\n1\n").unwrap();
}
