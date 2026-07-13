import type { MappingDto, ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import {
  RESULT_FILTER_OPTIONS,
  buildResultRows,
  getResultFilterCounts,
  type ResultFilterTone,
  type ResultRowViewModel,
} from './presentation';
import { getSearchableFieldOptions, type SearchableFieldOption } from './search';
import { renderResultsHtmlDocument } from './htmlExportTemplate';
import {
  HtmlExportLimitError,
  type HtmlExportLimitKind,
  utf8ByteLength,
  validateHtmlExportDataByteLength,
  validateHtmlExportDocumentByteLength,
  validateHtmlExportRowCount,
} from './htmlExportLimits';

type HtmlExportTheme = 'dark';

const HTML_EXPORT_THEME: HtmlExportTheme = 'dark';

export type HtmlExportDocument = {
  generatedAt: string;
  theme: HtmlExportTheme;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number; tone: ResultFilterTone }>;
  searchFields: SearchableFieldOption[];
  initialFilter: ResultFilter;
  rows: ResultRowViewModel[];
};

export type HtmlExportParams = {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  results: ResultResponse[];
  initialFilter: ResultFilter;
  theme?: string | null;
};

export type HtmlExportRepresentationMetrics = {
  rowCount: number;
  serializedDataBytes: number | null;
  documentBytes: number | null;
  outcome: 'success' | 'rejected';
  limitKind: HtmlExportLimitKind | null;
  actual: number | null;
  limit: number | null;
};

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function normalizeHtmlExportTheme(_rawTheme: string | undefined | null): HtmlExportTheme {
  return HTML_EXPORT_THEME;
}

function buildHtmlExportDocument(params: HtmlExportParams): HtmlExportDocument {
  const counts = getResultFilterCounts(params.results);

  return {
    generatedAt: new Date().toISOString(),
    theme: normalizeHtmlExportTheme(params.theme),
    fileAName: params.fileAName,
    fileBName: params.fileBName,
    comparisonColumnsA: params.comparisonColumnsA,
    comparisonColumnsB: params.comparisonColumnsB,
    mappings: params.mappings,
    summary: params.summary,
    filterOptions: RESULT_FILTER_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: counts[option.value],
      tone: option.tone,
    })),
    searchFields: getSearchableFieldOptions(),
    initialFilter: params.initialFilter,
    rows: buildResultRows(params.results, {
      fileA: params.comparisonColumnsA,
      fileB: params.comparisonColumnsB,
      mappings: params.mappings,
    }),
  };
}

function serializeHtmlExport(params: HtmlExportParams): {
  exportDocument: HtmlExportDocument;
  serializedData: string;
  serializedDataBytes: number;
} {
  const exportDocument = buildHtmlExportDocument(params);
  const serializedData = escapeJsonForHtml(exportDocument);

  return {
    exportDocument,
    serializedData,
    serializedDataBytes: utf8ByteLength(serializedData),
  };
}

function buildBoundedResultsHtmlDocument(params: HtmlExportParams): {
  htmlDocument: string;
  metrics: HtmlExportRepresentationMetrics;
} {
  validateHtmlExportRowCount(params.results.length);

  const {
    exportDocument,
    serializedData,
    serializedDataBytes,
  } = serializeHtmlExport(params);
  validateHtmlExportDataByteLength(serializedDataBytes);

  const htmlDocument = renderResultsHtmlDocument(exportDocument, serializedData);
  const documentBytes = utf8ByteLength(htmlDocument);
  validateHtmlExportDocumentByteLength(documentBytes);

  return {
    htmlDocument,
    metrics: {
      rowCount: params.results.length,
      serializedDataBytes,
      documentBytes,
      outcome: 'success',
      limitKind: null,
      actual: null,
      limit: null,
    },
  };
}

export function buildResultsHtmlDocument(params: HtmlExportParams): string {
  return buildBoundedResultsHtmlDocument(params).htmlDocument;
}

/** Repeatable instrumentation of the same bounded pipeline used in production. */
export function measureResultsHtmlDocumentRepresentation(
  params: HtmlExportParams,
): HtmlExportRepresentationMetrics {
  try {
    return buildBoundedResultsHtmlDocument(params).metrics;
  } catch (error) {
    if (!(error instanceof HtmlExportLimitError)) {
      throw error;
    }

    return {
      rowCount: params.results.length,
      serializedDataBytes: error.kind === 'data' ? error.actual : null,
      documentBytes: error.kind === 'document' ? error.actual : null,
      outcome: 'rejected',
      limitKind: error.kind,
      actual: error.actual,
      limit: error.limit,
    };
  }
}
