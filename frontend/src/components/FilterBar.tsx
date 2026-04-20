import { ResultFilter, ResultResponse } from '../types/api';
import { getResultFilterCounts, RESULT_FILTER_OPTIONS } from '../features/results/presentation';
import { ArrowDownTrayIcon, FunnelIcon } from './icons';
import { SectionCard } from './ui/SectionCard';

interface FilterBarProps {
  filter: ResultFilter;
  results: ResultResponse[];
  onFilterChange: (filter: ResultFilter) => void;
  onExportCsv: () => void;
  onExportHtml: () => void;
}

export function FilterBar({ filter, results, onFilterChange, onExportCsv, onExportHtml }: FilterBarProps) {
  const counts = getResultFilterCounts(results);

  return (
    <SectionCard
      eyebrow="Results filter"
      title="Focus on the rows you care about"
      description="Switch between result buckets or export the full comparison as HTML or CSV."
      className="overflow-hidden"
      icon={<FunnelIcon className="h-5 w-5" />}
      action={
        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            onClick={onExportHtml}
            className="btn btn-secondary shrink-0"
            aria-label="Export comparison results as HTML"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export HTML
          </button>
          <button
            onClick={onExportCsv}
            className="btn btn-primary shrink-0"
            aria-label="Export comparison results as CSV"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      }
    >
      <div>
        <div className="flex flex-wrap gap-2">
          {RESULT_FILTER_OPTIONS.map((f) => {
            const isActive = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium transition-colors ${
                   isActive
                    ? 'kinetic-filter-chip-active'
                    : 'kinetic-filter-chip'
                  }`}
              >
                <span
                  className={`h-2 w-2 border ${f.accent}`}
                  aria-hidden="true"
                />
                {f.label}
                <span
                  className={`px-2 py-0.5 text-xs font-semibold tabular-nums ${
                     isActive
                      ? 'kinetic-filter-count-active'
                      : 'kinetic-filter-count'
                    }`}
                >
                  {counts[f.value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
