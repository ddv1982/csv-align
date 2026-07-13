use std::mem::size_of;
use std::ops::Deref;

use serde::{Deserialize, Serialize};

/// Represents a loaded CSV file with its metadata
#[derive(Debug, Clone)]
pub struct CsvData {
    pub file_path: Option<String>,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

impl CsvData {
    /// Conservative retained allocation for this value, including spare vector
    /// and string capacity but excluding any external `Arc` control block.
    pub fn retained_size_bytes(&self) -> usize {
        let rows_allocation = self.rows.iter().fold(
            vec_allocation_bytes::<Vec<String>>(self.rows.capacity()),
            |total, row| total.saturating_add(retained_strings_vec_allocation_bytes(row)),
        );

        size_of::<Self>()
            .saturating_add(
                self.file_path
                    .as_ref()
                    .map(String::capacity)
                    .unwrap_or_default(),
            )
            .saturating_add(retained_strings_vec_allocation_bytes(&self.headers))
            .saturating_add(rows_allocation)
    }
}

/// Information about a column in a CSV file
#[derive(Debug, Clone)]
pub struct ColumnInfo {
    pub index: usize,
    pub name: String,
    pub data_type: ColumnDataType,
}

/// Immutable metadata discovered once for one side of a comparison session.
#[derive(Debug, Default)]
pub struct ColumnCatalog {
    columns: Vec<ColumnInfo>,
    virtual_headers: Vec<String>,
}

impl ColumnCatalog {
    pub fn new(columns: Vec<ColumnInfo>, virtual_headers: Vec<String>) -> Self {
        Self {
            columns,
            virtual_headers,
        }
    }

    pub fn virtual_headers(&self) -> &[String] {
        &self.virtual_headers
    }

    pub fn contains_label(&self, label: &str) -> bool {
        self.columns.iter().any(|column| column.name == label)
            || self.virtual_headers.iter().any(|header| header == label)
    }

    pub fn retained_size_bytes(&self) -> usize {
        size_of::<Self>()
            .saturating_add(retained_vec_with_strings_bytes(
                self.columns.capacity(),
                &self.columns,
                |column| column.name.capacity(),
            ))
            .saturating_add(retained_strings_vec_allocation_bytes(&self.virtual_headers))
    }
}

impl Deref for ColumnCatalog {
    type Target = [ColumnInfo];

