import { Fragment, useDeferredValue, useMemo, useState, useTransition } from 'react';
import type { MappingDto, ResultResponse } from '../types/api';
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
  mappings?: MappingDto[];
}

interface DetailFieldRowProps {
  field: ResultDetailField;
  isMatch: boolean;
}

function formatCollapsedValueRow(row: ResultValueCell[]): string {
  if (row.length === 0) {
    return '—';
  }

  return row.map((cell) => cell.value || '—').join(', ');
}

function DetailFieldRow({ field, isMatch }: DetailFieldRowProps) {
  const { columnA, columnB, valueA, valueB } = field;
  const sameColumn = columnA === columnB;
  const headerChipClass = 'table-chip app-text max-w-full break-all';
  const hasColumnA = Boolean(columnA);
  const hasColumnB = Boolean(columnB);
  const fileALabelClass = isMatch
    ? 'text-app-success'
    : 'text-app-danger';
  const fileAValueClass = isMatch ? 'app-surface-success-muted' : 'app-surface-danger';

  return (
    <div className="detail-field">
      {(hasColumnA || hasColumnB) && (
        <div className="diff-card-header app-muted mb-2.5 flex flex-wrap items-start gap-2 text-xs font-medium">
          {hasColumnA && <span className={headerChipClass}>{columnA}</span>}
          {!sameColumn && hasColumnA && hasColumnB && (
            <span className="icon-frame diff-arrow-box detail-header-arrow app-muted h-8 w-8 shrink-0 text-[11px]">
              {'->'}
            </span>
          )}
          {!sameColumn && hasColumnB && <span className={headerChipClass}>{columnB}</span>}
        </div>
      )}
      <div className="diff-values grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
        <p className={`diff-value-label file-a meta-label text-[10px] ${fileALabelClass}`}>File A</p>
        <div className="diff-value-column min-w-0 row-start-2">
          <span className={`diff-value-box app-text ${fileAValueClass} block truncate border px-2.5 py-1.5 font-mono text-sm`} title={valueA}>
            {valueA || '—'}
          </span>
        </div>
        <p className="diff-value-label file-b meta-label col-start-3 text-[10px] text-app-success">File B</p>
        <div className="icon-frame diff-arrow-box detail-value-arrow app-muted row-start-2 self-center h-7 w-7 shrink-0 text-[11px]">
          {'->'}
        </div>
        <div className="diff-value-column min-w-0 col-start-3 row-start-2">
          <span className="diff-value-box app-text app-surface-success-muted block truncate border px-2.5 py-1.5 font-mono text-sm" title={valueB}>
            {valueB || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ panel, isMatch }: { panel: ResultDetailPanel; isMatch: boolean }) {
  return (
    <article className="surface-panel diff-card p-3.5">
      {panel.label && <p className="detail-panel-label meta-label app-text mb-3 text-xs font-semibold">{panel.label}</p>}
      <div className="detail-card-fields grid gap-3">
        {panel.fields.map((field, fieldIndex) => (
          <DetailFieldRow key={fieldIndex} field={field} isMatch={isMatch} />
        ))}
      </div>
    </article>
  );
}

function KeyChip({ row }: { row: ResultRowViewModel }) {
  const keyParts = row.keyParts.length > 0 ? row.keyParts : ['—'];

  return (
    <span className="key-chip chip app-text app-surface-subtle max-w-full border border-app-border px-2.5 py-1 font-mono text-sm font-semibold" title={row.keyText || '—'}>
      {keyParts.map((part, index) => (
        <span key={`${index}-${part}`} className="key-chip-part">
          {part || '—'}
        </span>
      ))}
    </span>
  );
}

function DetailCell({ row, isExpanded, onToggle }: { row: ResultRowViewModel; isExpanded: boolean; onToggle: () => void }) {
  if (!row.expandableDetail) {
    return <span className={`detail-description text-sm ${row.description ? 'app-text' : 'app-muted'}`}>{row.description ?? '—'}</span>;
  }

  return (
    <div className="detail-cell-stack grid gap-2">
      <button
        onClick={onToggle}
        className={`diff-toggle inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
          isExpanded
            ? 'border-app-accent app-surface-accent-strong text-app-text'
            : 'app-surface-subtle border-app-border text-app-muted hover:border-app-border-strong hover:text-app-text'
        }`}
        aria-expanded={isExpanded}
      >
        {row.expandableDetail.toggleLabel}
        <ChevronRightIcon className={`diff-toggle-glyph h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>
      {row.description && <span className="detail-description app-text text-sm">{row.description}</span>}
    </div>
  );
}

function SortGlyph({ state }: { state: 'asc' | 'desc' | 'inactive' }) {
  const baseClass = 'block leading-none text-[8px]';
  const upClass = state === 'asc' ? 'text-app-accent' : 'text-app-muted';
  const downClass = state === 'desc' ? 'text-app-accent' : 'text-app-muted';

  return (
    <span className="sort-glyph ml-1 flex flex-col items-center" aria-hidden="true">
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
  mappings = [],
}: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<ResultSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<ResultSortDirection>('asc');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const resultRows = useMemo(
    () => buildResultRows(results, { fileA: comparisonColumnsA, fileB: comparisonColumnsB, mappings }),
    [comparisonColumnsA, comparisonColumnsB, mappings, results],
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
          className={`sort-button group inline-flex items-center text-left transition-colors ${
            isActive
              ? 'active app-text'
              : 'app-muted hover:text-app-text'
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
      return <span className="app-muted italic">—</span>;
    }

    return (
      <div className="result-value-stack value-stack app-text">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="result-value-row value-row text-[13px]"
          >
            <span className="result-value-text" title={formatCollapsedValueRow(row)}>
              {formatCollapsedValueRow(row)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (totalResultsCount === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="empty-state-icon app-muted">0X</div>
        <p className="app-muted">No results match the selected filter</p>
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
          <MagnifyingGlassIcon className="app-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
            <div className="empty-state-icon app-muted">NS</div>
            <p className="app-muted">No results match the current filter and search.</p>
          </div>
        ) : (
          <div className="table-wrap overflow-x-auto">
            <table className="results-table w-full">
              <thead className="app-surface-subtle border-b border-app-border">
                <tr>
                  {renderSortHeader('Type', 'type', 'table-head w-40 min-w-[11rem] px-4 py-3 text-left')}
                  {renderSortHeader('Key', 'key', 'table-head results-key-column px-4 py-3 text-left')}
                  {renderSortHeader('File A Values', 'fileA', 'table-head px-4 py-3 text-left')}
                  {renderSortHeader('File B Values', 'fileB', 'table-head px-4 py-3 text-left')}
                  {renderSortHeader('Details', 'details', 'table-head w-32 px-4 py-3 text-left')}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {visibleResults.map((row: ResultRowViewModel) => {
                  const isExpanded = expandedRow === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr className={`transition-colors ${isExpanded ? 'app-surface-accent-strong' : 'bg-transparent app-surface-hover'}`} data-result-tone={row.badgeTone}>
                        <td className="px-4 py-3.5 align-top">
                          <span className={`badge tone-${row.badgeTone} inline-flex w-fit items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] ${row.badge.bg} ${row.badge.text}`}>
                            <span className={`badge-dot h-1.5 w-1.5 shrink-0 ${row.badge.dot}`} aria-hidden="true" />
                            {row.badge.label}
                          </span>
                        </td>
                        <td className="results-key-cell px-4 py-3.5 align-top">
                          <KeyChip row={row} />
                        </td>
                        <td className="px-4 py-3.5 align-top">{renderValueRows(row.fileAValues)}</td>
                        <td className="px-4 py-3.5 align-top">{renderValueRows(row.fileBValues)}</td>
                        <td className="px-4 py-3.5 align-top">
                          <DetailCell row={row} isExpanded={isExpanded} onToggle={() => setExpandedRow(isExpanded ? null : row.id)} />
                        </td>
                      </tr>

                      {isExpanded && row.expandableDetail && (
                        <tr className="details-row app-surface-subtle">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="surface-panel diff-panel p-4">
                              <div className="diff-panel-header mb-3 flex items-center gap-2">
                                <span className="diff-panel-icon app-surface-accent flex h-6 w-6 items-center justify-center border font-mono text-[11px] uppercase">
                                  +
                                </span>
                                <p className="diff-panel-title meta-label app-text text-xs font-semibold">{row.expandableDetail.title}</p>
                                <span className="diff-panel-count app-muted ml-auto text-xs">{row.expandableDetail.summary}</span>
                              </div>
                              <div className={`grid gap-3 sm:grid-cols-1 ${row.expandableDetail.variant === 'differences' ? 'diff-grid lg:grid-cols-2' : 'detail-stack'}`}>
                                {row.expandableDetail.panels.map((panel, panelIdx) => (
                                  <DetailPanel key={panel.label ?? panelIdx} panel={panel} isMatch={row.resultType === 'match'} />
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
          <div className="app-muted app-surface-subtle border-t border-app-border px-4 py-2 text-right text-xs">
            Updating results…
          </div>
        )}

        {visibleResults.length > 50 && (
          <div className="app-surface-subtle border-t border-app-border px-4 py-3 text-center">
            <p className="app-muted text-sm">Showing {visibleResults.length} results. Use filters, search, or sorting to narrow down.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
