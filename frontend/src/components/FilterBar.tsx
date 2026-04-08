import { ResultResponse, ResultType } from '../types/api';

interface FilterBarProps {
  filter: ResultType;
  results: ResultResponse[];
  onFilterChange: (filter: ResultType) => void;
  onExport: () => void;
}

export function FilterBar({ filter, results, onFilterChange, onExport }: FilterBarProps) {
  const counts = {
    all: results.length,
    match: results.filter(r => r.result_type === 'match').length,
    mismatch: results.filter(r => r.result_type === 'mismatch').length,
    missing_left: results.filter(r => r.result_type === 'missing_left').length,
    missing_right: results.filter(r => r.result_type === 'missing_right').length,
    duplicate: results.filter(r => r.result_type.startsWith('duplicate')).length,
  };

  const filters: { value: ResultType; label: string; color: string; activeColor: string }[] = [
    {
      value: 'all',
      label: 'All',
      color: 'border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
      activeColor: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white',
    },
    {
      value: 'match',
      label: 'Matches',
      color: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/45 dark:text-emerald-200',
      activeColor: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100',
    },
    {
      value: 'mismatch',
      label: 'Mismatches',
      color: 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-200',
      activeColor: 'bg-amber-200 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100',
    },
    {
      value: 'missing_left',
      label: 'Missing Left',
      color: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800/70 dark:bg-blue-950/45 dark:text-blue-200',
      activeColor: 'bg-blue-200 text-blue-900 dark:bg-blue-900/70 dark:text-blue-100',
    },
    {
      value: 'missing_right',
      label: 'Missing Right',
      color: 'border border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800/70 dark:bg-violet-950/45 dark:text-violet-200',
      activeColor: 'bg-violet-200 text-violet-900 dark:bg-violet-900/70 dark:text-violet-100',
    },
    {
      value: 'duplicate',
      label: 'Duplicates',
      color: 'border border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800/70 dark:bg-orange-950/45 dark:text-orange-200',
      activeColor: 'bg-orange-200 text-orange-900 dark:bg-orange-900/70 dark:text-orange-100',
    },
  ];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  filter === f.value
                    ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800'
                    : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1 dark:hover:ring-gray-600 dark:hover:ring-offset-gray-800'
                } ${f.color} ${filter === f.value ? f.activeColor : ''}`}
            >
              {f.label}
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-black/25">
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
