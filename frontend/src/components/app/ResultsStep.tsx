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
        <div className="rounded-2xl border border-sky-200/85 bg-gradient-to-r from-sky-50/95 via-white to-sky-50/90 px-5 py-4 shadow-[0_20px_44px_-34px_rgba(14,165,233,0.45)] dark:border-sky-400/25 dark:from-sky-500/[0.12] dark:via-slate-950/80 dark:to-sky-500/[0.08] dark:shadow-[0_26px_54px_-40px_rgba(56,189,248,0.48)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200/80 shadow-sm shadow-white/40">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 6a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">Snapshot loaded in read-only mode</p>
              <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-200">
                Loaded snapshots are read-only results. Use Reset to start a new comparison.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_22px_52px_-40px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_24px_56px_-42px_rgba(2,6,23,0.86)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save this result for later review</h3>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">Save a snapshot of this comparison to reopen the same results later in read-only mode.</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button onClick={onBack} className="btn btn-secondary flex items-center gap-2 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.18)] dark:shadow-none">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to configuration
              </button>
              <button onClick={onSaveResult} className="btn btn-primary flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 shadow-[0_20px_36px_-24px_rgba(37,99,235,0.7)] hover:from-primary-700 hover:to-primary-600 dark:shadow-[0_22px_42px_-28px_rgba(37,99,235,0.65)]">
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
