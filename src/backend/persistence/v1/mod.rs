use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::backend::error::CsvAlignError;
use crate::backend::requests::{
    CompareValidationError, ComparisonSnapshotFile, LoadComparisonSnapshotResponse,
    PairOrderSelection,
};
use crate::backend::session::SessionData;
use crate::backend::validation::validate_selected_columns_by_physical_or_virtual_source;
use crate::comparison::engine;
use crate::data::json_fields::label_has_physical_or_virtual_source;
use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData,
    MappingKind, MappingType, ResultType, RowComparisonResult, ValueDifference,
};
use crate::presentation::responses::{
    ColumnResponse, DifferenceResponse, MappingResponse, ResultResponse, SummaryResponse,
};

pub const SNAPSHOT_VERSION: u8 = 2;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotV1 {
    pub version: u8,
    pub file_a: SnapshotFileV1,
    pub file_b: SnapshotFileV1,
    pub selection: SelectionV1,
    pub mappings: Vec<MappingV1>,
    pub normalization: ComparisonNormalizationConfig,
    pub results: Vec<ResultV1>,
    pub summary: SummaryV1,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotFileV1 {
    pub name: String,
    pub headers: Vec<String>,
    pub columns: Vec<ColumnV1>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ColumnV1 {
    pub index: usize,
    pub name: String,
    pub data_type: crate::data::types::ColumnDataType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SelectionV1 {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MappingV1 {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingKind,
    pub similarity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResultV1 {
    pub result_type: ResultType,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
    pub duplicate_values_a: Vec<Vec<String>>,
    pub duplicate_values_b: Vec<Vec<String>>,
    pub differences: Vec<DifferenceV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DifferenceV1 {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SummaryV1 {
    pub total_rows_a: usize,
    pub total_rows_b: usize,
    pub matches: usize,
    pub mismatches: usize,
    pub missing_left: usize,
    pub missing_right: usize,
    pub unkeyed_left: usize,
    pub unkeyed_right: usize,
    pub duplicates_a: usize,
    pub duplicates_b: usize,
}

impl SnapshotV1 {
    pub fn from_session(session_data: &SessionData) -> Result<Self, CsvAlignError> {
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

        Ok(Self {
            version: SNAPSHOT_VERSION,
            file_a: SnapshotFileV1::from_csv(csv_a, &session_data.columns_a, "File A"),
            file_b: SnapshotFileV1::from_csv(csv_b, &session_data.columns_b, "File B"),
            selection: SelectionV1::from_config(comparison_config),
            mappings: comparison_config
                .column_mappings
                .iter()
                .map(MappingV1::from)
                .collect(),
            normalization: comparison_config.normalization.clone(),
            results: session_data
                .comparison_results
                .iter()
                .map(ResultV1::from)
                .collect(),
            summary: SummaryV1::from(&summary),
        })
    }

    pub fn to_load_response(
        &self,
        session_data: &mut SessionData,
    ) -> Result<LoadComparisonSnapshotResponse, CsvAlignError> {
        validate_snapshot(self)?;

        let comparison_results = self
            .results
            .iter()
            .map(ResultV1::to_row_comparison_result)
            .collect::<Result<Vec<_>, _>>()?;
        let comparison_config = self.to_comparison_config()?;

        session_data.csv_a = None;
        session_data.csv_b = None;
        session_data.columns_a = self.file_a.columns.iter().map(ColumnInfo::from).collect();
        session_data.columns_b = self.file_b.columns.iter().map(ColumnInfo::from).collect();
        session_data.column_mappings = comparison_config.column_mappings.clone();
        session_data.comparison_results = comparison_results;
        session_data.comparison_config = Some(comparison_config);

        Ok(LoadComparisonSnapshotResponse {
            file_a: ComparisonSnapshotFile::from(&self.file_a),
            file_b: ComparisonSnapshotFile::from(&self.file_b),
            selection: PairOrderSelection::from(&self.selection),
            mappings: self.mappings.iter().map(MappingResponse::from).collect(),
            normalization: self.normalization.clone(),
            results: self.results.iter().map(ResultResponse::from).collect(),
            summary: SummaryResponse::from(&self.summary),
        })
    }

    pub fn to_comparison_config(&self) -> Result<ComparisonConfig, CsvAlignError> {
        Ok(ComparisonConfig {
            key_columns_a: self.selection.key_columns_a.clone(),
            key_columns_b: self.selection.key_columns_b.clone(),
            comparison_columns_a: self.selection.comparison_columns_a.clone(),
            comparison_columns_b: self.selection.comparison_columns_b.clone(),
            column_mappings: self
                .mappings
                .iter()
                .map(MappingV1::to_column_mapping)
                .collect::<Result<Vec<_>, _>>()?,
            normalization: self.normalization.clone(),
        })
    }
}

impl SnapshotFileV1 {
    fn from_csv(csv: &CsvData, columns: &[ColumnInfo], fallback_name: &str) -> Self {
        Self {
            name: display_name(csv.file_path.as_deref(), fallback_name),
            headers: csv.headers.clone(),
            columns: columns.iter().map(ColumnV1::from).collect(),
            row_count: csv.rows.len(),
        }
    }
}

impl SelectionV1 {
    fn from_config(config: &ComparisonConfig) -> Self {
        Self {
            key_columns_a: config.key_columns_a.clone(),
            key_columns_b: config.key_columns_b.clone(),
            comparison_columns_a: config.comparison_columns_a.clone(),
            comparison_columns_b: config.comparison_columns_b.clone(),
        }
    }
}

impl MappingV1 {
    fn to_column_mapping(&self) -> Result<ColumnMapping, CsvAlignError> {
        let mapping_type = match self.mapping_type {
            MappingKind::Exact => MappingType::ExactMatch,
            MappingKind::Manual => MappingType::ManualMatch,
            MappingKind::Fuzzy => MappingType::FuzzyMatch(self.similarity.ok_or_else(|| {
                CsvAlignError::BadInput(format!(
                    "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                    self.file_a_column, self.file_b_column
                ))
            })?),
        };

        Ok(ColumnMapping {
            file_a_column: self.file_a_column.clone(),
            file_b_column: self.file_b_column.clone(),
            mapping_type,
        })
    }
}

impl ResultV1 {
    fn to_row_comparison_result(&self) -> Result<RowComparisonResult, CsvAlignError> {
        let differences = self.differences.iter().map(ValueDifference::from).collect();

        Ok(match self.result_type {
            ResultType::Match => RowComparisonResult::Match {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::Mismatch => RowComparisonResult::Mismatch {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
                values_b: self.values_b.clone(),
                differences,
            },
            ResultType::MissingLeft => RowComparisonResult::MissingLeft {
                key: self.key.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::MissingRight => RowComparisonResult::MissingRight {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
            },
            ResultType::UnkeyedLeft => RowComparisonResult::UnkeyedLeft {
                key: self.key.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::UnkeyedRight => RowComparisonResult::UnkeyedRight {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
            },
            ResultType::DuplicateFileA | ResultType::DuplicateFileB | ResultType::DuplicateBoth => {
                RowComparisonResult::Duplicate {
                    key: self.key.clone(),
                    values_a: self.duplicate_values_a.clone(),
                    values_b: self.duplicate_values_b.clone(),
                }
            }
        })
    }
}

fn display_name(file_path: Option<&str>, fallback_name: &str) -> String {
    file_path
        .and_then(|path| Path::new(path).file_name())
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| fallback_name.to_string())
}

fn validate_snapshot(snapshot: &SnapshotV1) -> Result<(), CsvAlignError> {
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
        .map(ResultV1::to_row_comparison_result)
        .collect::<Result<Vec<_>, _>>()?;
    let generated_summary = engine::generate_summary(
        &comparison_results,
        snapshot.file_a.row_count,
        snapshot.file_b.row_count,
    );

    if generated_summary != snapshot.summary.clone().into() {
        return Err(CsvAlignError::BadInput(
            "Saved comparison snapshot summary does not match the persisted results".to_string(),
        ));
    }

    Ok(())
}

fn validate_selection(
    headers_a: &[String],
    headers_b: &[String],
    selection: &SelectionV1,
) -> Result<(), CsvAlignError> {
    validate_saved_selected_columns(
        "Saved snapshot key columns for File A",
        headers_a,
        &selection.key_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot key columns for File B",
        headers_b,
        &selection.key_columns_b,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot comparison columns for File A",
        headers_a,
        &selection.comparison_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot comparison columns for File B",
        headers_b,
        &selection.comparison_columns_b,
    )?;

    if selection.key_columns_a.len() != selection.key_columns_b.len() {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot key columns for File A and File B must contain the same number of columns"
                .to_string(),
        ));
    }

    if selection.comparison_columns_a.len() != selection.comparison_columns_b.len() {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot comparison columns for File A and File B must contain the same number of columns"
                .to_string(),
        ));
    }

    Ok(())
}

fn validate_saved_selected_columns(
    label: &'static str,
    headers: &[String],
    selected_columns: &[String],
) -> Result<(), CsvAlignError> {
    validate_selected_columns_by_physical_or_virtual_source(label, headers, selected_columns)
        .map_err(saved_selection_validation_error)
}

fn validate_mappings(
    headers_a: &[String],
    headers_b: &[String],
    mappings: &[MappingV1],
) -> Result<(), CsvAlignError> {
    for mapping in mappings {
        if !label_has_physical_or_virtual_source(headers_a, &mapping.file_a_column) {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot mappings reference missing File A column: {}",
                mapping.file_a_column
            )));
        }

        if !label_has_physical_or_virtual_source(headers_b, &mapping.file_b_column) {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot mappings reference missing File B column: {}",
                mapping.file_b_column
            )));
        }

        if matches!(mapping.mapping_type, MappingKind::Fuzzy) && mapping.similarity.is_none() {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                mapping.file_a_column, mapping.file_b_column
            )));
        }
    }

    Ok(())
}

