use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

use serde::{Deserialize, Deserializer, Serialize, Serializer, de, ser::SerializeSeq};

use crate::backend::error::CsvAlignError;
use crate::backend::limits::{MAX_CSV_COLUMNS, MAX_CSV_ROWS, MAX_VIRTUAL_LABELS};
use crate::backend::requests::{
    CompareValidationError, ComparisonSnapshotFile, LoadComparisonSnapshotResponse,
    PairOrderSelection,
};
use crate::backend::session::{SessionData, ensure_comparison_results_size_limit};
use crate::backend::validation::validate_selected_columns_allowed;
use crate::comparison::engine;
use crate::data::json_fields::virtual_label_has_source;
use crate::data::types::{
    ColumnCatalog, ColumnDataType, ColumnInfo, ColumnMapping, ComparisonConfig,
    ComparisonNormalizationConfig, CsvData, DateNormalizationConfig, DecimalRoundingConfig,
    MappingKind, MappingType, ResultType, RowComparisonResult, ValueDifference,
};
use crate::presentation::responses::{
    ColumnResponse, DifferenceResponse, MappingResponse, ResultResponse, SummaryResponse,
};

pub const SNAPSHOT_VERSION: u8 = 2;

pub(crate) fn unsupported_snapshot_version_message(version: impl std::fmt::Display) -> String {
    format!(
        "Unsupported comparison snapshot version {version} — this file was produced by an older csv-align release. Re-run the comparison in v2."
    )
}

fn deserialize_snapshot_version<'de, D>(deserializer: D) -> Result<u8, D::Error>
where
    D: Deserializer<'de>,
{
    let version = u8::deserialize(deserializer)?;
    if version != SNAPSHOT_VERSION {
        return Err(de::Error::custom(unsupported_snapshot_version_message(
            version,
        )));
    }
    Ok(version)
}

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields)]
struct StrictDateNormalization {
    enabled: bool,
    formats: Vec<String>,
}

impl Default for StrictDateNormalization {
    fn default() -> Self {
        let value = DateNormalizationConfig::default();
        Self {
            enabled: value.enabled,
            formats: value.formats,
        }
    }
}

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields)]
struct StrictDecimalRounding {
    enabled: bool,
    decimals: u32,
}

impl Default for StrictDecimalRounding {
    fn default() -> Self {
        let value = DecimalRoundingConfig::default();
        Self {
            enabled: value.enabled,
            decimals: value.decimals,
        }
    }
}

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields)]
struct StrictSnapshotNormalization {
    treat_empty_as_null: bool,
    null_tokens: Vec<String>,
    null_token_case_insensitive: bool,
    flexible_key_matching: bool,
    case_insensitive: bool,
    trim_whitespace: bool,
    numeric_equivalence: bool,
    decimal_rounding: StrictDecimalRounding,
    date_normalization: StrictDateNormalization,
}

impl Default for StrictSnapshotNormalization {
    fn default() -> Self {
        let value = ComparisonNormalizationConfig::default();
        Self {
            treat_empty_as_null: value.treat_empty_as_null,
            null_tokens: value.null_tokens,
            null_token_case_insensitive: value.null_token_case_insensitive,
            flexible_key_matching: value.flexible_key_matching,
            case_insensitive: value.case_insensitive,
            trim_whitespace: value.trim_whitespace,
            numeric_equivalence: value.numeric_equivalence,
            decimal_rounding: StrictDecimalRounding {
                enabled: value.decimal_rounding.enabled,
                decimals: value.decimal_rounding.decimals,
            },
            date_normalization: StrictDateNormalization {
                enabled: value.date_normalization.enabled,
                formats: value.date_normalization.formats,
            },
        }
    }
}

