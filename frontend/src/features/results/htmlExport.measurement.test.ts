// oxlint-disable no-console
import { expect, test } from 'vitest';
import type { ResultResponse, SummaryResponse } from '../../types/api';
import { measureResultsHtmlDocumentRepresentation } from './htmlExport';

type MeasurementProcess = {
  env: Record<string, string | undefined>;
  memoryUsage: () => { heapUsed: number; rss: number };
  resourceUsage: () => { maxRSS: number };
};

const nodeProcess = (globalThis as typeof globalThis & { process: MeasurementProcess }).process;
const rowCount = Number(nodeProcess.env.HTML_EXPORT_MEASURE_ROWS ?? 0);
const supportedRowCounts = [1_000, 10_000, 50_000];
const measurementTest =
  nodeProcess.env.HTML_EXPORT_MEASURE === '1' && supportedRowCounts.includes(rowCount)
    ? test
    : test.skip;

function buildFixture(count: number): {
  results: ResultResponse[];
  summary: SummaryResponse;
} {
  const results = Array.from({ length: count }, (_, index): ResultResponse => ({
    result_type: index % 10 === 0 ? 'mismatch' : 'match',
    key: [String(index)],
    values_a: [`Customer ${index}`, `city-${index % 100}`],
    values_b: [
      index % 10 === 0 ? `Customer ${index} updated` : `Customer ${index}`,
      `city-${index % 100}`,
    ],
    duplicate_values_a: [],
    duplicate_values_b: [],
    differences: index % 10 === 0
      ? [{
          column_a: 'name',
          column_b: 'display_name',
          value_a: `Customer ${index}`,
          value_b: `Customer ${index} updated`,
        }]
      : [],
  }));

  return {
    results,
    summary: {
      total_rows_a: count,
      total_rows_b: count,
      matches: count - Math.floor(count / 10),
      mismatches: Math.floor(count / 10),
      missing_left: 0,
      missing_right: 0,
      unkeyed_left: 0,
      unkeyed_right: 0,
      duplicates_a: 0,
      duplicates_b: 0,
    },
  };
}

measurementTest(`measures the HTML representation for ${rowCount} rows in an isolated process`, () => {
  const fixture = buildFixture(rowCount);
  const memoryBefore = nodeProcess.memoryUsage();
  const processMaxRssBefore = nodeProcess.resourceUsage().maxRSS * 1024;
  const metrics = measureResultsHtmlDocumentRepresentation({
    ...fixture,
    fileAName: 'customers-a.csv',
    fileBName: 'customers-b.csv',
    comparisonColumnsA: ['name', 'city'],
    comparisonColumnsB: ['display_name', 'city'],
    mappings: [
      { file_a_column: 'name', file_b_column: 'display_name', mapping_type: 'manual' },
      { file_a_column: 'city', file_b_column: 'city', mapping_type: 'manual' },
    ],
    initialFilter: 'all',
  });
  const memoryAfter = nodeProcess.memoryUsage();
  const processMaxRssAfter = nodeProcess.resourceUsage().maxRSS * 1024;
  const report = {
    ...metrics,
    heapDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
    rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
    isolatedProcessMaxRssBytes: processMaxRssAfter,
    isolatedProcessMaxRssIncreaseBytes: Math.max(0, processMaxRssAfter - processMaxRssBefore),
  };

  console.info(`HTML_EXPORT_MEASUREMENT ${JSON.stringify(report)}`);

  expect(report.rowCount).toBe(rowCount);
  if (rowCount === 50_000) {
    expect(report).toMatchObject({
      outcome: 'rejected',
      limitKind: 'data',
      actual: report.serializedDataBytes,
      documentBytes: null,
    });
    return;
  }

  expect(report.outcome).toBe('success');
  expect(report.serializedDataBytes).toBeGreaterThan(0);
  expect(report.documentBytes).toBeGreaterThan(report.serializedDataBytes ?? 0);
});
