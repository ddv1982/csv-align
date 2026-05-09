import type { MappingDto, ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { RESULT_FILTER_OPTIONS, buildResultRows, getResultFilterCounts, type ResultFilterTone } from './presentation';
import { renderResultsHtmlDocument } from './htmlExportTemplate';

type HtmlExportTheme = 'dark';

const HTML_EXPORT_THEME: HtmlExportTheme = 'dark';

type HtmlExportDocument = {
  generatedAt: string;
  theme: HtmlExportTheme;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number; tone: ResultFilterTone }>;
  initialFilter: ResultFilter;
  rows: ReturnType<typeof buildResultRows>;
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

function buildHtmlExportDocument(params: {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  results: ResultResponse[];
  initialFilter: ResultFilter;
  theme?: string | null;
}): HtmlExportDocument {
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
    initialFilter: params.initialFilter,
    rows: buildResultRows(params.results, {
      fileA: params.comparisonColumnsA,
      fileB: params.comparisonColumnsB,
      mappings: params.mappings,
    }),
  };
}

export function buildResultsHtmlDocument(params: {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  results: ResultResponse[];
  initialFilter: ResultFilter;
  theme?: string | null;
}): string {
  const exportDocument = buildHtmlExportDocument(params);
  return renderResultsHtmlDocument(exportDocument, escapeJsonForHtml(exportDocument));
}
