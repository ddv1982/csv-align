import { ResultFilter, ResultResponse } from '../types/api';
import { getResultFilterCounts, RESULT_FILTER_OPTIONS } from '../features/results/presentation';

interface FilterBarProps {
  filter: ResultFilter;
  results: ResultResponse[];
  onFilterChange: (filter: ResultFilter) => void;
  onExport: () => void;
}

export function FilterBar({ filter, results, onFilterChange, onExport }: FilterBarProps) {
  const counts = getResultFilterCounts(results);

  return (
    <div className="card overflow-hidden border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-900/85">
      <div className="flex flex-col gap-4 border-b border-gray-200/80 bg-gray-50/80 px-5 py-4 dark:border-gray-700/80 dark:bg-gray-950/40 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">Results filter</p>
            <h3 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Focus on the rows you care about</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Switch between result buckets or export the full comparison as CSV.</p>
          </div>
        </div>

        <button onClick={onExport} className="btn btn-primary shadow-sm shadow-primary-200/70 dark:shadow-none shrink-0">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="px-5 py-4">
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
    </div>
  );
}
