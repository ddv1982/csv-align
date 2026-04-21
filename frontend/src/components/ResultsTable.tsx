import { Fragment, useDeferredValue, useMemo, useState, useTransition } from 'react';
import { ResultResponse } from '../types/api';
import {
  buildResultRows,
  filterAndSortResultRows,
  type ResultDetailField,
  type ResultDetailPanel,
  type ResultRowViewModel,
  type ResultSortColumn,
  type ResultSortDirection,
  type ResultValueCell,
} from '../features/results/presentation';
import { ChevronRightIcon, MagnifyingGlassIcon, RectangleStackIcon } from './icons';
import { SectionCard } from './ui/SectionCard';

interface ResultsTableProps {
  results: ResultResponse[];
  totalResultsCount?: number;
  comparisonColumnsA?: string[];
  comparisonColumnsB?: string[];
}

interface DetailFieldRowProps {
  field: ResultDetailField;
}

function DetailFieldRow({ field }: DetailFieldRowProps) {
  const { columnA, columnB, valueA, valueB } = field;
  const sameColumn = columnA === columnB;
  const headerChipClass = 'table-chip kinetic-copy max-w-full break-all';
  const hasColumnA = Boolean(columnA);
  const hasColumnB = Boolean(columnB);

  return (
    <div>
      {(hasColumnA || hasColumnB) && (
        <div className="kinetic-muted mb-2.5 flex flex-wrap items-start gap-2 text-xs font-medium">
          {hasColumnA && <span className={headerChipClass}>{columnA}</span>}
          {!sameColumn && hasColumnA && hasColumnB && (
            <span className="kinetic-glyph-box kinetic-muted h-8 w-8 shrink-0 text-[11px]">
              {'->'}
            </span>
          )}
          {!sameColumn && hasColumnB && <span className={headerChipClass}>{columnB}</span>}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
        <p className="kinetic-mono-label text-[10px] text-[color:var(--color-kinetic-danger)]">File A</p>
        <div className="min-w-0 row-start-2">
          <span className="kinetic-copy kinetic-surface-danger block truncate border px-2.5 py-1.5 font-mono text-sm" title={valueA}>
            {valueA || '—'}
          </span>
        </div>
        <p className="kinetic-mono-label col-start-3 text-[10px] text-[color:var(--color-kinetic-success)]">File B</p>
        <div className="kinetic-glyph-box kinetic-muted row-start-2 self-center h-7 w-7 shrink-0 text-[11px]">
          {'->'}
        </div>
        <div className="min-w-0 col-start-3 row-start-2">
          <span className="kinetic-copy kinetic-surface-success-muted block truncate border px-2.5 py-1.5 font-mono text-sm" title={valueB}>
            {valueB || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ panel }: { panel: ResultDetailPanel }) {
  return (
    <article className="kinetic-panel p-3.5">
      {panel.label && <p className="kinetic-mono-label kinetic-copy mb-3 text-xs font-semibold">{panel.label}</p>}
      <div className="grid gap-3">
        {panel.fields.map((field, fieldIndex) => (
          <DetailFieldRow key={fieldIndex} field={field} />
        ))}
      </div>
    </article>
  );
}

function DetailCell({ row, isExpanded, onToggle }: { row: ResultRowViewModel; isExpanded: boolean; onToggle: () => void }) {
  if (!row.expandableDetail) {
    return <span className={`text-sm ${row.description ? 'kinetic-copy' : 'kinetic-muted'}`}>{row.description ?? '—'}</span>;
  }

  return (
    <div className="grid gap-2">
      <button
        onClick={onToggle}
        className={`inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
          isExpanded
            ? 'border-[color:var(--color-kinetic-accent)] kinetic-surface-accent-strong text-[color:var(--color-kinetic-copy)]'
            : 'kinetic-surface-subtle border-[color:var(--color-kinetic-line)] text-[color:var(--color-kinetic-muted)] hover:border-[color:var(--color-kinetic-line-strong)] hover:text-[color:var(--color-kinetic-copy)]'
          }`}
        aria-expanded={isExpanded}
      >
        {row.expandableDetail.toggleLabel}
        <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>
      {row.description && <span className="kinetic-copy text-sm">{row.description}</span>}
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

export function ResultsTable({
  results,
  totalResultsCount = results.length,
  comparisonColumnsA = [],
  comparisonColumnsB = [],
}: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<ResultSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<ResultSortDirection>('asc');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const resultRows = useMemo(
    () => buildResultRows(results, { fileA: comparisonColumnsA, fileB: comparisonColumnsB }),
    [comparisonColumnsA, comparisonColumnsB, results],
  );

  const visibleResults = useMemo(
    () => filterAndSortResultRows(resultRows, {
      filter: 'all',
      query: deferredQuery,
      sortColumn,
      sortDirection,
    }),
    [deferredQuery, resultRows, sortColumn, sortDirection],
  );

  const handleSort = (column: ResultSortColumn) => {
    startTransition(() => {
      if (sortColumn === column) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        return;
      }

      setSortColumn(column);
      setSortDirection('asc');
    });
  };

  const renderSortHeader = (label: string, column: ResultSortColumn, className: string) => {
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

  const renderValueRows = (rows: ResultValueCell[][]) => {
    if (rows.length === 0) {
      return <span className="kinetic-muted italic">—</span>;
    }

    return (
      <div className="kinetic-value-stack kinetic-copy">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="kinetic-value-row text-[13px]"
          >
            {row.length > 0 ? (
              <div className="grid gap-2">
                {row.map((cell, cellIndex) => (
                  <div key={cellIndex} className="grid gap-1">
                    {cell.column && (
                      <span className="table-chip kinetic-copy max-w-full break-all">{cell.column}</span>
                    )}
                    <span className="block truncate" title={cell.value}>
                      {cell.value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : '—'}
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
      icon={<RectangleStackIcon className="h-5 w-5" />}
      action={
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search result values</span>
          <MagnifyingGlassIcon className="kinetic-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
              <thead className="kinetic-surface-subtle border-b border-[color:var(--color-kinetic-line)]">
                <tr>
                  {renderSortHeader('Type', 'type', 'kinetic-table-head w-40 min-w-[11rem] px-4 py-3 text-left')}
                  {renderSortHeader('Key', 'key', 'kinetic-table-head px-4 py-3 text-left')}
                  {renderSortHeader('File A Values', 'fileA', 'kinetic-table-head px-4 py-3 text-left')}
                  {renderSortHeader('File B Values', 'fileB', 'kinetic-table-head px-4 py-3 text-left')}
                  {renderSortHeader('Details', 'details', 'kinetic-table-head w-32 px-4 py-3 text-left')}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-kinetic-line)]">
                {visibleResults.map((row: ResultRowViewModel) => {
                  const isExpanded = expandedRow === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr className={`transition-colors ${isExpanded ? 'kinetic-surface-accent-strong' : 'bg-transparent kinetic-surface-hover'}`}>
                        <td className="px-4 py-3.5 align-top">
                          <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] ${row.badge.bg} ${row.badge.text}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 ${row.badge.dot}`} aria-hidden="true" />
                            {row.badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span className="kinetic-copy kinetic-surface-subtle inline-block max-w-full truncate border border-[color:var(--color-kinetic-line)] px-2.5 py-1 font-mono text-sm font-semibold" title={row.keyText}>
                            {row.keyText}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">{renderValueRows(row.fileAValues)}</td>
                        <td className="px-4 py-3.5 align-top">{renderValueRows(row.fileBValues)}</td>
                        <td className="px-4 py-3.5 align-top">
                          <DetailCell row={row} isExpanded={isExpanded} onToggle={() => setExpandedRow(isExpanded ? null : row.id)} />
                        </td>
                      </tr>

                      {isExpanded && row.expandableDetail && (
                        <tr className="kinetic-surface-subtle">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="kinetic-panel p-4">
                              <div className="mb-3 flex items-center gap-2">
                                <span className="kinetic-surface-accent flex h-6 w-6 items-center justify-center border font-mono text-[11px] uppercase">
                                  +
                                </span>
                                <p className="kinetic-mono-label kinetic-copy text-xs font-semibold">{row.expandableDetail.title}</p>
                                <span className="kinetic-muted ml-auto text-xs">{row.expandableDetail.summary}</span>
                              </div>
                              <div className={`grid gap-3 sm:grid-cols-1 ${row.expandableDetail.variant === 'differences' ? 'lg:grid-cols-2' : ''}`}>
                                {row.expandableDetail.panels.map((panel, panelIdx) => (
                                  <DetailPanel key={panel.label ?? panelIdx} panel={panel} />
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
          <div className="kinetic-muted kinetic-surface-subtle border-t border-[color:var(--color-kinetic-line)] px-4 py-2 text-right text-xs">
            Updating results…
          </div>
        )}

        {visibleResults.length > 50 && (
          <div className="kinetic-surface-subtle border-t border-[color:var(--color-kinetic-line)] px-4 py-3 text-center">
            <p className="kinetic-muted text-sm">Showing {visibleResults.length} results. Use filters, search, or sorting to narrow down.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
