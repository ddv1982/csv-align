use std::borrow::Borrow;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

use crate::backend::error::CsvAlignError;
use crate::backend::requests::{CompareExecution, CompareRequest, SuggestMappingsRequest};
use crate::backend::session::SessionData;
use crate::backend::validation::build_comparison_config;
use crate::comparison::{engine, mapping};
use crate::data::{
    csv_loader, export as csv_export,
    types::{ComparisonConfig, CsvData, FileSide, RowComparisonResult},
};
use crate::presentation::responses::{
    FileLoadResponse, SuggestMappingsResponse, compare_response, file_load_response,
    suggest_mappings_response,
};

pub enum CsvLoadSource {
    FilePath(String),
    Bytes(Vec<u8>),
}

pub struct LoadedCsv {
    pub csv_data: CsvData,
    pub response: FileLoadResponse,
}

pub fn validate_file_letter(file_letter: &str) -> Result<(), CsvAlignError> {
    parse_file_side(file_letter).map(|_| ())
}

pub fn parse_file_side(file_letter: &str) -> Result<FileSide, CsvAlignError> {
    match file_letter {
        "a" => Ok(FileSide::A),
        "b" => Ok(FileSide::B),
        _ => Err(CsvAlignError::BadInput(
            "File letter must be 'a' or 'b'".to_string(),
        )),
    }
}

pub fn load_csv_workflow(
    file_letter: &str,
    file_name: Option<String>,
    source: CsvLoadSource,
) -> Result<LoadedCsv, CsvAlignError> {
    let file_side = parse_file_side(file_letter)?;

    let mut csv_data = match source {
        CsvLoadSource::FilePath(file_path) => {
            let mut file = std::fs::File::open(&file_path).map_err(|error| {
                CsvAlignError::Io(std::io::Error::new(
                    error.kind(),
                    format!("Failed to load CSV: {error}"),
                ))
            })?;
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes).map_err(|error| {
                CsvAlignError::Io(std::io::Error::new(
                    error.kind(),
                    format!("Failed to load CSV: {error}"),
                ))
            })?;
            csv_loader::load_csv_from_bytes(&bytes)
                .map_err(|error| CsvAlignError::Parse(format!("Failed to load CSV: {error}")))?
        }
        CsvLoadSource::Bytes(bytes) => csv_loader::load_csv_from_bytes(&bytes)
            .map_err(|error| CsvAlignError::Parse(format!("Failed to parse CSV bytes: {error}")))?,
    };

    if let Some(file_name) = file_name.filter(|value| !value.trim().is_empty()) {
        csv_data.file_path = Some(file_name);
    }

    let headers = csv_data.headers.clone();
    let columns = csv_loader::detect_columns(&csv_data);
    let row_count = csv_data.rows.len();
    let response = file_load_response(file_side, headers, &columns, row_count);

    Ok(LoadedCsv { csv_data, response })
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
        session_data.csv_a = Some(Arc::new(csv_data));
        session_data.columns_a = columns;
    } else {
        session_data.csv_b = Some(Arc::new(csv_data));
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
            session_data.csv_a.as_deref(),
            session_data.csv_b.as_deref(),
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
            session_data.csv_a.as_deref(),
            session_data.csv_b.as_deref(),
        ),
        None => mapping::suggest_mappings(&request.columns_a, &request.columns_b),
    };
    let response = suggest_mappings_response(&mappings);

    if let Some(session_data) = session_data {
        session_data.column_mappings = mappings;
    }

    response
}

pub fn comparison_inputs(
    session_data: &SessionData,
) -> Result<(Arc<CsvData>, Arc<CsvData>), CsvAlignError> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File A not selected or loaded".to_string()))?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File B not selected or loaded".to_string()))?;

    Ok((Arc::clone(csv_a), Arc::clone(csv_b)))
}

pub fn run_comparison(
    csv_a: impl Borrow<CsvData>,
    csv_b: impl Borrow<CsvData>,
    request: CompareRequest,
) -> Result<CompareExecution, CsvAlignError> {
    let csv_a = csv_a.borrow();
    let csv_b = csv_b.borrow();
    let config = build_comparison_config(csv_a, csv_b, request)?;
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
) -> Result<(Vec<RowComparisonResult>, Option<ComparisonConfig>), CsvAlignError> {
    if session_data.comparison_results.is_empty() {
        return Err(CsvAlignError::BadInput(
            "No comparison results to export. Run a comparison first.".to_string(),
        ));
    }

    Ok((
        session_data.comparison_results.clone(),
        session_data.comparison_config.clone(),
    ))
}

pub fn export_results_to_bytes(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
) -> Result<Vec<u8>, CsvAlignError> {
    csv_export::export_results_to_bytes(results, comparison_config)
        .map_err(|error| CsvAlignError::Internal(format!("Failed to build CSV export: {error}")))
}

pub fn write_export_results(
    results: &[RowComparisonResult],
    comparison_config: Option<&ComparisonConfig>,
    output_path: impl AsRef<Path>,
) -> Result<(), CsvAlignError> {
    csv_export::write_export_results(results, comparison_config, output_path)
        .map_err(|error| CsvAlignError::Internal(format!("Failed to export results: {error}")))
}