fn deserialize_snapshot_normalization<'de, D>(
    deserializer: D,
) -> Result<ComparisonNormalizationConfig, D::Error>
where
    D: Deserializer<'de>,
{
    let value = StrictSnapshotNormalization::deserialize(deserializer)?;
    Ok(ComparisonNormalizationConfig {
        treat_empty_as_null: value.treat_empty_as_null,
        null_tokens: value.null_tokens,
        null_token_case_insensitive: value.null_token_case_insensitive,
        flexible_key_matching: value.flexible_key_matching,
        case_insensitive: value.case_insensitive,
        trim_whitespace: value.trim_whitespace,
        numeric_equivalence: value.numeric_equivalence,
        decimal_rounding: DecimalRoundingConfig {
            enabled: value.decimal_rounding.enabled,
            decimals: value.decimal_rounding.decimals,
        },
        date_normalization: DateNormalizationConfig {
            enabled: value.date_normalization.enabled,
            formats: value.date_normalization.formats,
        },
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SnapshotV1 {
    #[serde(deserialize_with = "deserialize_snapshot_version")]
    pub version: u8,
    pub file_a: SnapshotFileV1,
    pub file_b: SnapshotFileV1,
    pub selection: SelectionV1,
    pub mappings: Vec<MappingV1>,
    #[serde(deserialize_with = "deserialize_snapshot_normalization")]
    pub normalization: ComparisonNormalizationConfig,
    pub results: Vec<ResultV1>,
    pub summary: SummaryV1,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SnapshotFileV1 {
    pub name: String,
    pub headers: Vec<String>,
    #[serde(default)]
    pub virtual_headers: Vec<String>,
    pub columns: Vec<ColumnV1>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ColumnV1 {
    pub index: usize,
    pub name: String,
    pub data_type: crate::data::types::ColumnDataType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SelectionV1 {
    pub key_columns_a: Vec<String>,
    pub key_columns_b: Vec<String>,
    pub comparison_columns_a: Vec<String>,
    pub comparison_columns_b: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct MappingV1 {
    pub file_a_column: String,
    pub file_b_column: String,
    pub mapping_type: MappingKind,
    pub similarity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ResultV1 {
    pub result_type: ResultType,
    pub key: Vec<String>,
    pub values_a: Vec<String>,
    pub values_b: Vec<String>,
    pub duplicate_values_a: Vec<Vec<String>>,
    pub duplicate_values_b: Vec<Vec<String>>,
    pub differences: Vec<DifferenceV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DifferenceV1 {
    pub column_a: String,
    pub column_b: String,
    pub value_a: String,
    pub value_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SummaryV1 {
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

#[derive(Serialize)]
struct SnapshotV1Ref<'a> {
    version: u8,
    file_a: SnapshotFileV1Ref<'a>,
    file_b: SnapshotFileV1Ref<'a>,
    selection: SelectionV1Ref<'a>,
    mappings: MappingsV1Ref<'a>,
    normalization: &'a ComparisonNormalizationConfig,
    results: ResultsV1Ref<'a>,
    summary: &'a crate::data::types::ComparisonSummary,
}

#[derive(Serialize)]
struct SnapshotFileV1Ref<'a> {
    name: &'a str,
    headers: &'a [String],
    virtual_headers: &'a [String],
    columns: ColumnsV1Ref<'a>,
    row_count: usize,
}

impl<'a> SnapshotFileV1Ref<'a> {
    fn new(csv: &'a CsvData, catalog: &'a ColumnCatalog, fallback_name: &'a str) -> Self {
        Self {
            name: display_name_ref(csv.file_path.as_deref(), fallback_name),
            headers: &csv.headers,
            virtual_headers: catalog.virtual_headers(),
            columns: ColumnsV1Ref(catalog),
            row_count: csv.rows.len(),
        }
    }
}

struct ColumnsV1Ref<'a>(&'a ColumnCatalog);

#[derive(Serialize)]
struct ColumnV1Ref<'a> {
    index: usize,
    name: &'a str,
    data_type: &'a ColumnDataType,
}

impl Serialize for ColumnsV1Ref<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for column in self.0.iter() {
            sequence.serialize_element(&ColumnV1Ref {
                index: column.index,
                name: &column.name,
                data_type: &column.data_type,
            })?;
        }
        sequence.end()
    }
}

#[derive(Serialize)]
struct SelectionV1Ref<'a> {
    key_columns_a: &'a [String],
    key_columns_b: &'a [String],
    comparison_columns_a: &'a [String],
    comparison_columns_b: &'a [String],
}

impl<'a> From<&'a ComparisonConfig> for SelectionV1Ref<'a> {
    fn from(config: &'a ComparisonConfig) -> Self {
        Self {
            key_columns_a: &config.key_columns_a,
            key_columns_b: &config.key_columns_b,
            comparison_columns_a: &config.comparison_columns_a,
            comparison_columns_b: &config.comparison_columns_b,
        }
    }
}

struct MappingsV1Ref<'a>(&'a [ColumnMapping]);

#[derive(Serialize)]
struct MappingV1Ref<'a> {
    file_a_column: &'a str,
    file_b_column: &'a str,
    mapping_type: MappingKind,
    similarity: Option<f64>,
}

impl Serialize for MappingsV1Ref<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for mapping in self.0 {
            let (mapping_type, similarity) = mapping_wire_type(&mapping.mapping_type);
            sequence.serialize_element(&MappingV1Ref {
                file_a_column: &mapping.file_a_column,
                file_b_column: &mapping.file_b_column,
                mapping_type,
                similarity,
            })?;
        }
        sequence.end()
    }
}

struct ResultsV1Ref<'a>(&'a [RowComparisonResult]);

#[derive(Serialize)]
struct ResultV1Ref<'a> {
    result_type: ResultType,
    key: &'a [String],
    values_a: &'a [String],
    values_b: &'a [String],
    duplicate_values_a: &'a [Vec<String>],
    duplicate_values_b: &'a [Vec<String>],
    differences: DifferencesV1Ref<'a>,
}

impl Serialize for ResultsV1Ref<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for result in self.0 {
            sequence.serialize_element(&ResultV1Ref {
                result_type: result.result_type(),
                key: result.key(),
                values_a: result.values_a(),
                values_b: result.values_b(),
                duplicate_values_a: result.duplicate_values_a(),
                duplicate_values_b: result.duplicate_values_b(),
                differences: DifferencesV1Ref(result.differences()),
            })?;
        }
        sequence.end()
    }
}

struct DifferencesV1Ref<'a>(&'a [ValueDifference]);

#[derive(Serialize)]
struct DifferenceV1Ref<'a> {
    column_a: &'a str,
    column_b: &'a str,
    value_a: &'a str,
    value_b: &'a str,
}

