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

  const filters: { value: ResultType; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
    { value: 'match', label: 'Matches', color: 'bg-green-100 text-green-700' },
    { value: 'mismatch', label: 'Mismatches', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'missing_left', label: 'Missing Left', color: 'bg-blue-100 text-blue-700' },
    { value: 'missing_right', label: 'Missing Right', color: 'bg-purple-100 text-purple-700' },
    { value: 'duplicate', label: 'Duplicates', color: 'bg-orange-100 text-orange-700' },
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
                  ? 'ring-2 ring-primary-500 ring-offset-2'
                  : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
              } ${f.color}`}
            >
              {f.label}
              <span className="px-2 py-0.5 bg-white/50 rounded-full text-xs">
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
