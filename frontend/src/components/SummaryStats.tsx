import { SummaryResponse } from '../types/api';

interface SummaryStatsProps {
  summary: SummaryResponse;
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const total = summary.matches + summary.mismatches + summary.missing_left + summary.missing_right;
  const matchPercent = total > 0 ? Math.round((summary.matches / total) * 100) : 0;

  const stats = [
    {
      label: 'Matches',
      value: summary.matches,
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
      textColor: 'text-green-700',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label: 'Mismatches',
      value: summary.mismatches,
      color: 'bg-yellow-500',
      lightColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      label: 'Missing Left',
      value: summary.missing_left,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      ),
    },
    {
      label: 'Missing Right',
      value: summary.missing_right,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Comparison Summary
        </h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            File A: <span className="font-semibold text-gray-900 dark:text-gray-100">{summary.total_rows_a}</span> rows
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            File B: <span className="font-semibold text-gray-900 dark:text-gray-100">{summary.total_rows_b}</span> rows
          </div>
        </div>
      </div>

      {/* Match Rate Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Match Rate</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{matchPercent}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
            style={{ width: `${matchPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.lightColor} rounded-xl p-4 transition-transform hover:scale-105`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`${stat.color} ${stat.textColor} w-8 h-8 rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              <span className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Duplicates Info */}
      {(summary.duplicates_a > 0 || summary.duplicates_b > 0) && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-700/60 dark:bg-orange-950/40">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Duplicates found: {summary.duplicates_a} in File A, {summary.duplicates_b} in File B
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