impl Serialize for DifferencesV1Ref<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for difference in self.0 {
            sequence.serialize_element(&DifferenceV1Ref {
                column_a: &difference.column_a,
                column_b: &difference.column_b,
                value_a: &difference.value_a,
                value_b: &difference.value_b,
            })?;
        }
        sequence.end()
    }
}

pub(crate) fn serialize_snapshot_v1(
    csv_a: &CsvData,
    csv_b: &CsvData,
    catalog_a: &ColumnCatalog,
    catalog_b: &ColumnCatalog,
    comparison_config: &ComparisonConfig,
    comparison_results: &[RowComparisonResult],
) -> serde_json::Result<String> {
    let summary = engine::generate_summary(comparison_results, csv_a.rows.len(), csv_b.rows.len());
    let snapshot = SnapshotV1Ref {
        version: SNAPSHOT_VERSION,
        file_a: SnapshotFileV1Ref::new(csv_a, catalog_a, "File A"),
        file_b: SnapshotFileV1Ref::new(csv_b, catalog_b, "File B"),
        selection: SelectionV1Ref::from(comparison_config),
        mappings: MappingsV1Ref(&comparison_config.column_mappings),
        normalization: &comparison_config.normalization,
        results: ResultsV1Ref(comparison_results),
        summary: &summary,
    };

    serde_json::to_string_pretty(&snapshot)
}

pub(crate) struct PreparedSnapshotV1 {
    session_data: SessionData,
    response: LoadComparisonSnapshotResponse,
}

impl PreparedSnapshotV1 {
    pub(crate) fn apply(mut self, current: &mut SessionData) -> LoadComparisonSnapshotResponse {
        self.session_data.data_revision = current.data_revision.wrapping_add(1);
        *current = self.session_data;
        self.response
    }
}

impl SnapshotV1 {
    #[cfg(any(test, feature = "benchmark-owned-snapshot"))]
    pub fn from_comparison(
        csv_a: &CsvData,
        csv_b: &CsvData,
        catalog_a: &ColumnCatalog,
        catalog_b: &ColumnCatalog,
        comparison_config: &ComparisonConfig,
        comparison_results: &[RowComparisonResult],
    ) -> Self {
        let summary =
            engine::generate_summary(comparison_results, csv_a.rows.len(), csv_b.rows.len());

        Self {
            version: SNAPSHOT_VERSION,
            file_a: SnapshotFileV1::from_csv(csv_a, catalog_a, "File A"),
            file_b: SnapshotFileV1::from_csv(csv_b, catalog_b, "File B"),
            selection: SelectionV1::from_config(comparison_config),
            mappings: comparison_config
                .column_mappings
                .iter()
                .map(MappingV1::from)
                .collect(),
            normalization: comparison_config.normalization.clone(),
            results: comparison_results.iter().map(ResultV1::from).collect(),
            summary: SummaryV1::from(&summary),
        }
    }

    pub(crate) fn into_prepared_load(self) -> Result<PreparedSnapshotV1, CsvAlignError> {
        let validated = validate_snapshot(&self)?;
        let columns_a = Arc::new(ColumnCatalog::new(
            self.file_a.columns.iter().map(ColumnInfo::from).collect(),
            self.file_a.virtual_headers.clone(),
        ));
        let columns_b = Arc::new(ColumnCatalog::new(
            self.file_b.columns.iter().map(ColumnInfo::from).collect(),
            self.file_b.virtual_headers.clone(),
        ));
        let response = LoadComparisonSnapshotResponse {
            file_a: ComparisonSnapshotFile::from(&self.file_a),
            file_b: ComparisonSnapshotFile::from(&self.file_b),
            selection: PairOrderSelection::from(&self.selection),
            mappings: self.mappings.iter().map(MappingResponse::from).collect(),
            normalization: self.normalization.clone(),
            results: validated
                .comparison_results
                .iter()
                .map(ResultResponse::from)
                .collect(),
            summary: SummaryResponse::from(&self.summary),
        };
        let session_data = SessionData {
            csv_a: None,
            csv_b: None,
            columns_a,
            columns_b,
            column_mappings: validated.comparison_config.column_mappings.clone(),
            comparison_results: validated.comparison_results,
            comparison_config: Some(validated.comparison_config),
            data_revision: 0,
        };
        session_data.ensure_retained_size_limit()?;

        Ok(PreparedSnapshotV1 {
            session_data,
            response,
        })
    }

