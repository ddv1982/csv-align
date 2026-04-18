import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { SectionCard } from '../ui/SectionCard';

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
  onStartNewComparison: () => void;
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
  onStartNewComparison,
}: ResultsStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <SummaryStats summary={summary} fileAName={fileAName} fileBName={fileBName} />

      {snapshotReadOnly ? (
        <SectionCard
          eyebrow="Read-only snapshot"
          title="Snapshot loaded in read-only mode"
          description="Loaded snapshots are read-only results. Start a new comparison to edit mappings or load different files."
          tone="info"
          className="border-sky-200/90 bg-sky-50/95 px-5 py-4 shadow-sm shadow-sky-100/70 dark:border-sky-500/40 dark:bg-sky-950/35"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 6a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          }
          action={
            <button
              onClick={onStartNewComparison}
              className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary-200/70 dark:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Start new comparison
            </button>
          }
        >
          <div />
        </SectionCard>
      ) : (
        <SectionCard
          eyebrow="Next step"
          title="Save this result for later review"
          description="Save a snapshot of this comparison to reopen the same results later in read-only mode."
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-6 4h6" />
            </svg>
          }
          action={
            <div className="flex flex-wrap justify-end gap-3 lg:shrink-0">
              <button onClick={onBack} className="btn btn-secondary flex items-center gap-2 shadow-sm shadow-gray-200/70 dark:shadow-none">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to configuration
              </button>
              <button onClick={onSaveResult} className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary-200/70 dark:shadow-none">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
                Save result
              </button>
            </div>
          }
        >
          <div />
        </SectionCard>
      )}

      <FilterBar filter={filter} results={results} onFilterChange={onFilterChange} onExport={onExport} />
      <ResultsTable results={filteredResults} />
    </div>
  );
}
