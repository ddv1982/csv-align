import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { CheckDocumentIcon, ExclamationTriangleIcon } from '../icons';
import { NavButton } from '../ui/NavButton';
import { SectionCard } from '../ui/SectionCard';

interface ResultsStepProps {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  filter: ResultFilter;
  results: ResultResponse[];
  filteredResults: ResultResponse[];
  snapshotReadOnly: boolean;
  onFilterChange: (filter: ResultFilter) => void;
  onExportCsv: () => void;
  onExportHtml: () => void;
  onSaveResult: () => void;
  onBack: () => void;
  onStartNewComparison: () => void;
}

export function ResultsStep({
  summary,
  fileAName,
  fileBName,
  comparisonColumnsA,
  comparisonColumnsB,
  filter,
  results,
  filteredResults,
  snapshotReadOnly,
  onFilterChange,
  onExportCsv,
  onExportHtml,
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
          className="kinetic-tone-highlight px-5 py-4"
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
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
          icon={<CheckDocumentIcon className="h-5 w-5" />}
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

      <FilterBar
        filter={filter}
        results={results}
        onFilterChange={onFilterChange}
        onExportCsv={onExportCsv}
        onExportHtml={onExportHtml}
      />
      <ResultsTable
        results={filteredResults}
        totalResultsCount={results.length}
        comparisonColumnsA={comparisonColumnsA}
        comparisonColumnsB={comparisonColumnsB}
      />
    </div>
  );
}