    pub fn to_comparison_config(&self) -> Result<ComparisonConfig, CsvAlignError> {
        Ok(ComparisonConfig {
            key_columns_a: self.selection.key_columns_a.clone(),
            key_columns_b: self.selection.key_columns_b.clone(),
            comparison_columns_a: self.selection.comparison_columns_a.clone(),
            comparison_columns_b: self.selection.comparison_columns_b.clone(),
            column_mappings: self
                .mappings
                .iter()
                .map(MappingV1::to_column_mapping)
                .collect::<Result<Vec<_>, _>>()?,
            normalization: self.normalization.clone(),
        })
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl SnapshotFileV1 {
    fn from_csv(csv: &CsvData, catalog: &ColumnCatalog, fallback_name: &str) -> Self {
        Self {
            name: display_name(csv.file_path.as_deref(), fallback_name),
            headers: csv.headers.clone(),
            virtual_headers: catalog.virtual_headers().to_vec(),
            columns: catalog.iter().map(ColumnV1::from).collect(),
            row_count: csv.rows.len(),
        }
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl SelectionV1 {
    fn from_config(config: &ComparisonConfig) -> Self {
        Self {
            key_columns_a: config.key_columns_a.clone(),
            key_columns_b: config.key_columns_b.clone(),
            comparison_columns_a: config.comparison_columns_a.clone(),
            comparison_columns_b: config.comparison_columns_b.clone(),
        }
    }
}

impl MappingV1 {
    fn to_column_mapping(&self) -> Result<ColumnMapping, CsvAlignError> {
        let mapping_type = match self.mapping_type {
            MappingKind::Exact => MappingType::ExactMatch,
            MappingKind::Manual => MappingType::ManualMatch,
            MappingKind::Fuzzy => MappingType::FuzzyMatch(self.similarity.ok_or_else(|| {
                CsvAlignError::BadInput(format!(
                    "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                    self.file_a_column, self.file_b_column
                ))
            })?),
        };

        Ok(ColumnMapping {
            file_a_column: self.file_a_column.clone(),
            file_b_column: self.file_b_column.clone(),
            mapping_type,
        })
    }
}

impl ResultV1 {
    fn validate_variant_fields(&self) -> Result<(), CsvAlignError> {
        let result_type = match self.result_type {
            ResultType::Match => "match",
            ResultType::Mismatch => "mismatch",
            ResultType::MissingLeft => "missing_left",
            ResultType::MissingRight => "missing_right",
            ResultType::UnkeyedLeft => "unkeyed_left",
            ResultType::UnkeyedRight => "unkeyed_right",
            ResultType::DuplicateFileA => "duplicate_file_a",
            ResultType::DuplicateFileB => "duplicate_file_b",
            ResultType::DuplicateBoth => "duplicate_both",
        };
        let invalid = |detail: &str| {
            CsvAlignError::BadInput(format!(
                "Saved snapshot {} result has contradictory fields: {detail}",
                result_type
            ))
        };
        let require_empty =
            |values_a: bool, values_b: bool, duplicates: bool, differences: bool| {
                if values_a && !self.values_a.is_empty() {
                    return Err(invalid("values_a must be empty"));
                }
                if values_b && !self.values_b.is_empty() {
                    return Err(invalid("values_b must be empty"));
                }
                if duplicates
                    && (!self.duplicate_values_a.is_empty() || !self.duplicate_values_b.is_empty())
                {
                    return Err(invalid("duplicate value arrays must be empty"));
                }
                if differences && !self.differences.is_empty() {
                    return Err(invalid("differences must be empty"));
                }
                Ok(())
            };

        match self.result_type {
            ResultType::Match => require_empty(false, false, true, true),
            ResultType::Mismatch => require_empty(false, false, true, false),
            ResultType::MissingLeft | ResultType::UnkeyedLeft => {
                require_empty(true, false, true, true)
            }
            ResultType::MissingRight | ResultType::UnkeyedRight => {
                require_empty(false, true, true, true)
            }
            ResultType::DuplicateFileA | ResultType::DuplicateFileB | ResultType::DuplicateBoth => {
                if !self.differences.is_empty() {
                    return Err(invalid("differences must be empty"));
                }

                let has_a = !self.duplicate_values_a.is_empty();
                let has_b = !self.duplicate_values_b.is_empty();
                let sides_match = match self.result_type {
                    ResultType::DuplicateFileA => has_a && !has_b,
                    ResultType::DuplicateFileB => !has_a && has_b,
                    ResultType::DuplicateBoth => has_a && has_b,
                    _ => unreachable!(),
                };
                if !sides_match {
                    return Err(invalid(
                        "duplicate arrays do not match the declared result type",
                    ));
                }

                let first_a = self.duplicate_values_a.first().cloned().unwrap_or_default();
                let first_b = self.duplicate_values_b.first().cloned().unwrap_or_default();
                if self.values_a != first_a || self.values_b != first_b {
                    return Err(invalid(
                        "values_a and values_b must match the first duplicate rows",
                    ));
                }
                Ok(())
            }
        }
    }

    fn to_row_comparison_result(&self) -> Result<RowComparisonResult, CsvAlignError> {
        let differences = self.differences.iter().map(ValueDifference::from).collect();

        Ok(match self.result_type {
            ResultType::Match => RowComparisonResult::Match {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::Mismatch => RowComparisonResult::Mismatch {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
                values_b: self.values_b.clone(),
                differences,
            },
            ResultType::MissingLeft => RowComparisonResult::MissingLeft {
                key: self.key.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::MissingRight => RowComparisonResult::MissingRight {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
            },
            ResultType::UnkeyedLeft => RowComparisonResult::UnkeyedLeft {
                key: self.key.clone(),
                values_b: self.values_b.clone(),
            },
            ResultType::UnkeyedRight => RowComparisonResult::UnkeyedRight {
                key: self.key.clone(),
                values_a: self.values_a.clone(),
            },
            ResultType::DuplicateFileA | ResultType::DuplicateFileB | ResultType::DuplicateBoth => {
                RowComparisonResult::Duplicate {
                    key: self.key.clone(),
                    values_a: self.duplicate_values_a.clone(),
                    values_b: self.duplicate_values_b.clone(),
                }
            }
        })
    }
}

fn display_name_ref<'a>(file_path: Option<&'a str>, fallback_name: &'a str) -> &'a str {
    file_path
        .and_then(|path| Path::new(path).file_name())
        .and_then(|name| name.to_str())
        .unwrap_or(fallback_name)
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
fn display_name(file_path: Option<&str>, fallback_name: &str) -> String {
    display_name_ref(file_path, fallback_name).to_string()
}

fn mapping_wire_type(mapping_type: &MappingType) -> (MappingKind, Option<f64>) {
    match mapping_type {
        MappingType::ExactMatch => (MappingKind::Exact, None),
        MappingType::ManualMatch => (MappingKind::Manual, None),
        MappingType::FuzzyMatch(score) => (MappingKind::Fuzzy, Some(*score)),
    }
}

struct ValidatedSnapshot {
    comparison_results: Vec<RowComparisonResult>,
    comparison_config: ComparisonConfig,
}

fn validate_snapshot(snapshot: &SnapshotV1) -> Result<ValidatedSnapshot, CsvAlignError> {
    validate_snapshot_file_metadata("File A", &snapshot.file_a)?;
    validate_snapshot_file_metadata("File B", &snapshot.file_b)?;

    validate_selection(
        &snapshot.file_a,
        &snapshot.file_b,
        &snapshot.selection,
        &snapshot.normalization,
    )?;
    validate_mappings(
        &snapshot.file_a,
        &snapshot.file_b,
        &snapshot.selection,
        &snapshot.mappings,
    )?;
    for result in &snapshot.results {
        result.validate_variant_fields()?;
    }
    validate_result_relationships(snapshot)?;
    let comparison_config = snapshot.to_comparison_config()?;

    let comparison_results = snapshot
        .results
        .iter()
        .map(ResultV1::to_row_comparison_result)
        .collect::<Result<Vec<_>, _>>()?;
    ensure_comparison_results_size_limit(&comparison_results, comparison_results.capacity())?;
    let generated_summary = engine::generate_summary(
        &comparison_results,
        snapshot.file_a.row_count,
        snapshot.file_b.row_count,
    );

    if generated_summary != snapshot.summary.clone().into() {
        return Err(CsvAlignError::BadInput(
            "Saved comparison snapshot summary does not match the persisted results".to_string(),
        ));
    }

    Ok(ValidatedSnapshot {
        comparison_results,
        comparison_config,
    })
}

fn validate_result_relationships(snapshot: &SnapshotV1) -> Result<(), CsvAlignError> {
    let mut represented_rows_a = 0_usize;
    let mut represented_rows_b = 0_usize;

    for result in &snapshot.results {
        for difference in &result.differences {
            let mapped = snapshot.mappings.iter().any(|mapping| {
                mapping.file_a_column == difference.column_a
                    && mapping.file_b_column == difference.column_b
            });
            if !mapped {
                return Err(CsvAlignError::BadInput(format!(
                    "Saved snapshot mismatch difference {} -> {} is outside the configured mappings",
                    difference.column_a, difference.column_b
                )));
            }
        }

        let (rows_a, rows_b) = match result.result_type {
            ResultType::Match | ResultType::Mismatch => (1, 1),
            ResultType::MissingLeft | ResultType::UnkeyedLeft => (0, 1),
            ResultType::MissingRight | ResultType::UnkeyedRight => (1, 0),
            ResultType::DuplicateFileA => (result.duplicate_values_a.len(), 0),
            ResultType::DuplicateFileB => (0, result.duplicate_values_b.len()),
            ResultType::DuplicateBoth => (
                result.duplicate_values_a.len(),
                result.duplicate_values_b.len(),
            ),
        };
        represented_rows_a = represented_rows_a.checked_add(rows_a).ok_or_else(|| {
            CsvAlignError::BadInput(
                "Saved snapshot represented File A row count overflows the supported range"
                    .to_string(),
            )
        })?;
        represented_rows_b = represented_rows_b.checked_add(rows_b).ok_or_else(|| {
            CsvAlignError::BadInput(
                "Saved snapshot represented File B row count overflows the supported range"
                    .to_string(),
            )
        })?;
    }

    if represented_rows_a != snapshot.file_a.row_count
        || represented_rows_b != snapshot.file_b.row_count
    {
        return Err(CsvAlignError::BadInput(format!(
            "Saved snapshot results represent {represented_rows_a}/{represented_rows_b} File A/File B rows, but metadata declares {}/{}",
            snapshot.file_a.row_count, snapshot.file_b.row_count
        )));
    }

    Ok(())
}

fn validate_snapshot_file_metadata(
    file_label: &'static str,
    file: &SnapshotFileV1,
) -> Result<(), CsvAlignError> {
    if file.row_count > MAX_CSV_ROWS {
        tracing::warn!(
            limit_name = "CSV rows",
            actual = file.row_count,
            limit = MAX_CSV_ROWS,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Saved snapshot {file_label} exceeds the {MAX_CSV_ROWS} row limit"
        )));
    }

    if file.headers.len() > MAX_CSV_COLUMNS {
        tracing::warn!(
            limit_name = "CSV columns",
            actual = file.headers.len(),
            limit = MAX_CSV_COLUMNS,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Saved snapshot {file_label} exceeds the {MAX_CSV_COLUMNS} column limit"
        )));
    }

    if file.virtual_headers.len() > MAX_VIRTUAL_LABELS {
        tracing::warn!(
            limit_name = "JSON virtual labels",
            actual = file.virtual_headers.len(),
            limit = MAX_VIRTUAL_LABELS,
            "resource limit exceeded"
        );
        return Err(CsvAlignError::BadInput(format!(
            "Saved snapshot {file_label} exceeds the {MAX_VIRTUAL_LABELS} virtual-label limit"
        )));
    }

    if file.columns.len() != file.headers.len() {
        return Err(CsvAlignError::BadInput(format!(
            "Saved snapshot {file_label} column metadata must match the header count"
        )));
    }

    for (expected_index, (header, column)) in file.headers.iter().zip(&file.columns).enumerate() {
        if column.index != expected_index {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot {file_label} column metadata has index {} for header {header}, expected {expected_index}",
                column.index
            )));
        }

        if column.name != *header {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot {file_label} column metadata name {} does not match header {header}",
                column.name
            )));
        }
    }

    for virtual_header in &file.virtual_headers {
        if !virtual_label_has_source(&file.headers, virtual_header) {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot {file_label} virtual header {virtual_header} does not resolve to a JSON path on a saved column"
            )));
        }
    }

    Ok(())
}

