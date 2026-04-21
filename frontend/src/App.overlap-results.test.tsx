import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

vi.mock('./components/app/AppHeader', () => ({
  AppHeader: () => <div>Header</div>,
}));

vi.mock('./components/app/ProgressSteps', () => ({
  ProgressSteps: () => <div>Progress</div>,
}));

vi.mock('./components/app/ErrorBanner', () => ({
  ErrorBanner: () => <div>Error</div>,
}));

vi.mock('./components/app/LoadingState', () => ({
  LoadingState: () => <div>Loading</div>,
}));

vi.mock('./components/app/FileSelectionStep', () => ({
  FileSelectionStep: () => <div>Select</div>,
}));

vi.mock('./components/app/ConfigurationStep', () => ({
  ConfigurationStep: () => <div>Configure</div>,
}));

vi.mock('./components/app/ResultsStep', () => ({
  ResultsStep: ({ comparisonColumnsA, comparisonColumnsB }: { comparisonColumnsA: string[]; comparisonColumnsB: string[] }) => (
    <div data-testid="results-columns">{JSON.stringify({ comparisonColumnsA, comparisonColumnsB })}</div>
  ),
}));

vi.mock('./hooks/useComparisonWorkflow', () => ({
  useComparisonWorkflow: () => ({
    state: {
      error: null,
      loading: false,
      fileA: { name: 'left.csv' },
      fileB: { name: 'right.csv' },
      summary: {
        total_rows_a: 1,
        total_rows_b: 1,
        matches: 1,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        unkeyed_left: 0,
        unkeyed_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
      },
      mappings: [],
      filter: 'all',
      results: [],
    },
    step: 'results',
    mappingSelection: {
      keyColumnsA: ['id'],
      keyColumnsB: ['record_id'],
      comparisonColumnsA: ['id', 'first_name', 'nickname'],
      comparisonColumnsB: ['record_id', 'alias', 'full_name'],
    },
    normalizationConfig: {
      treat_empty_as_null: false,
      null_tokens: [],
      null_token_case_insensitive: false,
      case_insensitive: false,
      trim_whitespace: false,
      date_normalization: { enabled: false, formats: [] },
    },
    filteredResults: [],
    isSnapshotReadOnly: false,
    unlockedSteps: ['select', 'configure', 'results'],
    setMappingSelection: vi.fn(),
    setNormalizationConfig: vi.fn(),
    handleFileSelection: vi.fn(),
    handleCompare: vi.fn(),
    handleExportCsv: vi.fn(),
    handleExportHtml: vi.fn(),
    handleSaveComparisonSnapshot: vi.fn(),
    handleLoadComparisonSnapshot: vi.fn(),
    handleSavePairOrder: vi.fn(),
    handleLoadPairOrder: vi.fn(),
    handleAutoPairComparisonColumns: vi.fn(),
    handleFilterChange: vi.fn(),
    handleReset: vi.fn(),
    handleStepNavigation: vi.fn(),
    handleBackToConfigure: vi.fn(),
    handleBackToSelection: vi.fn(),
    handleContinueToConfigure: vi.fn(),
  }),
}));

import App from './App';

test('passes overlapping comparison pairs into the results step', () => {
  render(<App />);

  expect(screen.getByTestId('results-columns')).toHaveTextContent(
    '{"comparisonColumnsA":["id","first_name","nickname"],"comparisonColumnsB":["record_id","alias","full_name"]}',
  );
});
