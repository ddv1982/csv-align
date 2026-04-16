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
    <div className="card border-gray-200/90 bg-white shadow-lg shadow-gray-200/60 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/25">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Results filter</p>
          <div className="flex flex-wrap gap-2">
            {RESULT_FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                  filter === f.value
                    ? 'border-primary-200 bg-primary-50 text-primary-950 shadow-sm shadow-primary-100 ring-2 ring-primary-500/25 ring-offset-1 dark:border-primary-300/60 dark:bg-primary-400/20 dark:text-primary-50 dark:shadow-none dark:ring-primary-300/35 dark:ring-offset-gray-900'
                    : 'border-gray-200/90 bg-gray-50/80 text-gray-700 hover:border-gray-300 hover:bg-white dark:border-gray-700 dark:bg-gray-950/35 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800/90'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-white/80 dark:ring-gray-900 ${f.accent}`} aria-hidden="true" />
                {f.label}
                <span className="rounded-full border border-gray-200/90 bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800/90 dark:text-gray-100">
                  {counts[f.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onExport}
          className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary-200/70 dark:shadow-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  );
}
