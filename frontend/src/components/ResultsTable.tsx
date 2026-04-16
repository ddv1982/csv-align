import { Fragment, useState } from 'react';
import { ResultResponse } from '../types/api';
import { getResultBadge, getResultDescription } from '../features/results/presentation';

interface ResultsTableProps {
  results: ResultResponse[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const renderValueRows = (rows: string[][], fallback: string[]) => {
    const displayRows = rows.length > 0 ? rows : fallback.length > 0 ? [fallback] : [];

    if (displayRows.length === 0) {
      return <span className="italic text-gray-400 dark:text-gray-500">—</span>;
    }

    return (
      <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
        {displayRows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800/80">
            {row.length > 0 ? row.join(', ') : '—'}
          </div>
        ))}
      </div>
    );
  };

  if (results.length === 0) {
    return (
      <div className="card border-gray-200/90 bg-white p-12 text-center shadow-lg shadow-gray-200/60 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/25">
        <svg className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-gray-200/90 bg-white shadow-xl shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/30">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200/90 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-950/45">
            <tr>
              <th className="w-40 min-w-[11rem] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
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
              const resultDescription = getResultDescription(result.result_type);
              const isExpanded = expandedRow === idx;

              return (
                <Fragment key={idx}>
                  <tr className="bg-white transition-colors hover:bg-gray-50/80 dark:bg-gray-900/70 dark:hover:bg-gray-800/80">
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{result.key.join(', ')}</span>
                    </td>
                    <td className="px-4 py-3">{renderValueRows(result.duplicate_values_a, result.values_a)}</td>
                    <td className="px-4 py-3">{renderValueRows(result.duplicate_values_b, result.values_b)}</td>
                    <td className="px-4 py-3 align-top">
                      {result.differences.length > 0 ? (
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
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
                        <span className={`text-sm ${resultDescription ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          {resultDescription ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>

                  {isExpanded && result.differences.length > 0 && (
                    <tr className="bg-gray-50/80 dark:bg-gray-950/35">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 rounded-xl border border-gray-200/90 bg-white p-3 shadow-sm shadow-gray-200/70 dark:border-gray-600 dark:bg-gray-900/70 dark:shadow-none"
                            >
                              <div className="flex-1">
                                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                                  {diff.column_a} → {diff.column_b}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded border border-rose-200/90 bg-rose-50/90 px-2 py-1 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/35 dark:text-rose-200">
                                    {diff.value_a}
                                  </span>
                                  <svg className="h-4 w-4 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="rounded border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/35 dark:text-emerald-200">
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

      {results.length > 50 && (
        <div className="border-t border-gray-200/90 bg-gray-50/90 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-950/45">
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing {results.length} results. Use filters to narrow down.</p>
        </div>
      )}
    </div>
  );
}
