import { Fragment, useDeferredValue, useMemo, useState, useTransition } from 'react';
import { ResultResponse } from '../types/api';
import { getResultBadge, getResultDescription } from '../features/results/presentation';
import { SectionCard } from './ui/SectionCard';

interface ResultsTableProps {
  results: ResultResponse[];
  totalResultsCount?: number;
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
  const headerChipClass = 'table-chip kinetic-copy max-w-full break-all';

  return (
    <div className="kinetic-panel p-3.5">
      <div className="kinetic-muted mb-2.5 flex flex-wrap items-start gap-2 text-xs font-medium">
        <span className={headerChipClass}>
          {columnA}
        </span>
        {!sameColumn && (
          <>
            <span className="kinetic-glyph-box kinetic-muted h-8 w-8 shrink-0 text-[11px]">
              {'->'}
            </span>
            <span className={headerChipClass}>
              {columnB}
            </span>
          </>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="kinetic-mono-label mb-1 text-[10px] text-[color:var(--color-kinetic-danger)]">File A</p>
          <span className="kinetic-copy block truncate border border-[rgba(255,122,122,0.35)] bg-[rgba(255,122,122,0.06)] px-2.5 py-1.5 font-mono text-sm" title={valueA}>
            {valueA}
          </span>
        </div>
        <div className="kinetic-glyph-box kinetic-muted h-7 w-7 shrink-0 text-[11px]">
          {'->'}
        </div>
        <div className="min-w-0">
          <p className="kinetic-mono-label mb-1 text-[10px] text-[color:var(--color-kinetic-success)]">File B</p>
          <span className="kinetic-copy block truncate border border-[rgba(108,255,190,0.35)] bg-[rgba(108,255,190,0.06)] px-2.5 py-1.5 font-mono text-sm" title={valueB}>
            {valueB}
          </span>
        </div>
      </div>
    </div>
  );
}

function SortGlyph({ state }: { state: 'asc' | 'desc' | 'inactive' }) {
  const baseClass = 'block leading-none text-[8px]';
  const upClass = state === 'asc' ? 'text-[color:var(--color-kinetic-accent)]' : 'text-[color:var(--color-kinetic-muted)]';
  const downClass = state === 'desc' ? 'text-[color:var(--color-kinetic-accent)]' : 'text-[color:var(--color-kinetic-muted)]';

  return (
    <span className="ml-1 flex flex-col items-center" aria-hidden="true">
      <span className={`${baseClass} ${upClass}`}>▲</span>
      <span className={`${baseClass} ${downClass}`}>▼</span>
    </span>
  );
}

export function ResultsTable({ results, totalResultsCount = results.length }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const resultEntries = useMemo<ResultRowEntry[]>(() => {
    return results.map((result, index) => ({
      id: `${index}-${result.result_type}-${result.key.join('|')}`,
      result,
    }));
  }, [results]);

  const normalizedSearch = deferredQuery.trim().toLowerCase();

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
          className={`group inline-flex items-center text-left transition-colors ${
            isActive
              ? 'kinetic-copy'
              : 'kinetic-muted hover:text-[color:var(--color-kinetic-copy)]'
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
      return <span className="kinetic-muted italic">—</span>;
    }

    return (
      <div className="kinetic-value-stack kinetic-copy">
        {displayRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="kinetic-value-row text-[13px]"
          >
            {row.length > 0 ? row.join(', ') : '—'}
          </div>
        ))}
      </div>
    );
  };

  if (totalResultsCount === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="kinetic-empty-glyph kinetic-muted">0X</div>
        <p className="kinetic-muted">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <SectionCard
      eyebrow="Detailed results"
      title="Comparison results"
      description={`${visibleResults.length} of ${results.length} rows shown`}
      className="overflow-hidden"
      icon={<span aria-hidden="true">TB</span>}
      action={
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search result values</span>
          <span className="kinetic-mono-label kinetic-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px]">SR</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys or values"
            className="input pl-9 pr-3 text-sm"
          />
        </label>
      }
    >
      <div>

      {visibleResults.length === 0 ? (
        <div className="p-12 text-center">
          <div className="kinetic-empty-glyph kinetic-muted">NS</div>
          <p className="kinetic-muted">No results match the current filter and search.</p>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.03)]">
            <tr>
              {renderSortHeader('Type', 'type', 'kinetic-table-head w-40 min-w-[11rem] px-4 py-3 text-left')}
              {renderSortHeader('Key', 'key', 'kinetic-table-head px-4 py-3 text-left')}
              {renderSortHeader('File A Values', 'fileA', 'kinetic-table-head px-4 py-3 text-left')}
              {renderSortHeader('File B Values', 'fileB', 'kinetic-table-head px-4 py-3 text-left')}
              {renderSortHeader('Details', 'details', 'kinetic-table-head w-32 px-4 py-3 text-left')}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-kinetic-line)]">
            {visibleResults.map(({ id, result }) => {
              const badge = getResultBadge(result.result_type);
              const resultDescription = getResultDescription(result.result_type);
              const isExpanded = expandedRow === id;

              return (
                <Fragment key={id}>
                  <tr className={`transition-colors ${isExpanded ? 'bg-[rgba(110,231,255,0.05)]' : 'bg-transparent hover:bg-[rgba(255,255,255,0.03)]'}`}>
                    <td className="px-4 py-3.5 align-top">
                      <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] ${badge.bg} ${badge.text}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 ${badge.dot}`} aria-hidden="true" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="kinetic-copy inline-block max-w-full truncate border border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 font-mono text-sm font-semibold" title={result.key.join(', ')}>
                        {result.key.join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">{renderValueRows(result.duplicate_values_a, result.values_a)}</td>
                    <td className="px-4 py-3.5 align-top">{renderValueRows(result.duplicate_values_b, result.values_b)}</td>
                    <td className="px-4 py-3.5 align-top">
                      {result.differences.length > 0 ? (
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : id)}
                          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                            isExpanded
                              ? 'border-[color:var(--color-kinetic-accent)] bg-[rgba(110,231,255,0.1)] text-[color:var(--color-kinetic-copy)]'
                              : 'border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.03)] text-[color:var(--color-kinetic-muted)] hover:border-[color:var(--color-kinetic-line-strong)] hover:text-[color:var(--color-kinetic-copy)]'
                           }`}
                          aria-expanded={isExpanded}
                        >
                          {result.differences.length} diff{result.differences.length > 1 ? 's' : ''}
                          <span aria-hidden="true" className={`font-mono text-[11px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>v</span>
                        </button>
                      ) : (
                        <span className={`text-sm ${resultDescription ? 'kinetic-copy' : 'kinetic-muted'}`}>
                          {resultDescription ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>

                  {isExpanded && result.differences.length > 0 && (
                    <tr className="bg-[rgba(255,255,255,0.02)]">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="kinetic-panel p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center border border-[rgba(110,231,255,0.38)] bg-[rgba(110,231,255,0.08)] font-mono text-[11px] uppercase text-[color:var(--color-kinetic-accent)]">
                              +
                            </span>
                            <p className="kinetic-mono-label kinetic-copy text-xs font-semibold">Value Differences</p>
                            <span className="kinetic-muted ml-auto text-xs">
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
        <div className="kinetic-muted border-t border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-right text-xs">
          Updating results…
        </div>
      )}


      {visibleResults.length > 50 && (
        <div className="border-t border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-center">
          <p className="kinetic-muted text-sm">Showing {visibleResults.length} results. Use filters, search, or sorting to narrow down.</p>
        </div>
      )}
      </div>
    </SectionCard>
  );
}
