use serde::{Deserialize, Serialize};

/// Represents a loaded CSV file with its metadata
#[derive(Debug, Clone)]
pub struct CsvData {
    pub file_path: Option<String>,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Information about a column in a CSV file
#[derive(Debug, Clone)]
pub struct ColumnInfo {
    pub index: usize,
    pub name: String,
    pub data_type: ColumnDataType,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColumnDataType {
    String,
    Integer,
    Float,
    Date,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileSide {
    A,
    B,
}

impl FileSide {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::A => "a",
            Self::B => "b",
        }
    }
}

/// Mapping between columns in file A and file B
#[derive(Debug, Clone)]
pub struct ColumnMapping {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MappingKind {
    Exact,
    Manual,
    Fuzzy,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MappingType {
    ExactMatch,
    ManualMatch,
    FuzzyMatch(f64), // similarity score
}

impl MappingType {
    pub fn kind(&self) -> MappingKind {
        match self {
            Self::ExactMatch => MappingKind::Exact,
            Self::ManualMatch => MappingKind::Manual,
            Self::FuzzyMatch(_) => MappingKind::Fuzzy,
        }
    }
}

/// Configuration for comparison
#[derive(Debug, Clone)]
pub struct ComparisonConfig {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
    pub column_mappings: Vec<ColumnMapping>,
    pub normalization: ComparisonNormalizationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DateNormalizationConfig {
    pub enabled: bool,
    pub formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonNormalizationConfig {
    pub treat_empty_as_null: bool,
    pub null_tokens: Vec<String>,
    pub null_token_case_insensitive: bool,
    pub case_insensitive: bool,
    pub trim_whitespace: bool,
    pub date_normalization: DateNormalizationConfig,
}

impl Default for ComparisonNormalizationConfig {
    fn default() -> Self {
        Self {
            treat_empty_as_null: false,
            null_tokens: Vec::new(),
            null_token_case_insensitive: true,
            case_insensitive: false,
            trim_whitespace: false,
            date_normalization: DateNormalizationConfig::default(),
        }
    }
}

/// Result of comparing two rows
#[derive(Debug, Clone, PartialEq)]
pub enum RowComparisonResult {
    Match {
        key: Vec<String>,
        values_a: Vec<String>,
        values_b: Vec<String>,
    },
    Mismatch {
        key: Vec<String>,
        values_a: Vec<String>,
        values_b: Vec<String>,
        differences: Vec<ValueDifference>,
    },
    MissingLeft {
        key: Vec<String>,
        values_b: Vec<String>,
    },
    MissingRight {
        key: Vec<String>,
        values_a: Vec<String>,
    },
    UnkeyedLeft {
        key: Vec<String>,
        values_b: Vec<String>,
    },
    UnkeyedRight {
        key: Vec<String>,
        values_a: Vec<String>,
    },
    Duplicate {
        key: Vec<String>,
        values_a: Vec<Vec<String>>,
        values_b: Vec<Vec<String>>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum ResultType {
    #[serde(rename = "match")]
    Match,
    #[serde(rename = "mismatch")]
    Mismatch,
    #[serde(rename = "missing_left")]
    MissingLeft,
    #[serde(rename = "missing_right")]
    MissingRight,
    #[serde(rename = "unkeyed_left")]
    UnkeyedLeft,
    #[serde(rename = "unkeyed_right")]
    UnkeyedRight,
    #[serde(rename = "duplicate_filea")]
    DuplicateFileA,
    #[serde(rename = "duplicate_fileb")]
    DuplicateFileB,
    #[serde(rename = "duplicate_both")]
    DuplicateBoth,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValueDifference {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DuplicateSource {
    FileA,
    FileB,
    Both,
}

impl DuplicateSource {
    pub fn from_duplicate_rows(values_a: &[Vec<String>], values_b: &[Vec<String>]) -> Option<Self> {
        match (values_a.is_empty(), values_b.is_empty()) {
            (false, true) => Some(Self::FileA),
            (true, false) => Some(Self::FileB),
            (false, false) => Some(Self::Both),
            (true, true) => None,
        }
    }
}

/// Summary statistics of comparison results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonSummary {
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
