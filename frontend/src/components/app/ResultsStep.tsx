import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { NavButton } from '../ui/NavButton';
import { SectionCard } from '../ui/SectionCard';
import { ArrowPathIcon, CheckDocumentIcon, InformationCircleIcon, PencilSquareIcon } from '../icons';

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
            <InformationCircleIcon className="h-5 w-5" />
          }
          action={
            <button
              onClick={onStartNewComparison}
              className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary-200/70 dark:shadow-none"
            >
              <ArrowPathIcon className="h-4 w-4" />
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
            <PencilSquareIcon className="h-5 w-5" />
          }
          action={
            <div className="flex flex-wrap justify-end gap-3 lg:shrink-0">
              <NavButton direction="back" onClick={onBack} className="shadow-sm shadow-gray-200/70 dark:shadow-none">
                Back to configuration
              </NavButton>
              <button onClick={onSaveResult} className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary-200/70 dark:shadow-none">
                <CheckDocumentIcon className="h-4 w-4" />
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
