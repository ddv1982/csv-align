interface PairPreviewProps {
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
}

export function PairPreview({ comparisonColumnsA, comparisonColumnsB }: PairPreviewProps) {
  const pairs = comparisonColumnsA
    .slice(0, comparisonColumnsB.length)
    .map((columnA, index) => ({ columnA, columnB: comparisonColumnsB[index] }));

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm shadow-gray-950/5 dark:border-gray-700 dark:bg-gray-800/60 dark:shadow-none">
      <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Current pair order</h4>
      {pairs.length > 0 ? (
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {pairs.map((pair, index) => (
            <div key={`${pair.columnA}-${pair.columnB}-${index}`} className="flex items-center gap-2">
              <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">{index + 1}</span>
              <span className="truncate" title={pair.columnA}>{pair.columnA}</span>
              <span aria-hidden="true">→</span>
              <span className="truncate" title={pair.columnB}>{pair.columnB}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No pairs selected yet.</p>
      )}
      {comparisonColumnsA.length !== comparisonColumnsB.length && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Select the same number of comparison columns in both files to run comparison.
        </p>
      )}
    </div>
  );
}
