import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { RESULT_FILTER_OPTIONS, buildResultRows, getResultFilterCounts } from './presentation';
import { renderResultsHtmlDocument } from './htmlExportTemplate';

type HtmlExportDocument = {
  generatedAt: string;
  fileAName: string;
  fileBName: string;
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
  results: ResultResponse[];
  initialFilter: ResultFilter;
}): HtmlExportDocument {
  const counts = getResultFilterCounts(params.results);

  return {
    generatedAt: new Date().toISOString(),
    fileAName: params.fileAName,
    fileBName: params.fileBName,
    summary: params.summary,
    filterOptions: RESULT_FILTER_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: counts[option.value],
    })),
    initialFilter: params.initialFilter,
    rows: buildResultRows(params.results),
  };
}

export function buildResultsHtmlDocument(params: {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  results: ResultResponse[];
  initialFilter: ResultFilter;
}): string {
  const exportDocument = buildHtmlExportDocument(params);
  return renderResultsHtmlDocument(exportDocument, escapeJsonForHtml(exportDocument));
}
