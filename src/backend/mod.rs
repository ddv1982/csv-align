mod comparison_snapshot;
mod error;
pub mod limits;
mod operation;
mod pair_order;
mod persistence;
mod requests;
mod session;
mod store;
mod validation;
mod workflow;

pub use comparison_snapshot::{
    PreparedComparisonSnapshotLoad, ensure_snapshot_size, load_comparison_snapshot_workflow,
    prepare_comparison_snapshot_load, prepare_comparison_snapshot_load_bytes,
    save_comparison_snapshot_workflow, validate_comparison_snapshot_version,
};
pub use error::CsvAlignError;
pub use limits::MAX_CSV_FILE_BYTES;
pub use operation::{OperationKind, OperationToken};
pub use pair_order::{load_pair_order_workflow, save_pair_order_workflow};
pub use persistence::v1::SNAPSHOT_VERSION;
#[cfg(feature = "benchmark-owned-snapshot")]
#[doc(hidden)]
pub use persistence::v1::SnapshotV1;
pub use requests::{
    CompareExecution, CompareRequest, CompareValidationError, ComparisonSnapshotFile,
    LoadComparisonSnapshotResponse, LoadPairOrderRequest, LoadPairOrderResponse, MappingRequest,
    PairOrderSelection, SavePairOrderRequest, SessionResponse, SuggestMappingsRequest,
};
pub use session::SessionData;
pub use store::SessionStore;
pub use workflow::{
    CsvLoadSource, LoadedCsv, PendingComparison, apply_csv_to_session,
    begin_comparison_for_session, begin_comparison_snapshot_load_for_session,
    begin_file_load_for_session, commit_comparison_for_session,
    commit_comparison_snapshot_load_for_session, commit_file_load_for_session, comparison_inputs,
    execute_comparison_for_session, export_results_for_session, export_results_to_bytes,
    export_session_results_snapshot, load_comparison_snapshot_for_session, load_csv_workflow,
    load_pair_order_for_session, parse_file_side, run_comparison, run_comparison_for_session,
    save_comparison_snapshot_for_session, save_pair_order_for_session,
    suggest_mappings_for_session, suggest_mappings_workflow, validate_file_letter,
    write_export_results, write_export_results_for_session,
};
