use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonSummary, DuplicateSource, MappingType,
    RowComparisonResult, ValueDifference,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ColumnResponse {
    pub index: usize,
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub file_letter: String,
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
    pub result_type: String,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
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
    pub mapping_type: String,
    pub similarity: Option<f64>,
}

pub fn upload_response(
    file_letter: impl Into<String>,
    headers: Vec<String>,
    columns: &[ColumnInfo],
    row_count: usize,
) -> UploadResponse {
    UploadResponse {
        success: true,
        file_letter: file_letter.into(),
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
        data_type: format!("{:?}", column.data_type),
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
            result_type: "match".to_string(),
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: values_b.clone(),
            differences: Vec::new(),
        },
        RowComparisonResult::Mismatch {
            key,
            values_a,
            values_b,
            differences,
        } => ResultResponse {
            result_type: "mismatch".to_string(),
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: values_b.clone(),
            differences: differences.iter().map(difference_response).collect(),
        },
        RowComparisonResult::MissingLeft { key, values_b } => ResultResponse {
            result_type: "missing_left".to_string(),
            key: key.clone(),
            values_a: Vec::new(),
            values_b: values_b.clone(),
            differences: Vec::new(),
        },
        RowComparisonResult::MissingRight { key, values_a } => ResultResponse {
            result_type: "missing_right".to_string(),
            key: key.clone(),
            values_a: values_a.clone(),
            values_b: Vec::new(),
            differences: Vec::new(),
        },
        RowComparisonResult::Duplicate {
            key,
            source,
            values,
        } => ResultResponse {
            result_type: duplicate_result_type(source),
            key: key.clone(),
            values_a: values.first().cloned().unwrap_or_default(),
            values_b: values.get(1).cloned().unwrap_or_default(),
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
        duplicates_a: summary.duplicates_a,
        duplicates_b: summary.duplicates_b,
    }
}

fn mapping_type_response(mapping_type: &MappingType) -> (String, Option<f64>) {
    match mapping_type {
        MappingType::ExactMatch => ("exact".to_string(), None),
        MappingType::ManualMatch => ("manual".to_string(), None),
        MappingType::FuzzyMatch(score) => ("fuzzy".to_string(), Some(*score)),
    }
}

fn duplicate_result_type(source: &DuplicateSource) -> String {
    format!("duplicate_{source:?}").to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn suggest_mappings_payload_shape_is_stable() {
        let mappings = vec![
            ColumnMapping {
                file_a_column: "id".to_string(),
                file_b_column: "ID".to_string(),
                mapping_type: MappingType::ExactMatch,
            },
            ColumnMapping {
                file_a_column: "postal_code".to_string(),
                file_b_column: "zipCode".to_string(),
                mapping_type: MappingType::FuzzyMatch(0.82),
            },
        ];

        let response = suggest_mappings_response(&mappings);

        assert_eq!(
            serde_json::to_value(response).unwrap(),
            json!({
                "mappings": [
                    {
                        "file_a_column": "id",
                        "file_b_column": "ID",
                        "mapping_type": "exact",
                        "similarity": null
                    },
                    {
                        "file_a_column": "postal_code",
                        "file_b_column": "zipCode",
                        "mapping_type": "fuzzy",
                        "similarity": 0.82
                    }
                ]
            })
        );
    }

    #[test]
    fn compare_payload_shape_for_match_is_stable() {
        assert_compare_shape(
            RowComparisonResult::Match {
                key: vec!["1".to_string()],
                values_a: vec!["Alice".to_string()],
                values_b: vec!["Alice".to_string()],
            },
            json!({
                "success": true,
                "results": [{
                    "result_type": "match",
                    "key": ["1"],
                    "values_a": ["Alice"],
                    "values_b": ["Alice"],
                    "differences": []
                }],
                "summary": default_summary_json()
            }),
        );
    }

    #[test]
    fn compare_payload_shape_for_mismatch_is_stable() {
        assert_compare_shape(
            RowComparisonResult::Mismatch {
                key: vec!["1".to_string()],
                values_a: vec!["Alice".to_string()],
                values_b: vec!["Alicia".to_string()],
                differences: vec![ValueDifference {
                    column_a: "name".to_string(),
                    column_b: "full_name".to_string(),
                    value_a: "Alice".to_string(),
                    value_b: "Alicia".to_string(),
                }],
            },
            json!({
                "success": true,
                "results": [{
                    "result_type": "mismatch",
                    "key": ["1"],
                    "values_a": ["Alice"],
                    "values_b": ["Alicia"],
                    "differences": [{
                        "column_a": "name",
                        "column_b": "full_name",
                        "value_a": "Alice",
                        "value_b": "Alicia"
                    }]
                }],
                "summary": default_summary_json()
            }),
        );
    }

    #[test]
    fn compare_payload_shape_for_missing_rows_is_stable() {
        assert_compare_shape(
            RowComparisonResult::MissingLeft {
                key: vec!["1".to_string()],
                values_b: vec!["only in b".to_string()],
            },
            json!({
                "success": true,
                "results": [{
                    "result_type": "missing_left",
                    "key": ["1"],
                    "values_a": [],
                    "values_b": ["only in b"],
                    "differences": []
                }],
                "summary": default_summary_json()
            }),
        );

        assert_compare_shape(
            RowComparisonResult::MissingRight {
                key: vec!["2".to_string()],
                values_a: vec!["only in a".to_string()],
            },
            json!({
                "success": true,
                "results": [{
                    "result_type": "missing_right",
                    "key": ["2"],
                    "values_a": ["only in a"],
                    "values_b": [],
                    "differences": []
                }],
                "summary": default_summary_json()
            }),
        );
    }

    #[test]
    fn compare_payload_shape_for_duplicate_rows_is_stable() {
        assert_compare_shape(
            RowComparisonResult::Duplicate {
                key: vec!["dup".to_string()],
                source: DuplicateSource::Both,
                values: vec![
                    vec!["A1".to_string(), "A2".to_string()],
                    vec!["B1".to_string(), "B2".to_string()],
                ],
            },
            json!({
                "success": true,
                "results": [{
                    "result_type": "duplicate_both",
                    "key": ["dup"],
                    "values_a": ["A1", "A2"],
                    "values_b": ["B1", "B2"],
                    "differences": []
                }],
                "summary": default_summary_json()
            }),
        );
    }

    fn assert_compare_shape(result: RowComparisonResult, expected: serde_json::Value) {
        let response = compare_response(&[result], &default_summary());
        assert_eq!(serde_json::to_value(response).unwrap(), expected);
    }

    fn default_summary() -> ComparisonSummary {
        ComparisonSummary {
            total_rows_a: 1,
            total_rows_b: 1,
            matches: 0,
            mismatches: 0,
            missing_left: 0,
            missing_right: 0,
            duplicates_a: 0,
            duplicates_b: 0,
        }
    }

    fn default_summary_json() -> serde_json::Value {
        json!({
            "total_rows_a": 1,
            "total_rows_b": 1,
            "matches": 0,
            "mismatches": 0,
            "missing_left": 0,
            "missing_right": 0,
            "duplicates_a": 0,
            "duplicates_b": 0
        })
    }
}
