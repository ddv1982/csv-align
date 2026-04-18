use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::backend::error::CsvAlignError;
use crate::backend::requests::{
    ComparisonSnapshotFile, LoadComparisonSnapshotResponse, PairOrderSelection,
};
use crate::backend::session::SessionData;
use crate::backend::validation::audit_selected_columns;
use crate::comparison::engine;
use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData,
    MappingType, ResultType, RowComparisonResult, ValueDifference,
};
use crate::presentation::responses::{
    ColumnResponse, DifferenceResponse, MappingResponse, ResultResponse, SummaryResponse,
};

const COMPARISON_SNAPSHOT_FILE_VERSION: u8 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct PersistedComparisonSnapshot {
    version: u8,
    file_a: ComparisonSnapshotFile,
    file_b: ComparisonSnapshotFile,
    selection: PairOrderSelection,
    mappings: Vec<MappingResponse>,
    normalization: ComparisonNormalizationConfig,
    results: Vec<ResultResponse>,
    summary: SummaryResponse,
}

pub fn save_comparison_snapshot_workflow(
    session_data: &SessionData,
) -> Result<String, CsvAlignError> {
    let persisted = build_persisted_snapshot(session_data)?;

    serde_json::to_string_pretty(&persisted).map_err(|error| {
        CsvAlignError::Internal(format!("Failed to serialize comparison snapshot: {error}"))
    })
}

pub fn load_comparison_snapshot_workflow(
    session_data: &mut SessionData,
    contents: &str,
) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
    let persisted: PersistedComparisonSnapshot =
        serde_json::from_str(contents).map_err(|error| {
            CsvAlignError::Parse(format!("Failed to parse comparison snapshot file: {error}"))
        })?;

    if persisted.version != COMPARISON_SNAPSHOT_FILE_VERSION {
        return Err(CsvAlignError::BadInput(format!(
            "Unsupported comparison snapshot file version {}",
            persisted.version
        )));
    }

    validate_snapshot(&persisted)?;

    let comparison_results = persisted
        .results
        .iter()
        .map(result_response_to_row_comparison_result)
        .collect::<Result<Vec<_>, _>>()?;
    let comparison_config = comparison_config_from_snapshot(&persisted)?;

    session_data.csv_a = None;
    session_data.csv_b = None;
    session_data.columns_a = persisted
        .file_a
        .columns
        .iter()
        .map(column_response_to_column_info)
        .collect();
    session_data.columns_b = persisted
        .file_b
        .columns
        .iter()
        .map(column_response_to_column_info)
        .collect();
    session_data.column_mappings = comparison_config.column_mappings.clone();
    session_data.comparison_results = comparison_results;
    session_data.comparison_config = Some(comparison_config);

    Ok(LoadComparisonSnapshotResponse {
        file_a: persisted.file_a,
        file_b: persisted.file_b,
        selection: persisted.selection,
        mappings: persisted.mappings,
        normalization: persisted.normalization,
        results: persisted.results,
        summary: persisted.summary,
    })
}

fn build_persisted_snapshot(
    session_data: &SessionData,
) -> Result<PersistedComparisonSnapshot, CsvAlignError> {
    let csv_a = session_data
        .csv_a
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File A not selected or loaded".to_string()))?;
    let csv_b = session_data
        .csv_b
        .as_ref()
        .ok_or_else(|| CsvAlignError::BadInput("File B not selected or loaded".to_string()))?;
    let comparison_config = session_data.comparison_config.as_ref().ok_or_else(|| {
        CsvAlignError::BadInput(
            "No comparison results to save. Run a comparison first.".to_string(),
        )
    })?;

    let summary = engine::generate_summary(
        &session_data.comparison_results,
        csv_a.rows.len(),
        csv_b.rows.len(),
    );

    Ok(PersistedComparisonSnapshot {
        version: COMPARISON_SNAPSHOT_FILE_VERSION,
        file_a: snapshot_file(csv_a, &session_data.columns_a, "File A"),
        file_b: snapshot_file(csv_b, &session_data.columns_b, "File B"),
        selection: PairOrderSelection {
            key_columns_a: comparison_config.key_columns_a.clone(),
            key_columns_b: comparison_config.key_columns_b.clone(),
            comparison_columns_a: comparison_config.comparison_columns_a.clone(),
            comparison_columns_b: comparison_config.comparison_columns_b.clone(),
        },
        mappings: comparison_config
            .column_mappings
            .iter()
            .map(mapping_response)
            .collect(),
        normalization: comparison_config.normalization.clone(),
        results: session_data
            .comparison_results
            .iter()
            .map(result_response)
            .collect(),
        summary: SummaryResponse {
            total_rows_a: summary.total_rows_a,
            total_rows_b: summary.total_rows_b,
            matches: summary.matches,
            mismatches: summary.mismatches,
            missing_left: summary.missing_left,
            missing_right: summary.missing_right,
            unkeyed_left: summary.unkeyed_left,
            unkeyed_right: summary.unkeyed_right,
            duplicates_a: summary.duplicates_a,
            duplicates_b: summary.duplicates_b,
        },
    })
}

