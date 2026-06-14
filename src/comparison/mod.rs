mod rows;
pub(crate) mod value_compare;

pub mod engine;
pub mod mapping;

pub use engine::{compare_csv_data, generate_summary, try_compare_csv_data};
pub use mapping::{suggest_mappings, suggest_mappings_with_data};
