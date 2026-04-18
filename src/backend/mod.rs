mod comparison_snapshot;
mod error;
mod pair_order;
mod persistence;
mod requests;
mod session;
mod validation;
mod workflow;

pub use comparison_snapshot::{
    load_comparison_snapshot_workflow, save_comparison_snapshot_workflow,
};
pub use error::CsvAlignError;
pub use pair_order::{load_pair_order_workflow, save_pair_order_workflow};
pub use requests::{
    CompareExecution, CompareRequest, CompareValidationError, ComparisonSnapshotFile,
    LoadComparisonSnapshotRequest, LoadComparisonSnapshotResponse, LoadPairOrderRequest,
    LoadPairOrderResponse, MappingRequest, PairOrderSelection, SavePairOrderRequest,
    SessionResponse, SuggestMappingsRequest,
};
pub use session::SessionData;
pub use workflow::{
    apply_csv_to_session, comparison_inputs, export_results_to_bytes,
    export_session_results_snapshot, parse_file_side, run_comparison, suggest_mappings_workflow,
    validate_file_letter, write_export_results,
};
