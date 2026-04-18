import { ResultFilter, ResultResponse } from '../types/api';
import { getResultFilterCounts, RESULT_FILTER_OPTIONS } from '../features/results/presentation';
import { SectionCard } from './ui/SectionCard';
import { ArrowDownTrayIcon, FunnelIcon } from './icons';

interface FilterBarProps {
  filter: ResultFilter;
  results: ResultResponse[];
  onFilterChange: (filter: ResultFilter) => void;
  onExport: () => void;
}

export function FilterBar({ filter, results, onFilterChange, onExport }: FilterBarProps) {
  const counts = getResultFilterCounts(results);

  return (
    <SectionCard
      eyebrow="Results filter"
      title="Focus on the rows you care about"
      description="Switch between result buckets or export the full comparison as CSV."
      className="card overflow-hidden border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-900/85"
      icon={
        <FunnelIcon className="h-5 w-5" />
      }
      action={
        <button
          onClick={onExport}
          className="btn btn-primary shadow-sm shadow-primary-200/70 dark:shadow-none shrink-0"
          aria-label="Export comparison results as CSV"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export CSV
        </button>
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
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
                  isActive
                    ? 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700 dark:border-primary-500 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${f.accent}`}
                  aria-hidden="true"
                />
                {f.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
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
