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

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DateNormalizationConfig {
    pub enabled: bool,
    pub formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DecimalRoundingConfig {
    pub enabled: bool,
    #[serde(default)]
    pub decimals: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ComparisonNormalizationConfig {
    pub treat_empty_as_null: bool,
    pub null_tokens: Vec<String>,
    pub null_token_case_insensitive: bool,
    #[serde(default)]
    pub flexible_key_matching: bool,
    pub case_insensitive: bool,
    pub trim_whitespace: bool,
    #[serde(default)]
    pub numeric_equivalence: bool,
    #[serde(default)]
    pub decimal_rounding: DecimalRoundingConfig,
    pub date_normalization: DateNormalizationConfig,
}

impl Default for ComparisonNormalizationConfig {
    fn default() -> Self {
        Self {
            treat_empty_as_null: true,
            null_tokens: vec![
                "null".to_string(),
                "na".to_string(),
                "n/a".to_string(),
                "none".to_string(),
            ],
            null_token_case_insensitive: true,
            flexible_key_matching: false,
            case_insensitive: false,
            trim_whitespace: false,
            numeric_equivalence: false,
            decimal_rounding: DecimalRoundingConfig {
                enabled: false,
                decimals: 0,
            },
            date_normalization: DateNormalizationConfig {
                enabled: false,
                formats: vec![
                    "%Y-%m-%d".to_string(),
                    "%d/%m/%Y".to_string(),
                    "%m/%d/%Y".to_string(),
                    "%d-%m-%Y".to_string(),
                    "%m-%d-%Y".to_string(),
                ],
            },
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResultType {
    Match,
    Mismatch,
    MissingLeft,
    MissingRight,
    UnkeyedLeft,
    UnkeyedRight,
    DuplicateFileA,
    DuplicateFileB,
    DuplicateBoth,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValueDifference {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

const EMPTY_VALUES: &[String] = &[];
const EMPTY_DUPLICATE_VALUES: &[Vec<String>] = &[];
const EMPTY_DIFFERENCES: &[ValueDifference] = &[];

impl RowComparisonResult {
    pub fn key(&self) -> &[String] {
        match self {
            Self::Match { key, .. }
            | Self::Mismatch { key, .. }
            | Self::MissingLeft { key, .. }
            | Self::MissingRight { key, .. }
            | Self::UnkeyedLeft { key, .. }
            | Self::UnkeyedRight { key, .. }
            | Self::Duplicate { key, .. } => key,
        }
    }

    pub fn values_a(&self) -> &[String] {
        match self {
            Self::Match { values_a, .. }
            | Self::Mismatch { values_a, .. }
            | Self::MissingRight { values_a, .. }
            | Self::UnkeyedRight { values_a, .. } => values_a,
            Self::Duplicate { values_a, .. } => {
                values_a.first().map(Vec::as_slice).unwrap_or(EMPTY_VALUES)
            }
            Self::MissingLeft { .. } | Self::UnkeyedLeft { .. } => EMPTY_VALUES,
        }
    }

    pub fn values_b(&self) -> &[String] {
        match self {
            Self::Match { values_b, .. }
            | Self::Mismatch { values_b, .. }
            | Self::MissingLeft { values_b, .. }
            | Self::UnkeyedLeft { values_b, .. } => values_b,
            Self::Duplicate { values_b, .. } => {
                values_b.first().map(Vec::as_slice).unwrap_or(EMPTY_VALUES)
            }
            Self::MissingRight { .. } | Self::UnkeyedRight { .. } => EMPTY_VALUES,
        }
    }

    pub fn duplicate_values_a(&self) -> &[Vec<String>] {
        match self {
            Self::Duplicate { values_a, .. } => values_a,
            _ => EMPTY_DUPLICATE_VALUES,
        }
    }

    pub fn duplicate_values_b(&self) -> &[Vec<String>] {
        match self {
            Self::Duplicate { values_b, .. } => values_b,
            _ => EMPTY_DUPLICATE_VALUES,
        }
    }

    pub fn differences(&self) -> &[ValueDifference] {
        match self {
            Self::Mismatch { differences, .. } => differences,
            _ => EMPTY_DIFFERENCES,
        }
    }

    pub fn duplicate_source(&self) -> Option<DuplicateSource> {
        match self {
            Self::Duplicate {
                values_a, values_b, ..
            } => DuplicateSource::from_duplicate_rows(values_a, values_b),
            _ => None,
        }
    }

    pub fn result_type(&self) -> ResultType {
        match self {
            Self::Match { .. } => ResultType::Match,
            Self::Mismatch { .. } => ResultType::Mismatch,
            Self::MissingLeft { .. } => ResultType::MissingLeft,
            Self::MissingRight { .. } => ResultType::MissingRight,
            Self::UnkeyedLeft { .. } => ResultType::UnkeyedLeft,
            Self::UnkeyedRight { .. } => ResultType::UnkeyedRight,
            Self::Duplicate { .. } => match self.duplicate_source() {
                Some(DuplicateSource::FileA) => ResultType::DuplicateFileA,
                Some(DuplicateSource::FileB) => ResultType::DuplicateFileB,
                Some(DuplicateSource::Both) | None => ResultType::DuplicateBoth,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
