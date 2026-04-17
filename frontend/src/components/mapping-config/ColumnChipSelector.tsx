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
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => {
          const isSelected = selectedColumns.includes(column);
          return (
            <button
              key={column}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(column)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 ${
                isSelected
                  ? 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700 dark:border-primary-500 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800'
              }`}
            >
              {column}
            </button>
          );
        })}
      </div>
      {emptyHint && selectedColumns.length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>
      )}
    </div>
  );
}
