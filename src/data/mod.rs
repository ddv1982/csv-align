pub mod csv_loader;
pub mod export;
pub mod types;

pub use csv_loader::{detect_columns, load_csv, load_csv_from_bytes};
pub use export::{
    export_results, export_results_to_bytes, export_results_to_bytes_with_config,
    export_results_with_config,
};
pub use types::{
    ColumnDataType, ColumnInfo, ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig,
    ComparisonSummary, CsvData, DateNormalizationConfig, DuplicateSource, FileSide, MappingKind,
    MappingType, ResultType, RowComparisonResult, ValueDifference,
};