fn validate_snapshot(snapshot: &PersistedComparisonSnapshot) -> Result<(), CsvAlignError> {
    validate_selection(
        &snapshot.file_a.headers,
        &snapshot.file_b.headers,
        &snapshot.selection,
    )?;
    validate_mappings(
        &snapshot.file_a.headers,
        &snapshot.file_b.headers,
        &snapshot.mappings,
    )?;

    let comparison_results = snapshot
        .results
        .iter()
        .map(result_response_to_row_comparison_result)
        .collect::<Result<Vec<_>, _>>()?;
    let generated_summary = engine::generate_summary(
        &comparison_results,
        snapshot.file_a.row_count,
        snapshot.file_b.row_count,
    );

    let expected_summary = &snapshot.summary;
    if generated_summary.total_rows_a != expected_summary.total_rows_a
        || generated_summary.total_rows_b != expected_summary.total_rows_b
        || generated_summary.matches != expected_summary.matches
        || generated_summary.mismatches != expected_summary.mismatches
        || generated_summary.missing_left != expected_summary.missing_left
        || generated_summary.missing_right != expected_summary.missing_right
        || generated_summary.unkeyed_left != expected_summary.unkeyed_left
        || generated_summary.unkeyed_right != expected_summary.unkeyed_right
        || generated_summary.duplicates_a != expected_summary.duplicates_a
        || generated_summary.duplicates_b != expected_summary.duplicates_b
    {
        return Err(CsvAlignError::BadInput(
            "Saved comparison snapshot summary does not match the persisted results".to_string(),
        ));
    }

    Ok(())
}

fn snapshot_file(
    csv: &CsvData,
    columns: &[ColumnInfo],
    fallback_name: &str,
) -> ComparisonSnapshotFile {
    ComparisonSnapshotFile {
        name: display_name(csv.file_path.as_deref(), fallback_name),
        headers: csv.headers.clone(),
        columns: columns.iter().map(column_response).collect(),
        row_count: csv.rows.len(),
    }
}

fn display_name(file_path: Option<&str>, fallback_name: &str) -> String {
    file_path
        .and_then(|path| Path::new(path).file_name())
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| fallback_name.to_string())
}

fn validate_selection(
    headers_a: &[String],
    headers_b: &[String],
    selection: &PairOrderSelection,
) -> Result<(), CsvAlignError> {
    validate_selected_columns(
        "Saved snapshot key columns for File A",
        headers_a,
        &selection.key_columns_a,
    )?;
    validate_selected_columns(
        "Saved snapshot key columns for File B",
        headers_b,
        &selection.key_columns_b,
    )?;
    validate_selected_columns(
        "Saved snapshot comparison columns for File A",
        headers_a,
        &selection.comparison_columns_a,
    )?;
    validate_selected_columns(
        "Saved snapshot comparison columns for File B",
        headers_b,
        &selection.comparison_columns_b,
    )?;

    if selection.key_columns_a.len() != selection.key_columns_b.len() {
        return Err(
            CsvAlignError::BadInput(
                "Saved snapshot key columns for File A and File B must contain the same number of columns"
                    .to_string(),
            ),
        );
    }

    if selection.comparison_columns_a.len() != selection.comparison_columns_b.len() {
        return Err(CsvAlignError::BadInput("Saved snapshot comparison columns for File A and File B must contain the same number of columns".to_string()));
    }

    Ok(())
}

fn validate_selected_columns(
    label: &'static str,
    headers: &[String],
    selected_columns: &[String],
) -> Result<(), CsvAlignError> {
    let audit = audit_selected_columns(headers, selected_columns);

    if let Some(column) = audit.missing.first() {
        return Err(CsvAlignError::BadInput(format!(
            "{label} reference missing columns: {column}"
        )));
    }

    if let Some(column) = audit.duplicates.first() {
        return Err(CsvAlignError::BadInput(format!(
            "{label} contain duplicate columns: {column}"
        )));
    }

    Ok(())
}

fn validate_mappings(
    headers_a: &[String],
    headers_b: &[String],
    mappings: &[MappingResponse],
) -> Result<(), CsvAlignError> {
    for mapping in mappings {
        if !headers_a
            .iter()
            .any(|header| header == &mapping.file_a_column)
        {
            return Err(format!(
                "Saved snapshot mappings reference missing File A column: {}",
                mapping.file_a_column
            )
            .into());
        }

        if !headers_b
            .iter()
            .any(|header| header == &mapping.file_b_column)
        {
            return Err(format!(
                "Saved snapshot mappings reference missing File B column: {}",
                mapping.file_b_column
            )
            .into());
        }

        if matches!(mapping.mapping_type, crate::data::types::MappingKind::Fuzzy)
            && mapping.similarity.is_none()
        {
            return Err(format!(
                "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                mapping.file_a_column, mapping.file_b_column
            )
            .into());
        }
    }

    Ok(())
}

