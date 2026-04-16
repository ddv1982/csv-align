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
      <div className="card border-white/70 bg-white/95 p-12 text-center shadow-[0_26px_70px_-46px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_30px_80px_-52px_rgba(2,6,23,0.85)]">
        <svg className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-white/70 bg-white/95 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_34px_90px_-56px_rgba(2,6,23,0.9)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200/80 bg-gradient-to-r from-slate-50/95 via-white to-slate-50/90 dark:border-white/10 dark:from-slate-900/90 dark:via-slate-950/80 dark:to-slate-900/75">
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
          <tbody className="divide-y divide-gray-200/80 dark:divide-white/10">
            {results.map((result, idx) => {
              const badge = getResultBadge(result.result_type);
              const resultDescription = getResultDescription(result.result_type);
              const isExpanded = expandedRow === idx;

              return (
                <Fragment key={idx}>
                  <tr className="bg-white/80 transition-colors hover:bg-slate-50/90 dark:bg-slate-950/35 dark:hover:bg-white/[0.04]">
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
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200/90 bg-white px-2.5 py-1 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:border-white/20 dark:hover:text-gray-100"
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
                    <tr className="bg-slate-50/70 dark:bg-slate-950/55">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
                            >
                              <div className="flex-1">
                                <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                                  {diff.column_a} → {diff.column_b}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md border border-rose-200/90 bg-rose-50/90 px-2 py-1 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/[0.12] dark:text-rose-100">
                                    {diff.value_a}
                                  </span>
                                  <svg className="h-4 w-4 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-sm text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/[0.12] dark:text-emerald-100">
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
        <div className="border-t border-gray-200/80 bg-gradient-to-r from-slate-50/95 via-white to-slate-50/90 px-4 py-3 text-center dark:border-white/10 dark:from-slate-900/90 dark:via-slate-950/80 dark:to-slate-900/75">
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing {results.length} results. Use filters to narrow down.</p>
        </div>
      )}
    </div>
  );
}
