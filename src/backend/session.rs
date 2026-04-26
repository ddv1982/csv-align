use std::sync::Arc;

use crate::data::types::{
    ColumnInfo, ColumnMapping, ComparisonConfig, CsvData, RowComparisonResult,
};

/// Data for a single comparison session.
#[derive(Debug, Clone)]
pub struct SessionData {
    pub csv_a: Option<Arc<CsvData>>,
    pub csv_b: Option<Arc<CsvData>>,
    pub columns_a: Vec<ColumnInfo>,
    pub columns_b: Vec<ColumnInfo>,
    pub column_mappings: Vec<ColumnMapping>,
    pub comparison_results: Vec<RowComparisonResult>,
    pub comparison_config: Option<ComparisonConfig>,
    pub data_revision: u64,
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
            data_revision: 0,
        }
    }

    pub fn advance_data_revision(&mut self) {
        self.data_revision = self.data_revision.wrapping_add(1);
    }
}

impl Default for SessionData {
    fn default() -> Self {
        Self::new()
    }
}
