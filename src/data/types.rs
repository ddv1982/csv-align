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

#[derive(Debug, Clone, PartialEq)]
pub enum ColumnDataType {
    String,
    Integer,
    Float,
    Date,
}

/// Mapping between columns in file A and file B
#[derive(Debug, Clone)]
pub struct ColumnMapping {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingType,
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
    Duplicate {
        key: Vec<String>,
        source: DuplicateSource,
        values: Vec<Vec<String>>,
    },
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

/// Summary statistics of comparison results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonSummary {
    pub total_rows_a: usize,
    pub total_rows_b: usize,
    pub matches: usize,
    pub mismatches: usize,
    pub missing_left: usize,
    pub missing_right: usize,
    pub duplicates_a: usize,
    pub duplicates_b: usize,
}

/// Filter options for displaying results
#[derive(Debug, Clone, PartialEq)]
pub enum ResultFilter {
    All,
    Matches,
    Mismatches,
    MissingLeft,
    MissingRight,
    Duplicates,
}

impl Default for ResultFilter {
    fn default() -> Self {
        ResultFilter::All
    }
}
