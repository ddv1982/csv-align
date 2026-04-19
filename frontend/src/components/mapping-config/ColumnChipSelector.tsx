interface ColumnChipSelectorProps {
  title: string;
  columns: string[];
  selectedColumns: string[];
  emptyHint?: string;
  onToggle: (column: string) => void;
}

export function ColumnChipSelector({ title, columns, selectedColumns, emptyHint, onToggle }: ColumnChipSelectorProps) {
  return (
    <div>
      <h4 className="hud-label mb-3">{title}</h4>
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
                  ? 'kinetic-filter-chip-active'
                  : 'kinetic-filter-chip'
                }`}
            >
              {column}
            </button>
          );
        })}
      </div>
      {emptyHint && selectedColumns.length === 0 && (
        <p className="mt-2 text-xs text-[color:var(--color-kinetic-muted)]">{emptyHint}</p>
      )}
    </div>
  );
}
