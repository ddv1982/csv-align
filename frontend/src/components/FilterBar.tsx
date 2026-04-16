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
    <div className="card border-white/70 bg-white/95 shadow-[0_26px_70px_-46px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_30px_80px_-52px_rgba(2,6,23,0.85)]">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Results filter</p>
          <div className="flex flex-wrap gap-2">
            {RESULT_FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  filter === f.value
                    ? 'border-primary-500/20 bg-primary-600 text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.55)] ring-1 ring-primary-300/40 dark:border-primary-400/20 dark:bg-primary-500 dark:text-white dark:ring-primary-300/35'
                    : 'border-gray-200/90 bg-gray-50/80 text-gray-700 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-[0_16px_28px_-22px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:shadow-[0_18px_30px_-22px_rgba(2,6,23,0.75)]'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-white/80 dark:ring-slate-950 ${f.accent}`} aria-hidden="true" />
                {f.label}
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  filter === f.value
                    ? 'border-white/20 bg-white/15 text-white'
                    : 'border-gray-200/90 bg-white text-gray-600 dark:border-white/10 dark:bg-slate-900/80 dark:text-gray-100'
                }`}>
                  {counts[f.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onExport}
          className="btn btn-primary flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 shadow-[0_20px_34px_-24px_rgba(37,99,235,0.7)] hover:from-primary-700 hover:to-primary-600 dark:shadow-[0_20px_40px_-24px_rgba(37,99,235,0.65)]"
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