    fn deref(&self) -> &Self::Target {
        &self.columns
    }
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

impl ComparisonConfig {
    pub fn retained_heap_size_bytes(&self) -> usize {
        retained_strings_vec_allocation_bytes(&self.key_columns_a)
            .saturating_add(retained_strings_vec_allocation_bytes(&self.key_columns_b))
            .saturating_add(retained_strings_vec_allocation_bytes(
                &self.comparison_columns_a,
            ))
            .saturating_add(retained_strings_vec_allocation_bytes(
                &self.comparison_columns_b,
            ))
            .saturating_add(retained_column_mappings_allocation_bytes(
                &self.column_mappings,
                self.column_mappings.capacity(),
            ))
            .saturating_add(self.normalization.retained_heap_size_bytes())
    }
}

fn default_true() -> bool {
    true
}

fn default_null_tokens() -> Vec<String> {
    vec![
        "null".to_string(),
        "na".to_string(),
        "n/a".to_string(),
        "none".to_string(),
    ]
}

fn default_date_formats() -> Vec<String> {
    vec![
        "%Y-%m-%d".to_string(),
        "%d/%m/%Y".to_string(),
        "%m/%d/%Y".to_string(),
        "%d-%m-%Y".to_string(),
        "%m-%d-%Y".to_string(),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DateNormalizationConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_date_formats")]
    pub formats: Vec<String>,
}

impl Default for DateNormalizationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            formats: default_date_formats(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DecimalRoundingConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub decimals: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ComparisonNormalizationConfig {
    #[serde(default = "default_true")]
    pub treat_empty_as_null: bool,
    #[serde(default = "default_null_tokens")]
    pub null_tokens: Vec<String>,
    #[serde(default = "default_true")]
    pub null_token_case_insensitive: bool,
    #[serde(default)]
    pub flexible_key_matching: bool,
    #[serde(default)]
    pub case_insensitive: bool,
    #[serde(default)]
    pub trim_whitespace: bool,
    #[serde(default)]
    pub numeric_equivalence: bool,
    #[serde(default)]
    pub decimal_rounding: DecimalRoundingConfig,
    #[serde(default)]
    pub date_normalization: DateNormalizationConfig,
}

impl ComparisonNormalizationConfig {
    pub fn retained_heap_size_bytes(&self) -> usize {
        retained_strings_vec_allocation_bytes(&self.null_tokens).saturating_add(
            retained_strings_vec_allocation_bytes(&self.date_normalization.formats),
        )
    }
}

impl Default for ComparisonNormalizationConfig {
    fn default() -> Self {
        Self {
            treat_empty_as_null: true,
            null_tokens: default_null_tokens(),
            null_token_case_insensitive: true,
            flexible_key_matching: false,
            case_insensitive: false,
            trim_whitespace: false,
            numeric_equivalence: false,
            decimal_rounding: DecimalRoundingConfig::default(),
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
    /// Heap allocation retained below the enum value itself. The containing
    /// result vector accounts for the enum storage using its capacity.
    pub fn retained_heap_size_bytes(&self) -> usize {
        match self {
            Self::Match {
                key,
                values_a,
                values_b,
            } => retained_strings_vec_allocation_bytes(key)
                .saturating_add(retained_strings_vec_allocation_bytes(values_a))
                .saturating_add(retained_strings_vec_allocation_bytes(values_b)),
            Self::Mismatch {
                key,
                values_a,
                values_b,
                differences,
            } => retained_strings_vec_allocation_bytes(key)
                .saturating_add(retained_strings_vec_allocation_bytes(values_a))
                .saturating_add(retained_strings_vec_allocation_bytes(values_b))
                .saturating_add(retained_vec_with_strings_bytes(
                    differences.capacity(),
                    differences,
                    |difference| {
                        difference
                            .column_a
                            .capacity()
                            .saturating_add(difference.column_b.capacity())
                            .saturating_add(difference.value_a.capacity())
                            .saturating_add(difference.value_b.capacity())
                    },
                )),
            Self::MissingLeft { key, values_b } | Self::UnkeyedLeft { key, values_b } => {
                retained_strings_vec_allocation_bytes(key)
                    .saturating_add(retained_strings_vec_allocation_bytes(values_b))
            }
            Self::MissingRight { key, values_a } | Self::UnkeyedRight { key, values_a } => {
                retained_strings_vec_allocation_bytes(key)
                    .saturating_add(retained_strings_vec_allocation_bytes(values_a))
            }
            Self::Duplicate {
                key,
                values_a,
                values_b,
            } => retained_strings_vec_allocation_bytes(key)
                .saturating_add(retained_nested_strings_vec_allocation_bytes(values_a))
                .saturating_add(retained_nested_strings_vec_allocation_bytes(values_b)),
        }
    }
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

pub fn retained_comparison_results_bytes(
    results: &[RowComparisonResult],
    capacity: usize,
) -> usize {
    results.iter().fold(
        size_of::<Vec<RowComparisonResult>>()
            .saturating_add(vec_allocation_bytes::<RowComparisonResult>(capacity)),
        |total, result| total.saturating_add(result.retained_heap_size_bytes()),
    )
}

pub fn retained_column_mappings_allocation_bytes(
    mappings: &[ColumnMapping],
    capacity: usize,
) -> usize {
    retained_vec_with_strings_bytes(capacity, mappings, |mapping| {
        mapping
            .file_a_column
            .capacity()
            .saturating_add(mapping.file_b_column.capacity())
    })
}

#[allow(clippy::ptr_arg)]
fn retained_nested_strings_vec_allocation_bytes(values: &Vec<Vec<String>>) -> usize {
    values.iter().fold(
        vec_allocation_bytes::<Vec<String>>(values.capacity()),
        |total, row| total.saturating_add(retained_strings_vec_allocation_bytes(row)),
    )
}

#[allow(clippy::ptr_arg)]
fn retained_strings_vec_allocation_bytes(values: &Vec<String>) -> usize {
    retained_vec_with_strings_bytes(values.capacity(), values, String::capacity)
}

fn retained_vec_with_strings_bytes<T>(
    capacity: usize,
    values: &[T],
    string_bytes: impl Fn(&T) -> usize,
) -> usize {
    values
        .iter()
        .fold(vec_allocation_bytes::<T>(capacity), |total, value| {
            total.saturating_add(string_bytes(value))
        })
}

fn vec_allocation_bytes<T>(capacity: usize) -> usize {
    capacity.saturating_mul(size_of::<T>())
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
