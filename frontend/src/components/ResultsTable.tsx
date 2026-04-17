import { Fragment, useMemo, useState } from 'react';
import { ResultResponse } from '../types/api';
import { getResultBadge, getResultDescription } from '../features/results/presentation';

interface ResultsTableProps {
  results: ResultResponse[];
}

type SortColumn = 'type' | 'key' | 'fileA' | 'fileB' | 'details';
type SortDirection = 'asc' | 'desc';

interface ResultRowEntry {
  id: string;
  result: ResultResponse;
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const resultEntries = useMemo<ResultRowEntry[]>(() => {
    return results.map((result, index) => ({
      id: `${index}-${result.result_type}-${result.key.join('|')}`,
      result,
    }));
  }, [results]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleResults = useMemo(() => {
    const filtered = normalizedSearch.length === 0
      ? resultEntries
      : resultEntries.filter(({ result }) => {
          const searchableText = [
            getResultBadge(result.result_type).label,
            result.key.join(' '),
            result.values_a.join(' '),
            result.values_b.join(' '),
            result.duplicate_values_a.flat().join(' '),
            result.duplicate_values_b.flat().join(' '),
            result.differences
              .flatMap((diff) => [diff.column_a, diff.column_b, diff.value_a, diff.value_b])
              .join(' '),
          ]
            .join(' ')
            .toLowerCase();

          return searchableText.includes(normalizedSearch);
        });

    if (!sortColumn) {
      return filtered;
    }

    const getComparableValue = ({ result }: ResultRowEntry) => {
      switch (sortColumn) {
        case 'type':
          return getResultBadge(result.result_type).label;
        case 'key':
          return result.key.join(' ');
        case 'fileA':
          return [...result.values_a, ...result.duplicate_values_a.flat()].join(' ');
        case 'fileB':
          return [...result.values_b, ...result.duplicate_values_b.flat()].join(' ');
        case 'details':
          return result.differences.length;
      }
    };

    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...filtered].sort((left, right) => {
      const leftValue = getComparableValue(left);
      const rightValue = getComparableValue(right);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * direction;
    });
  }, [normalizedSearch, resultEntries, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  const renderSortHeader = (label: string, column: SortColumn, className: string) => {
    const isActive = sortColumn === column;

    return (
      <th className={className} aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1 rounded-md text-left transition-colors hover:text-gray-900 dark:hover:text-gray-100"
        >
          {label}
          <span className={`text-[10px] ${isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`} aria-hidden="true">
            {isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

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
      <div className="flex flex-col gap-3 border-b border-gray-200/90 bg-gray-50/90 px-5 py-4 dark:border-gray-700 dark:bg-gray-950/45 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">Detailed results</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Comparison results</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {visibleResults.length} of {results.length} rows shown
            </p>
          </div>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search result values</span>
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search keys or values"
            className="input pl-9 pr-3 text-sm"
          />
        </label>
      </div>

      {visibleResults.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.5 15.5L19 19m-9-1a6 6 0 110-12 6 6 0 010 12z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No results match the current filter and search.</p>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200/90 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-950/45">
            <tr>
              {renderSortHeader('Type', 'type', 'w-40 min-w-[11rem] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('Key', 'key', 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('File A Values', 'fileA', 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('File B Values', 'fileB', 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('Details', 'details', 'w-32 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {visibleResults.map(({ id, result }) => {
              const badge = getResultBadge(result.result_type);
              const resultDescription = getResultDescription(result.result_type);
              const isExpanded = expandedRow === id;

              return (
                <Fragment key={id}>
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
                          onClick={() => setExpandedRow(isExpanded ? null : id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                          aria-expanded={isExpanded}
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
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 rounded-xl border border-gray-200/90 bg-white p-3 shadow-sm shadow-gray-200/70 dark:border-gray-600 dark:bg-gray-900/70 dark:shadow-none"
                            >
                              <div className="flex-1">
                                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {diff.column_a} <span className="text-gray-400 dark:text-gray-500">→</span> {diff.column_b}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md border border-rose-200/90 bg-rose-50/90 px-2 py-1 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/35 dark:text-rose-200">
                                    {diff.value_a}
                                  </span>
                                  <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/35 dark:text-emerald-200">
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
      )}

      {visibleResults.length > 50 && (
        <div className="border-t border-gray-200/90 bg-gray-50/90 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-950/45">
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing {visibleResults.length} results. Use filters, search, or sorting to narrow down.</p>
        </div>
      )}
    </div>
  );
}
