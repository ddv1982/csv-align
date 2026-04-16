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
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {RESULT_FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                filter === f.value
                  ? 'border-primary-200 bg-primary-50 text-gray-900 ring-2 ring-primary-500/70 ring-offset-1 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:ring-primary-400/60 dark:ring-offset-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 shadow-sm shadow-gray-950/5 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:shadow-none dark:hover:border-gray-600 dark:hover:bg-gray-800'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${f.accent}`} aria-hidden="true" />
              {f.label}
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700/70 dark:text-gray-200">
                {counts[f.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={onExport}
          className="btn btn-primary flex items-center gap-2"
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