fn saved_label_allowed(file: &SnapshotFileV1, label: &str) -> bool {
    file.headers.iter().any(|header| header == label)
        || file.virtual_headers.iter().any(|header| header == label)
}

fn validate_selection(
    file_a: &SnapshotFileV1,
    file_b: &SnapshotFileV1,
    selection: &SelectionV1,
    normalization: &ComparisonNormalizationConfig,
) -> Result<(), CsvAlignError> {
    validate_saved_selected_columns(
        "Saved snapshot key columns for File A",
        file_a,
        &selection.key_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot key columns for File B",
        file_b,
        &selection.key_columns_b,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot comparison columns for File A",
        file_a,
        &selection.comparison_columns_a,
    )?;
    validate_saved_selected_columns(
        "Saved snapshot comparison columns for File B",
        file_b,
        &selection.comparison_columns_b,
    )?;

    if !normalization.flexible_key_matching
        && selection.key_columns_a.len() != selection.key_columns_b.len()
    {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot key columns for File A and File B must contain the same number of columns"
                .to_string(),
        ));
    }

    if selection.comparison_columns_a.len() != selection.comparison_columns_b.len() {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot comparison columns for File A and File B must contain the same number of columns"
                .to_string(),
        ));
    }

    Ok(())
}

fn validate_saved_selected_columns(
    label: &'static str,
    file: &SnapshotFileV1,
    selected_columns: &[String],
) -> Result<(), CsvAlignError> {
    // Persisted selections may only reference physical headers or virtual
    // headers that the snapshot itself declares; a virtual-looking label whose
    // source column merely exists is not enough.
    validate_selected_columns_allowed(label, selected_columns, |column| {
        saved_label_allowed(file, column)
    })
    .map_err(saved_selection_validation_error)
}

