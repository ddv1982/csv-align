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
      {label && <p className="text-xs font-medium text-app-muted">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => {
          const isSelected = selectedColumns.includes(column);
          const selectedIndex = selectedColumns.indexOf(column);
          const selectedPosition = selectedIndex + 1;
          return (
            <button
              key={column}
              type="button"
              aria-pressed={isSelected}
              aria-label={isSelected ? `${column}, selected ${selectedPosition} of ${selectedColumns.length}` : column}
              onClick={() => onToggle(column)}
              className={`inline-flex min-h-9 min-w-0 max-w-full items-center gap-2 whitespace-normal border px-3 py-1.5 text-left text-sm font-medium transition-colors ${
                 isSelected
                   ? 'filter-chip-active'
                   : 'filter-chip'
                }`}
            >
              {isSelected && (
                <span aria-hidden="true" className="selected-order-badge shrink-0">
                  {selectedPosition}
                </span>
              )}
              <span className="min-w-0 break-words">{column}</span>
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
    <div className="min-w-0">
      <h4 className="mb-1 text-sm font-semibold text-app-text">{title}</h4>
      <p className="mb-3 text-xs font-semibold text-app-muted">{selectedColumns.length} selected</p>
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
