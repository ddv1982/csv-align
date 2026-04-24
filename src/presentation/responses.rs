use crate::data::types::{
    ColumnDataType, ColumnInfo, ColumnMapping, ComparisonSummary, FileSide, MappingKind,
    MappingType, ResultType, RowComparisonResult, ValueDifference,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ColumnResponse {
    pub index: usize,
    pub name: String,
    pub data_type: ColumnDataType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileLoadResponse {
    pub success: bool,
    pub file_letter: FileSide,
    pub file_name: String,
    pub headers: Vec<String>,
    pub virtual_headers: Vec<String>,
    pub columns: Vec<ColumnResponse>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompareResponse {
    pub success: bool,
    pub results: Vec<ResultResponse>,
    pub summary: SummaryResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResultResponse {
    pub result_type: ResultType,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
    pub duplicate_values_a: Vec<Vec<String>>,
    pub duplicate_values_b: Vec<Vec<String>>,
    pub differences: Vec<DifferenceResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DifferenceResponse {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SummaryResponse {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SuggestMappingsResponse {
    pub mappings: Vec<MappingResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MappingResponse {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingKind,
    pub similarity: Option<f64>,
}

pub fn file_load_response(
    file_letter: FileSide,
    file_name: String,
    headers: Vec<String>,
    virtual_headers: Vec<String>,
    columns: &[ColumnInfo],
    row_count: usize,
) -> FileLoadResponse {
    FileLoadResponse {
        success: true,
        file_letter,
        file_name,
        headers,
        virtual_headers,
        columns: columns.iter().map(ColumnResponse::from).collect(),
        row_count,
    }
}

pub fn suggest_mappings_response(mappings: &[ColumnMapping]) -> SuggestMappingsResponse {
    SuggestMappingsResponse {
        mappings: mappings.iter().map(MappingResponse::from).collect(),
    }
}

pub fn compare_response(
    results: &[RowComparisonResult],
    summary: &ComparisonSummary,
) -> CompareResponse {
    CompareResponse {
        success: true,
        results: results.iter().map(ResultResponse::from).collect(),
        summary: SummaryResponse::from(summary),
    }
}

fn mapping_type_response(mapping_type: &MappingType) -> (MappingKind, Option<f64>) {
    match mapping_type {
        MappingType::ExactMatch => (MappingKind::Exact, None),
        MappingType::ManualMatch => (MappingKind::Manual, None),
        MappingType::FuzzyMatch(score) => (MappingKind::Fuzzy, Some(*score)),
    }
}

impl From<&ColumnInfo> for ColumnResponse {
    fn from(column: &ColumnInfo) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&ColumnMapping> for MappingResponse {
    fn from(mapping: &ColumnMapping) -> Self {
        let (mapping_type, similarity) = mapping_type_response(&mapping.mapping_type);

        Self {
            file_a_column: mapping.file_a_column.clone(),
            file_b_column: mapping.file_b_column.clone(),
            mapping_type,
            similarity,
        }
    }
}

impl From<&RowComparisonResult> for ResultResponse {
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
                .map(DifferenceResponse::from)
                .collect(),
        }
    }
}

impl From<&ValueDifference> for DifferenceResponse {
    fn from(difference: &ValueDifference) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&ComparisonSummary> for SummaryResponse {
    fn from(summary: &ComparisonSummary) -> Self {
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

impl From<SummaryResponse> for ComparisonSummary {
    fn from(summary: SummaryResponse) -> Self {
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
