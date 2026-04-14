mod requests;
mod session;
mod validation;
mod workflow;

pub use requests::{
    CompareExecution, CompareRequest, CompareValidationError, MappingRequest, SessionResponse,
    SuggestMappingsRequest,
};
pub use session::SessionData;
pub use workflow::{
    apply_csv_to_session, comparison_inputs, export_results_to_bytes,
    export_session_results_snapshot, parse_file_side, run_comparison, suggest_mappings_workflow,
    validate_file_letter, write_export_results,
};

#[cfg(test)]
mod tests;
