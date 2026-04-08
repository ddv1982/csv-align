import { Fragment, useState } from 'react';
import { ResultResponse } from '../types/api';

interface ResultsTableProps {
  results: ResultResponse[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getResultBadge = (resultType: string) => {
    switch (resultType) {
      case 'match':
        return {
          bg: 'border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25',
          text: 'text-emerald-800 dark:text-emerald-200',
          dot: 'bg-emerald-500 dark:bg-emerald-400',
          label: 'Match',
        };
      case 'mismatch':
        return {
          bg: 'border border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25',
          text: 'text-amber-800 dark:text-amber-200',
          dot: 'bg-amber-500 dark:bg-amber-400',
          label: 'Mismatch',
        };
      case 'missing_left':
        return {
          bg: 'border border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25',
          text: 'text-sky-800 dark:text-sky-200',
          dot: 'bg-sky-500 dark:bg-sky-400',
          label: 'Missing Left',
        };
      case 'missing_right':
        return {
          bg: 'border border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/25',
          text: 'text-violet-800 dark:text-violet-200',
          dot: 'bg-violet-500 dark:bg-violet-400',
          label: 'Missing Right',
        };
      default:
        if (resultType.startsWith('duplicate')) {
          return {
            bg: 'border border-orange-200 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/25',
            text: 'text-orange-800 dark:text-orange-200',
            dot: 'bg-orange-500 dark:bg-orange-400',
            label: 'Duplicate',
          };
        }
        return {
          bg: 'border border-gray-200 bg-gray-100/70 dark:border-gray-700 dark:bg-gray-800/70',
          text: 'text-gray-700 dark:text-gray-200',
          dot: 'bg-gray-500 dark:bg-gray-400',
          label: resultType,
        };
    }
  };

  if (results.length === 0) {
    return (
      <div className="card p-12 text-center">
        <svg className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <tr>
              <th className="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                File A Values
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                File B Values
              </th>
              <th className="w-32 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result, idx) => {
              const badge = getResultBadge(result.result_type);
              const isExpanded = expandedRow === idx;
              
              return (
                <Fragment key={idx}>
                  <tr
                    className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900/70 dark:hover:bg-gray-800/70"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {result.key.join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {result.values_a.length > 0 ? (
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {result.values_a.map((v, i) => (
                            <span key={i} className="inline-block mr-2">
                              {v}
                              {i < result.values_a.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="italic text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result.values_b.length > 0 ? (
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {result.values_b.map((v, i) => (
                            <span key={i} className="inline-block mr-2">
                              {v}
                              {i < result.values_b.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="italic text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result.differences.length > 0 ? (
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : idx)}
                            className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                          >
                            {result.differences.length} diff{result.differences.length > 1 ? 's' : ''}
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded Differences */}
                  {isExpanded && result.differences.length > 0 && (
                    <tr className="bg-gray-50/70 dark:bg-gray-800/60">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800/80"
                            >
                              <div className="flex-1">
                                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                                  {diff.column_a} → {diff.column_b}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded border border-rose-200 bg-rose-50/80 px-2 py-1 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-200">
                                    {diff.value_a}
                                  </span>
                                  <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="rounded border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200">
                                    {diff.value_b}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination hint */}
      {results.length > 50 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {results.length} results. Use filters to narrow down.
          </p>
        </div>
      )}
    </div>
  );
}
