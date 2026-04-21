import type { MappingDto, ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { RESULT_FILTER_OPTIONS, buildResultRows, getResultFilterCounts } from './presentation';
import { renderResultsHtmlDocument } from './htmlExportTemplate';

type HtmlExportDocument = {
  generatedAt: string;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
  summary: SummaryResponse;
  filterOptions: Array<{ value: ResultFilter; label: string; count: number }>;
  initialFilter: ResultFilter;
  rows: ReturnType<typeof buildResultRows>;
};

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
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
}): HtmlExportDocument {
  const counts = getResultFilterCounts(params.results);

  return {
    generatedAt: new Date().toISOString(),
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
}): string {
  const exportDocument = buildHtmlExportDocument(params);
  return renderResultsHtmlDocument(exportDocument, escapeJsonForHtml(exportDocument));
}