fn validate_mappings(
    file_a: &SnapshotFileV1,
    file_b: &SnapshotFileV1,
    selection: &SelectionV1,
    mappings: &[MappingV1],
) -> Result<(), CsvAlignError> {
    // Empty mappings are the legacy positional-compatibility path. When mappings
    // are present, they must satisfy the stricter selected-column invariant.
    if mappings.is_empty() {
        return Ok(());
    }

    if mappings.len() != selection.comparison_columns_a.len() {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot mappings must cover every selected comparison column exactly once"
                .to_string(),
        ));
    }

    let allowed_a: HashSet<&str> = selection
        .comparison_columns_a
        .iter()
        .map(String::as_str)
        .collect();
    let allowed_b: HashSet<&str> = selection
        .comparison_columns_b
        .iter()
        .map(String::as_str)
        .collect();
    let mut seen_a = HashSet::new();
    let mut seen_b = HashSet::new();

    for mapping in mappings {
        if !saved_label_allowed(file_a, &mapping.file_a_column) {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot mappings reference missing File A column: {}",
                mapping.file_a_column
            )));
        }

        if !saved_label_allowed(file_b, &mapping.file_b_column) {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot mappings reference missing File B column: {}",
                mapping.file_b_column
            )));
        }

        if !allowed_a.contains(mapping.file_a_column.as_str())
            || !allowed_b.contains(mapping.file_b_column.as_str())
        {
            return Err(CsvAlignError::BadInput(
                "Saved snapshot mappings must only reference selected comparison columns"
                    .to_string(),
            ));
        }

        if !seen_a.insert(mapping.file_a_column.as_str())
            || !seen_b.insert(mapping.file_b_column.as_str())
        {
            return Err(CsvAlignError::BadInput(
                "Saved snapshot mappings must pair each selected comparison column exactly once"
                    .to_string(),
            ));
        }

        if matches!(mapping.mapping_type, MappingKind::Fuzzy) && mapping.similarity.is_none() {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot fuzzy mapping {} -> {} is missing a similarity score",
                mapping.file_a_column, mapping.file_b_column
            )));
        }

        if matches!(mapping.mapping_type, MappingKind::Fuzzy)
            && !mapping
                .similarity
                .is_some_and(|similarity| (0.0..=1.0).contains(&similarity))
        {
            return Err(CsvAlignError::BadInput(format!(
                "Saved snapshot fuzzy mapping {} -> {} must have a similarity score between 0.0 and 1.0",
                mapping.file_a_column, mapping.file_b_column
            )));
        }
    }

    if seen_a.len() != allowed_a.len() || seen_b.len() != allowed_b.len() {
        return Err(CsvAlignError::BadInput(
            "Saved snapshot mappings must cover every selected comparison column exactly once"
                .to_string(),
        ));
    }

    Ok(())
}

