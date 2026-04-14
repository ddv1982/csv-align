use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonConfig, CsvData, RowComparisonResult,
};

/// Data for a single comparison session.
#[derive(Debug, Clone)]
pub struct SessionData {
    pub csv_a: Option<CsvData>,
    pub csv_b: Option<CsvData>,
    pub columns_a: Vec<ColumnInfo>,
    pub columns_b: Vec<ColumnInfo>,
    pub column_mappings: Vec<ColumnMapping>,
    pub comparison_results: Vec<RowComparisonResult>,
    pub comparison_config: Option<ComparisonConfig>,
}

impl SessionData {
    pub fn new() -> Self {
        Self {
            csv_a: None,
            csv_b: None,
            columns_a: Vec::new(),
            columns_b: Vec::new(),
            column_mappings: Vec::new(),
            comparison_results: Vec::new(),
            comparison_config: None,
        }
    }
}

impl Default for SessionData {
    fn default() -> Self {
        Self::new()
    }
}
