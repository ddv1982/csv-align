import { FilterBar } from '../FilterBar';
import { ResultsTable } from '../ResultsTable';
import { SummaryStats } from '../SummaryStats';
import type { MappingDto, ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';
import { ArrowDownTrayIcon, CheckDocumentIcon, ExclamationTriangleIcon, PlusIcon } from '../icons';
import { NavButton } from '../ui/NavButton';
import { StepActionPanel, StepIntroCard } from '../ui/StepIntroCard';

interface ResultsStepProps {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  mappings: MappingDto[];
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
  mappings,
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
      <StepIntroCard
        eyebrow="Step 3 · Results"
        title="Review comparison results"
        description="Use the summary, filters, and detailed rows to decide what needs attention before export or review."
        action={
          snapshotReadOnly ? (
            <StepActionPanel
              title="Snapshot loaded in read-only mode"
              description="Loaded snapshots are read-only results. Start a new comparison to edit mappings or load different files."
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              iconClassName="tone-highlight-strong"
              className="lg:w-[25rem]"
            >
              <button
                type="button"
                onClick={onStartNewComparison}
                className="btn btn-primary mt-3 flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Start new comparison
              </button>
            </StepActionPanel>
          ) : (
            <StepActionPanel
              title="Save this result for later review"
              description="Save a snapshot of this comparison to reopen the same results later in read-only mode."
              icon={<CheckDocumentIcon className="h-5 w-5" />}
              iconClassName="tone-accent-strong"
              className="lg:w-[25rem]"
            >
              <div className="mt-3 flex flex-wrap gap-3">
                <NavButton direction="back" onClick={onBack}>
                  Back to configuration
                </NavButton>
                <button type="button" onClick={onSaveResult} className="btn btn-primary flex items-center gap-2">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Save result
                </button>
              </div>
            </StepActionPanel>
          )
        }
      />

      <SummaryStats summary={summary} fileAName={fileAName} fileBName={fileBName} />

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
        mappings={mappings}
      />
    </div>
  );
}