fn saved_selection_validation_error(error: CompareValidationError) -> CsvAlignError {
    match error {
        CompareValidationError::MissingColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} reference missing columns: {}",
                columns.join(", ")
            ))
        }
        CompareValidationError::DuplicateColumns { selection, columns } => {
            CsvAlignError::BadInput(format!(
                "{selection} contain duplicate columns: {}",
                columns.join(", ")
            ))
        }
        other => CsvAlignError::Validation(other),
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl From<&ColumnInfo> for ColumnV1 {
    fn from(column: &ColumnInfo) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&ColumnV1> for ColumnInfo {
    fn from(column: &ColumnV1) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&ColumnV1> for ColumnResponse {
    fn from(column: &ColumnV1) -> Self {
        Self {
            index: column.index,
            name: column.name.clone(),
            data_type: column.data_type.clone(),
        }
    }
}

impl From<&SnapshotFileV1> for ComparisonSnapshotFile {
    fn from(file: &SnapshotFileV1) -> Self {
        Self {
            name: file.name.clone(),
            headers: file.headers.clone(),
            virtual_headers: file.virtual_headers.clone(),
            columns: file.columns.iter().map(ColumnResponse::from).collect(),
            row_count: file.row_count,
        }
    }
}

impl From<&SelectionV1> for PairOrderSelection {
    fn from(selection: &SelectionV1) -> Self {
        Self {
            key_columns_a: selection.key_columns_a.clone(),
            key_columns_b: selection.key_columns_b.clone(),
            comparison_columns_a: selection.comparison_columns_a.clone(),
            comparison_columns_b: selection.comparison_columns_b.clone(),
        }
    }
}

impl From<&MappingV1> for MappingResponse {
    fn from(mapping: &MappingV1) -> Self {
        Self {
            file_a_column: mapping.file_a_column.clone(),
            file_b_column: mapping.file_b_column.clone(),
            mapping_type: mapping.mapping_type,
            similarity: mapping.similarity,
        }
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl From<&ColumnMapping> for MappingV1 {
    fn from(mapping: &ColumnMapping) -> Self {
        let (mapping_type, similarity) = mapping_wire_type(&mapping.mapping_type);

        Self {
            file_a_column: mapping.file_a_column.clone(),
            file_b_column: mapping.file_b_column.clone(),
            mapping_type,
            similarity,
        }
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl From<&ValueDifference> for DifferenceV1 {
    fn from(difference: &ValueDifference) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&DifferenceV1> for DifferenceResponse {
    fn from(difference: &DifferenceV1) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

impl From<&DifferenceV1> for ValueDifference {
    fn from(difference: &DifferenceV1) -> Self {
        Self {
            column_a: difference.column_a.clone(),
            column_b: difference.column_b.clone(),
            value_a: difference.value_a.clone(),
            value_b: difference.value_b.clone(),
        }
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl From<&RowComparisonResult> for ResultV1 {
    fn from(result: &RowComparisonResult) -> Self {
        Self {
            result_type: result.result_type(),
            key: result.key().to_vec(),
            values_a: result.values_a().to_vec(),
            values_b: result.values_b().to_vec(),
            duplicate_values_a: result.duplicate_values_a().to_vec(),
            duplicate_values_b: result.duplicate_values_b().to_vec(),
            differences: result
                .differences()
                .iter()
                .map(DifferenceV1::from)
                .collect(),
        }
    }
}

impl From<&ResultV1> for ResultResponse {
    fn from(result: &ResultV1) -> Self {
        Self {
            result_type: result.result_type,
            key: result.key.clone(),
            values_a: result.values_a.clone(),
            values_b: result.values_b.clone(),
            duplicate_values_a: result.duplicate_values_a.clone(),
            duplicate_values_b: result.duplicate_values_b.clone(),
            differences: result
                .differences
                .iter()
                .map(DifferenceResponse::from)
                .collect(),
        }
    }
}

#[cfg(any(test, feature = "benchmark-owned-snapshot"))]
impl From<&crate::data::types::ComparisonSummary> for SummaryV1 {
    fn from(summary: &crate::data::types::ComparisonSummary) -> Self {
        Self {
            total_rows_a: summary.total_rows_a,
            total_rows_b: summary.total_rows_b,
            matches: summary.matches,
            mismatches: summary.mismatches,
            missing_left: summary.missing_left,
            missing_right: summary.missing_right,
            unkeyed_left: summary.unkeyed_left,
            unkeyed_right: summary.unkeyed_right,
            duplicates_a: summary.duplicates_a,
            duplicates_b: summary.duplicates_b,
        }
    }
}

impl From<SummaryV1> for crate::data::types::ComparisonSummary {
    fn from(summary: SummaryV1) -> Self {
        Self {
            total_rows_a: summary.total_rows_a,
            total_rows_b: summary.total_rows_b,
            matches: summary.matches,
            mismatches: summary.mismatches,
            missing_left: summary.missing_left,
            missing_right: summary.missing_right,
            unkeyed_left: summary.unkeyed_left,
            unkeyed_right: summary.unkeyed_right,
            duplicates_a: summary.duplicates_a,
            duplicates_b: summary.duplicates_b,
        }
    }
}

impl From<&SummaryV1> for SummaryResponse {
    fn from(summary: &SummaryV1) -> Self {
        Self {
            total_rows_a: summary.total_rows_a,
            total_rows_b: summary.total_rows_b,
            matches: summary.matches,
            mismatches: summary.mismatches,
            missing_left: summary.missing_left,
            missing_right: summary.missing_right,
            unkeyed_left: summary.unkeyed_left,
            unkeyed_right: summary.unkeyed_right,
            duplicates_a: summary.duplicates_a,
            duplicates_b: summary.duplicates_b,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn borrowed_snapshot_serialization_matches_owned_v2_graph_exactly() {
        let csv_a = CsvData {
            file_path: Some("nested/left.csv".to_string()),
            headers: values(&["id", "value"]),
            rows: (0..9).map(|_| Vec::new()).collect(),
        };
        let csv_b = CsvData {
            file_path: Some("nested/right.csv".to_string()),
            headers: values(&["record_id", "display_value"]),
            rows: (0..9).map(|_| Vec::new()).collect(),
        };
        let catalog_a = ColumnCatalog::new(
            vec![
                ColumnInfo {
                    index: 0,
                    name: "id".to_string(),
                    data_type: ColumnDataType::String,
                },
                ColumnInfo {
                    index: 1,
                    name: "value".to_string(),
                    data_type: ColumnDataType::String,
                },
            ],
            vec!["value.nested".to_string()],
        );
        let catalog_b = ColumnCatalog::new(
            vec![
                ColumnInfo {
                    index: 0,
                    name: "record_id".to_string(),
                    data_type: ColumnDataType::String,
                },
                ColumnInfo {
                    index: 1,
                    name: "display_value".to_string(),
                    data_type: ColumnDataType::String,
                },
            ],
            vec!["display_value.nested".to_string()],
        );
        let config = ComparisonConfig {
            key_columns_a: vec!["id".to_string()],
            key_columns_b: vec!["record_id".to_string()],
            comparison_columns_a: vec!["value".to_string()],
            comparison_columns_b: vec!["display_value".to_string()],
            column_mappings: vec![ColumnMapping {
                file_a_column: "value".to_string(),
                file_b_column: "display_value".to_string(),
                mapping_type: MappingType::FuzzyMatch(0.87),
            }],
            normalization: ComparisonNormalizationConfig {
                trim_whitespace: true,
                ..ComparisonNormalizationConfig::default()
            },
        };
        let results = vec![
            RowComparisonResult::Match {
                key: values(&["1"]),
                values_a: values(&["same"]),
                values_b: values(&["same"]),
            },
            RowComparisonResult::Mismatch {
                key: values(&["2"]),
                values_a: values(&["left"]),
                values_b: values(&["right"]),
                differences: vec![ValueDifference {
                    column_a: "value".to_string(),
                    column_b: "display_value".to_string(),
                    value_a: "left".to_string(),
                    value_b: "right".to_string(),
                }],
            },
            RowComparisonResult::MissingLeft {
                key: values(&["3"]),
                values_b: values(&["right-only"]),
            },
            RowComparisonResult::MissingRight {
                key: values(&["4"]),
                values_a: values(&["left-only"]),
            },
            RowComparisonResult::UnkeyedLeft {
                key: values(&[""]),
                values_b: values(&["unkeyed-right"]),
            },
            RowComparisonResult::UnkeyedRight {
                key: values(&[""]),
                values_a: values(&["unkeyed-left"]),
            },
            RowComparisonResult::Duplicate {
                key: values(&["5"]),
                values_a: vec![values(&["left-a"]), values(&["left-b"])],
                values_b: Vec::new(),
            },
            RowComparisonResult::Duplicate {
                key: values(&["6"]),
                values_a: Vec::new(),
                values_b: vec![values(&["right-a"]), values(&["right-b"])],
            },
            RowComparisonResult::Duplicate {
                key: values(&["7"]),
                values_a: vec![values(&["left-a"]), values(&["left-b"])],
                values_b: vec![values(&["right-a"]), values(&["right-b"])],
            },
        ];

        let owned =
            SnapshotV1::from_comparison(&csv_a, &csv_b, &catalog_a, &catalog_b, &config, &results);
        let expected = serde_json::to_string_pretty(&owned).expect("owned snapshot");
        let actual =
            serialize_snapshot_v1(&csv_a, &csv_b, &catalog_a, &catalog_b, &config, &results)
                .expect("borrowed snapshot");

        assert_eq!(actual, expected);
    }
}
