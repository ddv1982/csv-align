import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';

interface ResultsStepProps {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  filter: ResultFilter;
  results: ResultResponse[];
  filteredResults: ResultResponse[];
  snapshotReadOnly: boolean;
  onFilterChange: (filter: ResultFilter) => void;
  onExport: () => void;
  onSaveResult: () => void;
  onBack: () => void;
}

export function ResultsStep({
  summary,
  fileAName,
  fileBName,
  filter,
  results,
  filteredResults,
  snapshotReadOnly,
  onFilterChange,
  onExport,
  onSaveResult,
  onBack,
}: ResultsStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <SummaryStats summary={summary} fileAName={fileAName} fileBName={fileBName} />

      {snapshotReadOnly ? (
        <div className="rounded-xl border border-primary-200/80 bg-primary-50/80 px-4 py-3 text-sm text-primary-900 dark:border-primary-500/30 dark:bg-primary-950/30 dark:text-primary-100">
          Loaded snapshots are read-only results. Use Reset to start a new comparison.
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm shadow-gray-950/5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save this result for later review</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Save a snapshot of this comparison to reopen the same results later in read-only mode.</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button onClick={onBack} className="btn btn-secondary flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to configuration
              </button>
              <button onClick={onSaveResult} className="btn btn-primary flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
                Save result
              </button>
            </div>
          </div>
        </div>
      )}

      <FilterBar filter={filter} results={results} onFilterChange={onFilterChange} onExport={onExport} />
      <ResultsTable results={filteredResults} />
    </div>
  );
}
