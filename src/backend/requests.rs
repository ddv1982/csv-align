use std::fmt;

use serde::{Deserialize, Serialize};

use crate::data::types::{ComparisonConfig, ComparisonNormalizationConfig, RowComparisonResult};
use crate::presentation::responses::{
    ColumnResponse, CompareResponse, MappingResponse, ResultResponse, SummaryResponse,
};

#[derive(Debug, Clone, Deserialize)]
pub struct MappingRequest {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: String,
    pub similarity: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CompareRequest {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
    pub column_mappings: Vec<MappingRequest>,
    #[serde(default)]
    pub normalization: ComparisonNormalizationConfig,
}

#[derive(Debug, Deserialize)]
pub struct SuggestMappingsRequest {
    pub columns_a: Vec<String>,
    pub columns_b: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PairOrderSelection {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SavePairOrderRequest {
    pub selection: PairOrderSelection,
}

#[derive(Debug, Deserialize)]
pub struct LoadPairOrderRequest {
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LoadPairOrderResponse {
    pub selection: PairOrderSelection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ComparisonSnapshotFile {
    pub name: String,
    pub headers: Vec<String>,
    #[serde(default)]
    pub virtual_headers: Vec<String>,
    pub columns: Vec<ColumnResponse>,
    pub row_count: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoadComparisonSnapshotRequest {
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoadComparisonSnapshotResponse {
    pub file_a: ComparisonSnapshotFile,
    pub file_b: ComparisonSnapshotFile,
    pub selection: PairOrderSelection,
    pub mappings: Vec<MappingResponse>,
    pub normalization: ComparisonNormalizationConfig,
    pub results: Vec<ResultResponse>,
    pub summary: SummaryResponse,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionResponse {
    pub session_id: String,
}

#[derive(Debug)]
pub struct CompareExecution {
    pub response: CompareResponse,
    pub results: Vec<RowComparisonResult>,
    pub config: ComparisonConfig,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompareValidationError {
    UnknownMappingType(String),
    MissingColumns {
        selection: &'static str,
        columns: Vec<String>,
    },
    EmptyColumns(&'static str),
    MismatchedColumnCounts {
        selection_a: &'static str,
        count_a: usize,
        selection_b: &'static str,
        count_b: usize,
    },
    DuplicateColumns {
        selection: &'static str,
        columns: Vec<String>,
    },
    InvalidMappings(String),
    InvalidSimilarity(String),
}

impl fmt::Display for CompareValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownMappingType(mapping_type) => {
                write!(
                    f,
                    "Unknown mapping type '{mapping_type}'. Expected one of: exact, manual, fuzzy"
                )
            }
            Self::MissingColumns { selection, columns } => {
                write!(
                    f,
                    "{selection} reference missing columns: {}",
                    columns.join(", ")
                )
            }
            Self::EmptyColumns(selection) => {
                write!(f, "{selection} must include at least one column")
            }
            Self::MismatchedColumnCounts {
                selection_a,
                count_a,
                selection_b,
                count_b,
            } => write!(
                f,
                "{selection_a} and {selection_b} must contain the same number of columns (got {count_a} and {count_b})"
            ),
            Self::DuplicateColumns { selection, columns } => {
                write!(
                    f,
                    "{selection} contain duplicate columns: {}",
                    columns.join(", ")
                )
            }
            Self::InvalidMappings(message) | Self::InvalidSimilarity(message) => {
                f.write_str(message)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CompareRequest;

    #[test]
    fn compare_request_defaults_normalization_when_omitted() {
        let request: CompareRequest = serde_json::from_value(serde_json::json!({
            "key_columns_a": ["id"],
            "key_columns_b": ["id"],
            "comparison_columns_a": ["value"],
            "comparison_columns_b": ["value"],
            "column_mappings": []
        }))
        .expect("compare request should deserialize");

        assert!(request.normalization.treat_empty_as_null);
        assert_eq!(
            request.normalization.null_tokens,
            vec!["null", "na", "n/a", "none"]
        );
        assert!(request.normalization.null_token_case_insensitive);
        assert!(!request.normalization.case_insensitive);
        assert!(!request.normalization.trim_whitespace);
        assert!(!request.normalization.numeric_equivalence);
        assert!(!request.normalization.decimal_rounding.enabled);
        assert_eq!(request.normalization.decimal_rounding.decimals, 0);
        assert_eq!(
            request.normalization.date_normalization.formats,
            vec!["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y"]
        );
        assert!(!request.normalization.date_normalization.enabled);
    }
}
