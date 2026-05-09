interface ColumnChipSelectorProps {
  title: string;
  columns: string[];
  virtualColumns?: string[];
  selectedColumns: string[];
  emptyHint?: string;
  onToggle: (column: string) => void;
}

function ColumnChipGroup({ label, columns, selectedColumns, onToggle }: {
  label?: string;
  columns: string[];
  selectedColumns: string[];
  onToggle: (column: string) => void;
}) {
  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-muted">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => {
          const isSelected = selectedColumns.includes(column);
          return (
            <button
              key={column}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(column)}
              className={`border px-3 py-1.5 text-sm font-medium transition-colors ${
                 isSelected
                  ? 'filter-chip-active'
                  : 'filter-chip'
                }`}
            >
              {column}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ColumnChipSelector({ title, columns, virtualColumns = [], selectedColumns, emptyHint, onToggle }: ColumnChipSelectorProps) {
  const visibleVirtualColumns = virtualColumns.filter((column) => !columns.includes(column));
  const hasVirtualColumns = visibleVirtualColumns.length > 0;

  return (
    <div>
      <h4 className="hud-label mb-3">{title}</h4>
      <div className="space-y-3">
        <ColumnChipGroup
          label={hasVirtualColumns ? 'Physical columns' : undefined}
          columns={columns}
          selectedColumns={selectedColumns}
          onToggle={onToggle}
        />
        {hasVirtualColumns && (
          <ColumnChipGroup
            label="Virtual JSON fields"
            columns={visibleVirtualColumns}
            selectedColumns={selectedColumns}
            onToggle={onToggle}
          />
        )}
      </div>
      {emptyHint && selectedColumns.length === 0 && (
        <p className="mt-2 text-xs text-app-muted">{emptyHint}</p>
      )}
    </div>
  );
}
