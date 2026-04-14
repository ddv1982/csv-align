use std::fmt;

use serde::{Deserialize, Serialize};

use crate::data::types::{ComparisonConfig, ComparisonNormalizationConfig, RowComparisonResult};
use crate::presentation::responses::CompareResponse;

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
                write!(f, "{selection} reference missing columns: {}", columns.join(", "))
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
                write!(f, "{selection} contain duplicate columns: {}", columns.join(", "))
            }
            Self::InvalidMappings(message) | Self::InvalidSimilarity(message) => {
                f.write_str(message)
            }
        }
    }
}
