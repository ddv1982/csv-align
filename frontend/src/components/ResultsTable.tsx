import { Fragment, useMemo, useState, useTransition } from 'react';
import { ResultResponse } from '../types/api';
import { getResultBadge, getResultDescription } from '../features/results/presentation';
import { SectionCard } from './ui/SectionCard';
import {
  ArrowRightIcon,
  Bars3BottomLeftIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  NoSymbolSearchIcon,
  PlusIcon,
  XCircleIcon,
} from './icons';

interface ResultsTableProps {
  results: ResultResponse[];
}

type SortColumn = 'type' | 'key' | 'fileA' | 'fileB' | 'details';
type SortDirection = 'asc' | 'desc';

interface ResultRowEntry {
  id: string;
  result: ResultResponse;
}

interface DiffRowProps {
  columnA: string;
  columnB: string;
  valueA: string;
  valueB: string;
}

function DiffRow({ columnA, columnB, valueA, valueB }: DiffRowProps) {
  const sameColumn = columnA === columnB;

  return (
    <div className="rounded-xl border border-gray-200/90 bg-white/95 p-3.5 shadow-sm shadow-gray-200/60 transition-colors hover:border-gray-300/90 dark:border-gray-700/90 dark:bg-gray-900/70 dark:shadow-none dark:hover:border-gray-600/90">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        <span className="font-mono text-[11px] font-semibold tracking-tight text-gray-700 dark:text-gray-200">
          {columnA}
        </span>
        {!sameColumn && (
          <>
            <ArrowRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <span className="font-mono text-[11px] font-semibold tracking-tight text-gray-700 dark:text-gray-200">
              {columnB}
            </span>
          </>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600/90 dark:text-rose-300/90">File A</p>
          <span className="block truncate rounded-md border border-rose-200/80 bg-rose-50/70 px-2.5 py-1.5 font-mono text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100" title={valueA}>
            {valueA}
          </span>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200/90 bg-gray-50 text-gray-500 dark:border-gray-700/80 dark:bg-gray-800/60 dark:text-gray-400">
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600/90 dark:text-emerald-300/90">File B</p>
          <span className="block truncate rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1.5 font-mono text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100" title={valueB}>
            {valueB}
          </span>
        </div>
      </div>
    </div>
  );
}

function SortGlyph({ state }: { state: 'asc' | 'desc' | 'inactive' }) {
  const baseClass = 'block leading-none text-[8px]';
  const upClass = state === 'asc' ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500';
  const downClass = state === 'desc' ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500';

  return (
    <span className="ml-1 flex flex-col items-center" aria-hidden="true">
      <span className={`${baseClass} ${upClass}`}>▲</span>
      <span className={`${baseClass} ${downClass}`}>▼</span>
    </span>
  );
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isPending, startTransition] = useTransition();

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
    startTransition(() => {
      if (sortColumn === column) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        return;
      }

      setSortColumn(column);
      setSortDirection('asc');
    });
  };

  const renderSortHeader = (label: string, column: SortColumn, className: string) => {
    const isActive = sortColumn === column;
    const glyphState: 'asc' | 'desc' | 'inactive' = isActive ? sortDirection : 'inactive';

    return (
      <th
        scope="col"
        className={className}
        aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => handleSort(column)}
          className={`group inline-flex items-center rounded-md text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-950 ${
            isActive
              ? 'text-gray-900 dark:text-gray-50'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
          }`}
        >
          {label}
          <SortGlyph state={glyphState} />
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
          <div
            key={rowIndex}
            className="rounded-md border border-gray-200/80 bg-gray-50/80 px-2.5 py-1.5 font-mono text-[13px] leading-5 dark:border-gray-700/80 dark:bg-gray-900/60"
          >
            {row.length > 0 ? row.join(', ') : '—'}
          </div>
        ))}
      </div>
    );
  };

  if (results.length === 0) {
    return (
      <div className="card border-gray-200/90 bg-white p-12 text-center shadow-lg shadow-gray-200/60 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/25">
        <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <SectionCard
      eyebrow="Detailed results"
      title="Comparison results"
      description={`${visibleResults.length} of ${results.length} rows shown`}
      className="card overflow-hidden border-gray-200/90 bg-white shadow-xl shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/30"
      icon={
        <Bars3BottomLeftIcon className="h-5 w-5" />
      }
      action={
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search result values</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => {
                setSearchQuery(nextValue);
              });
            }}
            placeholder="Search keys or values"
            className="input pl-9 pr-3 text-sm"
          />
        </label>
      }
    >
      <div>

      {visibleResults.length === 0 ? (
        <div className="p-12 text-center">
          <NoSymbolSearchIcon className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No results match the current filter and search.</p>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200/90 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-950/45">
            <tr>
              {renderSortHeader('Type', 'type', 'w-40 min-w-[11rem] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('Key', 'key', 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('File A Values', 'fileA', 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('File B Values', 'fileB', 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
              {renderSortHeader('Details', 'details', 'w-32 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/80 dark:divide-gray-700/80">
            {visibleResults.map(({ id, result }) => {
              const badge = getResultBadge(result.result_type);
              const resultDescription = getResultDescription(result.result_type);
              const isExpanded = expandedRow === id;

              return (
                <Fragment key={id}>
                  <tr className={`transition-colors ${isExpanded ? 'bg-gray-50/80 dark:bg-gray-950/35' : 'bg-white hover:bg-gray-50/70 dark:bg-gray-900/70 dark:hover:bg-gray-800/60'}`}>
                    <td className="px-4 py-3.5 align-top">
                      <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="inline-block max-w-full truncate rounded-md bg-gray-100/80 px-2.5 py-1 font-mono text-sm font-semibold text-gray-900 dark:bg-gray-800/80 dark:text-gray-100" title={result.key.join(', ')}>
                        {result.key.join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">{renderValueRows(result.duplicate_values_a, result.values_a)}</td>
                    <td className="px-4 py-3.5 align-top">{renderValueRows(result.duplicate_values_b, result.values_b)}</td>
                    <td className="px-4 py-3.5 align-top">
                      {result.differences.length > 0 ? (
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
                            isExpanded
                              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/15 dark:text-primary-200'
                              : 'border-gray-200 bg-gray-50/70 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                          }`}
                          aria-expanded={isExpanded}
                        >
                          {result.differences.length} diff{result.differences.length > 1 ? 's' : ''}
                          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <span className={`text-sm ${resultDescription ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          {resultDescription ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>

                  {isExpanded && result.differences.length > 0 && (
                    <tr className="bg-gray-50/60 dark:bg-gray-950/35">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm shadow-gray-200/50 dark:border-gray-700/80 dark:bg-gray-900/60 dark:shadow-none">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
                              <PlusIcon className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Value Differences:</p>
                            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                              {result.differences.length} field{result.differences.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                            {result.differences.map((diff, diffIdx) => (
                              <DiffRow
                                key={diffIdx}
                                columnA={diff.column_a}
                                columnB={diff.column_b}
                                valueA={diff.value_a}
                                valueB={diff.value_b}
                              />
                            ))}
                          </div>
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
      {isPending && (
        <div className="border-t border-gray-200/90 bg-gray-50/90 px-4 py-2 text-right text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-950/45 dark:text-gray-400">
          Updating results…
        </div>
      )}


      {visibleResults.length > 50 && (
        <div className="border-t border-gray-200/90 bg-gray-50/90 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-950/45">
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing {visibleResults.length} results. Use filters, search, or sorting to narrow down.</p>
        </div>
      )}
      </div>
    </SectionCard>
  );
}