fn saved_selection_validation_error(error: CompareValidationError) -> CsvAlignError {
    match error {
        CompareValidationError::MissingColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} reference missing columns: {}",
                columns.join(", ")
            ))
        }
        CompareValidationError::DuplicateColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} contain duplicate columns: {}",
                columns.join(", ")
            ))
        }
        other => CsvAlignError::Validation(other),
    }
}

impl From<&ColumnInfo> for ColumnV1 {
    fn from(column: &ColumnInfo) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&ColumnV1> for ColumnInfo {
    fn from(column: &ColumnV1) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&ColumnV1> for ColumnResponse {
    fn from(column: &ColumnV1) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&SnapshotFileV1> for ComparisonSnapshotFile {
    fn from(file: &SnapshotFileV1) -> Self {
        Self {
            name: file.name.clone(),
            headers: file.headers.clone(),
            columns: file.columns.iter().map(ColumnResponse::from).collect(),
            row_count: file.row_count,
        }
    }
}

impl From<&SelectionV1> for PairOrderSelection {
    fn from(selection: &SelectionV1) -> Self {
        Self {
            key_columns_a: selection.key_columns_a.clone(),
            key_columns_b: selection.key_columns_b.clone(),
            comparison_columns_a: selection.comparison_columns_a.clone(),
            comparison_columns_b: selection.comparison_columns_b.clone(),
        }
    }
}

impl From<&MappingV1> for MappingResponse {
    fn from(mapping: &MappingV1) -> Self {
        Self {
            file_a_column: mapping.file_a_column.clone(),
            file_b_column: mapping.file_b_column.clone(),
            mapping_type: mapping.mapping_type,
            similarity: mapping.similarity,
        }
    }
}

impl From<&ColumnMapping> for MappingV1 {
    fn from(mapping: &ColumnMapping) -> Self {
        let (mapping_type, similarity) = match mapping.mapping_type {
            MappingType::ExactMatch => (MappingKind::Exact, None),
            MappingType::ManualMatch => (MappingKind::Manual, None),
            MappingType::FuzzyMatch(score) => (MappingKind::Fuzzy, Some(score)),
        };

        Self {
            file_a_column: mapping.file_a_column.clone(),
            file_b_column: mapping.file_b_column.clone(),
            mapping_type,
            similarity,
        }
    }
}

impl From<&ValueDifference> for DifferenceV1 {
    fn from(difference: &ValueDifference) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&DifferenceV1> for DifferenceResponse {
    fn from(difference: &DifferenceV1) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&DifferenceV1> for ValueDifference {
    fn from(difference: &DifferenceV1) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&RowComparisonResult> for ResultV1 {
    fn from(result: &RowComparisonResult) -> Self {
        Self {
            result_type: result.result_type(),
            key: result.key().to_vec(),
            values_a: result.values_a().to_vec(),
            values_b: result.values_b().to_vec(),
            duplicate_values_a: result.duplicate_values_a().to_vec(),
            duplicate_values_b: result.duplicate_values_b().to_vec(),
            differences: result
                .differences()
                .iter()
                .map(DifferenceV1::from)
                .collect(),
        }
    }
}

impl From<&ResultV1> for ResultResponse {
    fn from(result: &ResultV1) -> Self {
        Self {
            result_type: result.result_type,
            key: result.key.clone(),
            values_a: result.values_a.clone(),
            values_b: result.values_b.clone(),
            duplicate_values_a: result.duplicate_values_a.clone(),
            duplicate_values_b: result.duplicate_values_b.clone(),
            differences: result
                .differences
                .iter()
                .map(DifferenceResponse::from)
                .collect(),
        }
    }
}

impl From<&crate::data::types::ComparisonSummary> for SummaryV1 {
    fn from(summary: &crate::data::types::ComparisonSummary) -> Self {
        Self {
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
        }
    }
}

impl From<SummaryV1> for crate::data::types::ComparisonSummary {
    fn from(summary: SummaryV1) -> Self {
        Self {
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
        }
    }
}

impl From<&SummaryV1> for SummaryResponse {
    fn from(summary: &SummaryV1) -> Self {
        Self {
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
        }
    }
}
