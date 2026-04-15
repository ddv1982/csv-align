use std::path::Path;

use crate::backend::requests::{CompareExecution, CompareRequest, SuggestMappingsRequest};
use crate::backend::session::SessionData;
use crate::backend::validation::build_comparison_config;
use crate::comparison::{engine, mapping};
use crate::data::{
    csv_loader, export as csv_export,
    types::{ComparisonConfig, CsvData, FileSide, RowComparisonResult},
};
use crate::presentation::responses::{
    compare_response, file_load_response, suggest_mappings_response, FileLoadResponse,
    SuggestMappingsResponse,
};

pub fn validate_file_letter(file_letter: &str) -> Result<(), String> {
    parse_file_side(file_letter).map(|_| ())
}

pub fn parse_file_side(file_letter: &str) -> Result<FileSide, String> {
    match file_letter {
        "a" => Ok(FileSide::A),
        "b" => Ok(FileSide::B),
        _ => Err("File letter must be 'a' or 'b'".to_string()),
    }
}

pub fn apply_csv_to_session(
    session_data: &mut SessionData,
    file_letter: FileSide,
    csv_data: CsvData,
) -> FileLoadResponse {
    let headers = csv_data.headers.clone();
    let columns = csv_loader::detect_columns(&csv_data);
    let row_count = csv_data.rows.len();
    let response = file_load_response(file_letter, headers, &columns, row_count);

    if file_letter == FileSide::A {
        session_data.csv_a = Some(csv_data);
        session_data.columns_a = columns;
    } else {
        session_data.csv_b = Some(csv_data);
        session_data.columns_b = columns;
    }

    if session_data.csv_a.is_some() && session_data.csv_b.is_some() {
        let col_names_a: Vec<String> = session_data
            .columns_a
            .iter()
            .map(|c| c.name.clone())
            .collect();
        let col_names_b: Vec<String> = session_data
            .columns_b
            .iter()
            .map(|c| c.name.clone())
            .collect();
        session_data.column_mappings = mapping::suggest_mappings_with_data(
            &col_names_a,
            &col_names_b,
            session_data.csv_a.as_ref(),
            session_data.csv_b.as_ref(),
        );
    }

    response
}

pub fn suggest_mappings_workflow(
    session_data: Option<&mut SessionData>,
    request: &SuggestMappingsRequest,
) -> SuggestMappingsResponse {
    let mappings = match session_data.as_deref() {
        Some(session_data) => mapping::suggest_mappings_with_data(
            &request.columns_a,
            &request.columns_b,
            session_data.csv_a.as_ref(),
            session_data.csv_b.as_ref(),
        ),
        None => mapping::suggest_mappings(&request.columns_a, &request.columns_b),
    };
    let response = suggest_mappings_response(&mappings);

    if let Some(session_data) = session_data {
        session_data.column_mappings = mappings;
    }

    response
}

pub fn comparison_inputs(session_data: &SessionData) -> Result<(CsvData, CsvData), String> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| "File A not selected or loaded".to_string())?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| "File B not selected or loaded".to_string())?;

    Ok((csv_a.clone(), csv_b.clone()))
}

pub fn run_comparison(
    csv_a: &CsvData,
    csv_b: &CsvData,
    request: CompareRequest,
) -> Result<CompareExecution, String> {
    let config =
        build_comparison_config(csv_a, csv_b, request).map_err(|error| error.to_string())?;
    let results = engine::compare_csv_data(csv_a, csv_b, &config);
    let summary = engine::generate_summary(&results, csv_a.rows.len(), csv_b.rows.len());

    Ok(CompareExecution {
        response: compare_response(&results, &summary),
        results,
        config,
    })
}

pub fn export_session_results_snapshot(
    session_data: &SessionData,
) -> Result<(Vec<RowComparisonResult>, Option<ComparisonConfig>), String> {
    if session_data.comparison_results.is_empty() {
        return Err("No comparison results to export. Run a comparison first.".to_string());
    }

    Ok((
        session_data.comparison_results.clone(),
        session_data.comparison_config.clone(),
    ))
}

pub fn export_results_to_bytes(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
) -> Result<Vec<u8>, String> {
    csv_export::export_results_to_bytes_with_config(results, comparison_config)
        .map_err(|e| format!("Failed to build CSV export: {e}"))
}

pub fn write_export_results(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
    output_path: impl AsRef<Path>,
) -> Result<(), String> {
    csv_export::export_results_with_config(results, comparison_config, output_path)
        .map_err(|e| format!("Failed to export results: {e}"))
}
