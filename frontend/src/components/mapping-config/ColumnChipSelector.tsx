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
      <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => (
          <button
            key={column}
            onClick={() => onToggle(column)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${selectedColumns.includes(column)
              ? 'border-primary-600 bg-primary-600 text-white shadow-sm shadow-primary-600/20'
              : 'border-gray-200 bg-white text-gray-700 shadow-sm shadow-gray-950/5 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:shadow-none dark:hover:bg-gray-600'}`}
          >
            {column}
          </button>
        ))}
      </div>
      {emptyHint && selectedColumns.length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>
      )}
    </div>
  );
}
