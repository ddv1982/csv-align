import type { AppFile } from './ui';

export type ColumnDataType = 'string' | 'integer' | 'float' | 'date';
export type FileLetter = 'a' | 'b';
export type MappingType = 'exact' | 'manual' | 'fuzzy';
export type CompareResultType =
  | 'match'
  | 'mismatch'
  | 'missing_left'
  | 'missing_right'
  | 'unkeyed_left'
  | 'unkeyed_right'
  | 'duplicate_file_a'
  | 'duplicate_file_b'
  | 'duplicate_both';

export interface ColumnInfo {
  index: number;
  name: string;
  data_type: ColumnDataType;
}

export interface FileLoadResponse {
  success: boolean;
  file_letter: FileLetter;
  file_name: string;
  headers: string[];
  virtual_headers?: string[];
  columns: ColumnInfo[];
  row_count: number;
}

export interface MappingDto {
  file_a_column: string;
  file_b_column: string;
  mapping_type: MappingType;
  similarity?: number;
}

export interface SuggestMappingsRequest {
  columns_a: string[];
  columns_b: string[];
}

export interface SuggestMappingsResponse {
  mappings: MappingDto[];
}

export interface CompareRequest {
  key_columns_a: string[];
  key_columns_b: string[];
  comparison_columns_a: string[];
  comparison_columns_b: string[];
  column_mappings: MappingDto[];
  normalization?: ComparisonNormalizationConfig;
}

export interface DateNormalizationConfig {
  enabled: boolean;
  formats: string[];
}

export interface DecimalRoundingConfig {
  enabled: boolean;
  decimals: number;
}

export interface ComparisonNormalizationConfig {
  treat_empty_as_null: boolean;
  null_tokens: string[];
  null_token_case_insensitive: boolean;
  case_insensitive: boolean;
  trim_whitespace: boolean;
  numeric_equivalence: boolean;
  decimal_rounding: DecimalRoundingConfig;
  date_normalization: DateNormalizationConfig;
}

export interface DifferenceResponse {
  column_a: string;
  column_b: string;
  value_a: string;
  value_b: string;
}

export interface ResultResponse {
  result_type: CompareResultType;
  key: string[];
  values_a: string[];
  values_b: string[];
  duplicate_values_a: string[][];
  duplicate_values_b: string[][];
  differences: DifferenceResponse[];
}

export interface SummaryResponse {
  total_rows_a: number;
  total_rows_b: number;
  matches: number;
  mismatches: number;
  missing_left: number;
  missing_right: number;
  unkeyed_left: number;
  unkeyed_right: number;
  duplicates_a: number;
  duplicates_b: number;
}

export interface CompareResponse {
  success: boolean;
  results: ResultResponse[];
  summary: SummaryResponse;
}

export interface SessionResponse {
  session_id: string;
}

export interface PairOrderSelection {
  key_columns_a: string[];
  key_columns_b: string[];
  comparison_columns_a: string[];
  comparison_columns_b: string[];
}

export interface LoadPairOrderResponse {
  selection: PairOrderSelection;
}

export interface ComparisonSnapshotFileResponse {
  name: string;
  headers: string[];
  virtual_headers: string[];
  columns: ColumnInfo[];
  row_count: number;
}

export interface LoadComparisonSnapshotResponse {
  file_a: ComparisonSnapshotFileResponse;
  file_b: ComparisonSnapshotFileResponse;
  selection: PairOrderSelection;
  mappings: MappingDto[];
  normalization: ComparisonNormalizationConfig;
  results: ResultResponse[];
  summary: SummaryResponse;
}

export type ResultFilter =
  | 'all'
  | 'match'
  | 'mismatch'
  | 'missing_left'
  | 'missing_right'
  | 'unkeyed_left'
  | 'unkeyed_right'
  | 'duplicate';

export interface AppState {
  sessionId: string | null;
  fileA: AppFile | null;
  fileB: AppFile | null;
  mappings: MappingDto[];
  results: ResultResponse[];
  summary: SummaryResponse | null;
  snapshotReadOnly: boolean;
  filter: ResultFilter;
  error: string | null;
  loading: boolean;
}
