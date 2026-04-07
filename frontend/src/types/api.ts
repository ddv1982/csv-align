export interface ColumnInfo {
  index: number;
  name: string;
  data_type: string;
}

export interface UploadResponse {
  success: boolean;
  file_letter: string;
  headers: string[];
  columns: ColumnInfo[];
  row_count: number;
}

export interface MappingRequest {
  file_a_column: string;
  file_b_column: string;
  mapping_type: string;
  similarity?: number;
}

export interface MappingResponse {
  file_a_column: string;
  file_b_column: string;
  mapping_type: string;
  similarity?: number;
}

export interface SuggestMappingsRequest {
  columns_a: string[];
  columns_b: string[];
}

export interface SuggestMappingsResponse {
  mappings: MappingResponse[];
}

export interface CompareRequest {
  key_columns_a: string[];
  key_columns_b: string[];
  comparison_columns_a: string[];
  comparison_columns_b: string[];
  column_mappings: MappingRequest[];
}

export interface DifferenceResponse {
  column_a: string;
  column_b: string;
  value_a: string;
  value_b: string;
}

export interface ResultResponse {
  result_type: string;
  key: string[];
  values_a: string[];
  values_b: string[];
  differences: DifferenceResponse[];
}

export interface SummaryResponse {
  total_rows_a: number;
  total_rows_b: number;
  matches: number;
  mismatches: number;
  missing_left: number;
  missing_right: number;
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

export interface ErrorResponse {
  error: string;
}

export type ResultType = 'all' | 'match' | 'mismatch' | 'missing_left' | 'missing_right' | 'duplicate';

export interface AppState {
  sessionId: string | null;
  fileA: {
    name: string;
    headers: string[];
    columns: ColumnInfo[];
    rowCount: number;
  } | null;
  fileB: {
    name: string;
    headers: string[];
    columns: ColumnInfo[];
    rowCount: number;
  } | null;
  mappings: MappingResponse[];
  results: ResultResponse[];
  summary: SummaryResponse | null;
  filter: ResultType;
  error: string | null;
  loading: boolean;
}
