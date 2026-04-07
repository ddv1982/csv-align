import { useState } from 'react';
import { ResultResponse } from '../types/api';

interface ResultsTableProps {
  results: ResultResponse[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getResultBadge = (resultType: string) => {
    switch (resultType) {
      case 'match':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Match' };
      case 'mismatch':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Mismatch' };
      case 'missing_left':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Missing Left' };
      case 'missing_right':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Missing Right' };
      default:
        if (resultType.startsWith('duplicate')) {
          return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Duplicate' };
        }
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: resultType };
    }
  };

  const getRowClassName = (resultType: string) => {
    switch (resultType) {
      case 'match':
        return 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/35';
      case 'mismatch':
        return 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/35';
      case 'missing_left':
        return 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/35';
      case 'missing_right':
        return 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/35';
      default:
        if (resultType.startsWith('duplicate')) {
          return 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/35';
        }
        return 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-700/70';
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                File A Values
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-300">
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
                <>
                  <tr
                    key={idx}
                    className={`transition-colors ${getRowClassName(result.result_type)}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
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
                          className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
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
                    <tr className="bg-gray-50 dark:bg-gray-800/70">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700"
                            >
                              <div className="flex-1">
                                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                                  {diff.column_a} → {diff.column_b}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200">
                                    {diff.value_a}
                                  </span>
                                  <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-700 dark:bg-green-900/40 dark:text-green-200">
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
                </>
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
