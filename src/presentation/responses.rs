use crate::data::types::{
    ColumnDataType, ColumnInfo, ColumnMapping, ComparisonSummary, DuplicateSource, FileSide,
    MappingKind, MappingType, ResultType, RowComparisonResult, ValueDifference,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ColumnResponse {
    pub index: usize,
    pub name: String,
    pub data_type: ColumnDataType,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileLoadResponse {
    pub success: bool,
    pub file_letter: FileSide,
    pub headers: Vec<String>,
    pub columns: Vec<ColumnResponse>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompareResponse {
    pub success: bool,
    pub results: Vec<ResultResponse>,
    pub summary: SummaryResponse,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResultResponse {
    pub result_type: ResultType,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
    pub duplicate_values_a: Vec<Vec<String>>,
    pub duplicate_values_b: Vec<Vec<String>>,
    pub differences: Vec<DifferenceResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DifferenceResponse {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct SuggestMappingsResponse {
    pub mappings: Vec<MappingResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MappingResponse {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingKind,
    pub similarity: Option<f64>,
}

pub fn file_load_response(
    file_letter: FileSide,
    headers: Vec<String>,
    columns: &[ColumnInfo],
    row_count: usize,
) -> FileLoadResponse {
    FileLoadResponse {
        success: true,
        file_letter,
        headers,
        columns: columns.iter().map(column_response).collect(),
        row_count,
    }
}

pub fn suggest_mappings_response(mappings: &[ColumnMapping]) -> SuggestMappingsResponse {
    SuggestMappingsResponse {
        mappings: mappings.iter().map(mapping_response).collect(),
    }
}

pub fn compare_response(
    results: &[RowComparisonResult],
    summary: &ComparisonSummary,
) -> CompareResponse {
    CompareResponse {
        success: true,
        results: results.iter().map(result_response).collect(),
        summary: summary_response(summary),
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
    let (mapping_type, similarity) = mapping_type_response(&mapping.mapping_type);

    MappingResponse {
        file_a_column: mapping.file_a_column.clone(),
        file_b_column: mapping.file_b_column.clone(),
        mapping_type,
        similarity,
    }
}

fn result_response(result: &RowComparisonResult) -> ResultResponse {
    match result {
        RowComparisonResult::Match {
            key,
            values_a,
            values_b,
        } => ResultResponse {
            result_type: ResultType::Match,
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: values_b.clone(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::Mismatch {
            key,
            values_a,
            values_b,
            differences,
        } => ResultResponse {
            result_type: ResultType::Mismatch,
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: values_b.clone(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: differences.iter().map(difference_response).collect(),
        },
        RowComparisonResult::MissingLeft { key, values_b } => ResultResponse {
            result_type: ResultType::MissingLeft,
            key: key.clone(),
            values_a: Vec::new(),
            values_b: values_b.clone(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::MissingRight { key, values_a } => ResultResponse {
            result_type: ResultType::MissingRight,
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: Vec::new(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::UnkeyedLeft { key, values_b } => ResultResponse {
            result_type: ResultType::UnkeyedLeft,
            key: key.clone(),
            values_a: Vec::new(),
            values_b: values_b.clone(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::UnkeyedRight { key, values_a } => ResultResponse {
            result_type: ResultType::UnkeyedRight,
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: Vec::new(),
            duplicate_values_a: Vec::new(),
            duplicate_values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::Duplicate {
            key,
            values_a,
            values_b,
        } => ResultResponse {
            result_type: duplicate_result_type(values_a, values_b),
            key: key.clone(),
            values_a: values_a.first().cloned().unwrap_or_default(),
            values_b: values_b.first().cloned().unwrap_or_default(),
            duplicate_values_a: values_a.clone(),
            duplicate_values_b: values_b.clone(),
            differences: Vec::new(),
        },
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

fn summary_response(summary: &ComparisonSummary) -> SummaryResponse {
    SummaryResponse {
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

fn mapping_type_response(mapping_type: &MappingType) -> (MappingKind, Option<f64>) {
    match mapping_type {
        MappingType::ExactMatch => (MappingKind::Exact, None),
        MappingType::ManualMatch => (MappingKind::Manual, None),
        MappingType::FuzzyMatch(score) => (MappingKind::Fuzzy, Some(*score)),
    }
}

fn duplicate_result_type(values_a: &[Vec<String>], values_b: &[Vec<String>]) -> ResultType {
    match DuplicateSource::from_duplicate_rows(values_a, values_b) {
        Some(DuplicateSource::FileA) => ResultType::DuplicateFileA,
        Some(DuplicateSource::FileB) => ResultType::DuplicateFileB,
        Some(DuplicateSource::Both) | None => ResultType::DuplicateBoth,
    }
}