fn comparison_config_from_snapshot(
    snapshot: &PersistedComparisonSnapshot,
) -> Result<ComparisonConfig, CsvAlignError> {
    Ok(ComparisonConfig {
        key_columns_a: snapshot.selection.key_columns_a.clone(),
        key_columns_b: snapshot.selection.key_columns_b.clone(),
        comparison_columns_a: snapshot.selection.comparison_columns_a.clone(),
        comparison_columns_b: snapshot.selection.comparison_columns_b.clone(),
        column_mappings: snapshot
            .mappings
            .iter()
            .map(mapping_response_to_column_mapping)
            .collect::<Result<Vec<_>, _>>()?,
        normalization: snapshot.normalization.clone(),
    })
}

fn mapping_response_to_column_mapping(
    mapping: &MappingResponse,
) -> Result<ColumnMapping, CsvAlignError> {
    let mapping_type = match mapping.mapping_type {
        crate::data::types::MappingKind::Exact => MappingType::ExactMatch,
        crate::data::types::MappingKind::Manual => MappingType::ManualMatch,
        crate::data::types::MappingKind::Fuzzy => {
            MappingType::FuzzyMatch(mapping.similarity.ok_or_else(|| {
                CsvAlignError::BadInput(format!(
                    "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                    mapping.file_a_column, mapping.file_b_column
                ))
            })?)
        }
    };

    Ok(ColumnMapping {
        file_a_column: mapping.file_a_column.clone(),
        file_b_column: mapping.file_b_column.clone(),
        mapping_type,
    })
}

fn result_response_to_row_comparison_result(
    result: &ResultResponse,
) -> Result<RowComparisonResult, CsvAlignError> {
    let differences = result
        .differences
        .iter()
        .map(difference_response_to_value_difference)
        .collect();

    Ok(match result.result_type {
        ResultType::Match => RowComparisonResult::Match {
            key: result.key.clone(),
            values_a: result.values_a.clone(),
            values_b: result.values_b.clone(),
        },
        ResultType::Mismatch => RowComparisonResult::Mismatch {
            key: result.key.clone(),
            values_a: result.values_a.clone(),
            values_b: result.values_b.clone(),
            differences,
        },
        ResultType::MissingLeft => RowComparisonResult::MissingLeft {
            key: result.key.clone(),
            values_b: result.values_b.clone(),
        },
        ResultType::MissingRight => RowComparisonResult::MissingRight {
            key: result.key.clone(),
            values_a: result.values_a.clone(),
        },
        ResultType::UnkeyedLeft => RowComparisonResult::UnkeyedLeft {
            key: result.key.clone(),
            values_b: result.values_b.clone(),
        },
        ResultType::UnkeyedRight => RowComparisonResult::UnkeyedRight {
            key: result.key.clone(),
            values_a: result.values_a.clone(),
        },
        ResultType::DuplicateFileA | ResultType::DuplicateFileB | ResultType::DuplicateBoth => {
            RowComparisonResult::Duplicate {
                key: result.key.clone(),
                values_a: result.duplicate_values_a.clone(),
                values_b: result.duplicate_values_b.clone(),
            }
        }
    })
}

fn column_response_to_column_info(column: &ColumnResponse) -> ColumnInfo {
    ColumnInfo {
        index: column.index,
        name: column.name.clone(),
        data_type: column.data_type.clone(),
    }
}

fn difference_response_to_value_difference(difference: &DifferenceResponse) -> ValueDifference {
    ValueDifference {
        column_a: difference.column_a.clone(),
        column_b: difference.column_b.clone(),
        value_a: difference.value_a.clone(),
        value_b: difference.value_b.clone(),
    }
}

fn column_response(column: &ColumnInfo) -> ColumnResponse {
    ColumnResponse {
        index: column.index,
        name: column.name.clone(),
        data_type: column.data_type.clone(),
    }
}

fn mapping_response(mapping: &ColumnMapping) -> MappingResponse {
    let (mapping_type, similarity) = match mapping.mapping_type {
        MappingType::ExactMatch => (crate::data::types::MappingKind::Exact, None),
        MappingType::ManualMatch => (crate::data::types::MappingKind::Manual, None),
        MappingType::FuzzyMatch(score) => (crate::data::types::MappingKind::Fuzzy, Some(score)),
    };

    MappingResponse {
        file_a_column: mapping.file_a_column.clone(),
        file_b_column: mapping.file_b_column.clone(),
        mapping_type,
        similarity,
    }
}

fn result_response(result: &RowComparisonResult) -> ResultResponse {
    ResultResponse {
        result_type: result.result_type(),
        key: result.key().to_vec(),
        values_a: result.values_a().to_vec(),
        values_b: result.values_b().to_vec(),
        duplicate_values_a: result.duplicate_values_a().to_vec(),
        duplicate_values_b: result.duplicate_values_b().to_vec(),
        differences: result
            .differences()
            .iter()
            .map(difference_response)
            .collect(),
    }
}

fn difference_response(difference: &ValueDifference) -> DifferenceResponse {
    DifferenceResponse {
        column_a: difference.column_a.clone(),
        column_b: difference.column_b.clone(),
        value_a: difference.value_a.clone(),
        value_b: difference.value_b.clone(),
    }
}
