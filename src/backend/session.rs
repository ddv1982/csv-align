use std::mem::size_of;
use std::sync::Arc;

use crate::backend::error::CsvAlignError;
use crate::backend::limits::{MAX_COMPARISON_RESULTS_BYTES, MAX_RETAINED_SESSION_BYTES};
use crate::data::types::{
    ColumnCatalog, ColumnMapping, ComparisonConfig, CsvData, RowComparisonResult,
    retained_column_mappings_allocation_bytes, retained_comparison_results_bytes,
};

const ARC_CONTROL_BYTES: usize = size_of::<usize>() * 2;

/// Data for a single comparison session.
#[derive(Debug, Clone)]
pub struct SessionData {
    pub csv_a: Option<Arc<CsvData>>,
    pub csv_b: Option<Arc<CsvData>>,
    pub columns_a: Arc<ColumnCatalog>,
    pub columns_b: Arc<ColumnCatalog>,
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
            columns_a: Arc::new(ColumnCatalog::default()),
            columns_b: Arc::new(ColumnCatalog::default()),
            column_mappings: Vec::new(),
            comparison_results: Vec::new(),
            comparison_config: None,
            data_revision: 0,
        }
    }

    pub fn advance_data_revision(&mut self) {
        self.data_revision = self.data_revision.wrapping_add(1);
    }

    /// Conservative memory retained by this session after a commit.
    ///
    /// Vector and string capacities are counted rather than lengths. Arc-backed
    /// allocations are counted once per session even if both sides ever point
    /// to the same allocation.
    pub fn retained_size_bytes(&self) -> usize {
        self.retained_size_with_comparison(
            &self.comparison_results,
            self.comparison_results.capacity(),
            self.comparison_config.as_ref(),
        )
    }

    pub(crate) fn retained_size_with_comparison(
        &self,
        results: &[RowComparisonResult],
        results_capacity: usize,
        config: Option<&ComparisonConfig>,
    ) -> usize {
        let csv_bytes = retained_optional_arc_pair_bytes(
            self.csv_a.as_ref(),
            self.csv_b.as_ref(),
            CsvData::retained_size_bytes,
        );
        let catalog_bytes = retained_arc_pair_bytes(
            &self.columns_a,
            &self.columns_b,
            ColumnCatalog::retained_size_bytes,
        );
        let results_bytes = retained_comparison_results_bytes(results, results_capacity)
            .saturating_sub(size_of::<Vec<RowComparisonResult>>());

        size_of::<Self>()
            .saturating_add(csv_bytes)
            .saturating_add(catalog_bytes)
            .saturating_add(retained_column_mappings_allocation_bytes(
                &self.column_mappings,
                self.column_mappings.capacity(),
            ))
            .saturating_add(results_bytes)
            .saturating_add(
                config
                    .map(ComparisonConfig::retained_heap_size_bytes)
                    .unwrap_or_default(),
            )
    }

    pub(crate) fn ensure_retained_size_limit(&self) -> Result<(), CsvAlignError> {
        ensure_session_size_limit(self.retained_size_bytes())
    }
}

pub(crate) fn ensure_comparison_results_size_limit(
    results: &[RowComparisonResult],
    capacity: usize,
) -> Result<(), CsvAlignError> {
    let retained = retained_comparison_results_bytes(results, capacity);
    if retained > MAX_COMPARISON_RESULTS_BYTES {
        tracing::warn!(
            limit_name = "comparison results retained bytes",
            retained,
            limit = MAX_COMPARISON_RESULTS_BYTES,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Comparison results retained allocation exceeds the {} byte limit",
            MAX_COMPARISON_RESULTS_BYTES
        )));
    }

    Ok(())
}

pub(crate) fn ensure_session_size_limit(retained: usize) -> Result<(), CsvAlignError> {
    ensure_session_size_limit_with_limit(retained, MAX_RETAINED_SESSION_BYTES)
}

pub(crate) fn ensure_session_size_limit_with_limit(
    retained: usize,
    limit: usize,
) -> Result<(), CsvAlignError> {
    if retained > limit {
        tracing::warn!(
            limit_name = "retained session bytes",
            retained,
            limit,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Retained session allocation exceeds the {} byte limit",
            limit
        )));
    }

    Ok(())
}

fn retained_optional_arc_pair_bytes<T>(
    left: Option<&Arc<T>>,
    right: Option<&Arc<T>>,
    retained_size: impl Fn(&T) -> usize,
) -> usize {
    match (left, right) {
        (Some(left), Some(right)) if Arc::ptr_eq(left, right) => {
            retained_arc_bytes(left, &retained_size)
        }
        (Some(left), Some(right)) => retained_arc_bytes(left, &retained_size)
            .saturating_add(retained_arc_bytes(right, &retained_size)),
        (Some(value), None) | (None, Some(value)) => retained_arc_bytes(value, &retained_size),
        (None, None) => 0,
    }
}

fn retained_arc_pair_bytes<T>(
    left: &Arc<T>,
    right: &Arc<T>,
    retained_size: impl Fn(&T) -> usize,
) -> usize {
    if Arc::ptr_eq(left, right) {
        retained_arc_bytes(left, &retained_size)
    } else {
        retained_arc_bytes(left, &retained_size)
            .saturating_add(retained_arc_bytes(right, &retained_size))
    }
}

fn retained_arc_bytes<T>(value: &Arc<T>, retained_size: &impl Fn(&T) -> usize) -> usize {
    ARC_CONTROL_BYTES.saturating_add(retained_size(value))
}

impl Default for SessionData {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retained_session_limit_accepts_exact_bytes_and_rejects_one_more() {
        ensure_session_size_limit(MAX_RETAINED_SESSION_BYTES).unwrap();
        let error = ensure_session_size_limit(MAX_RETAINED_SESSION_BYTES + 1).unwrap_err();
        assert!(error.to_string().contains("Retained session allocation"));
    }

    #[test]
    fn shared_arc_allocation_is_counted_once_within_a_session() {
        let csv = Arc::new(CsvData {
            file_path: None,
            headers: vec!["id".to_string()],
            rows: vec![vec!["1".to_string()]],
        });
        let mut shared = SessionData::new();
        shared.csv_a = Some(Arc::clone(&csv));
        shared.csv_b = Some(Arc::clone(&csv));

        let mut separate = SessionData::new();
        separate.csv_a = Some(Arc::clone(&csv));
        separate.csv_b = Some(Arc::new((*csv).clone()));

        assert!(shared.retained_size_bytes() < separate.retained_size_bytes());
    }
}
