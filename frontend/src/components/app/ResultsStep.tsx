import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { NavButton } from '../ui/NavButton';
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
          className="border-[rgba(255,211,110,0.4)] bg-[rgba(255,211,110,0.05)] px-5 py-4"
          icon={<span aria-hidden="true">!!</span>}
          action={
            <button
              onClick={onStartNewComparison}
              className="btn btn-primary flex items-center gap-2"
            >
              <span aria-hidden="true">++</span>
              Start new comparison
            </button>
          }
        >
        </SectionCard>
      ) : (
        <SectionCard
          eyebrow="Next step"
          title="Save this result for later review"
          description="Save a snapshot of this comparison to reopen the same results later in read-only mode."
          icon={<span aria-hidden="true">[]</span>}
          action={
            <div className="flex flex-wrap justify-end gap-3 lg:shrink-0">
              <NavButton direction="back" onClick={onBack}>
                Back to configuration
              </NavButton>
              <button onClick={onSaveResult} className="btn btn-primary flex items-center gap-2">
                <span aria-hidden="true">##</span>
                Save result
              </button>
            </div>
          }
        >
        </SectionCard>
      )}

      <FilterBar filter={filter} results={results} onFilterChange={onFilterChange} onExport={onExport} />
      <ResultsTable results={filteredResults} totalResultsCount={results.length} />
    </div>
  );
}
