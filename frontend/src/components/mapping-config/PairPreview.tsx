interface PairPreviewProps {
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
}

function normalizeVisibleText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function PairPreview({ comparisonColumnsA, comparisonColumnsB }: PairPreviewProps) {
  const pairs = comparisonColumnsA
    .slice(0, comparisonColumnsB.length)
    .map((columnA, index) => {
      const normalizedColumnA = normalizeVisibleText(columnA);
      const normalizedColumnB = normalizeVisibleText(comparisonColumnsB[index]);

      return {
        columnA: normalizedColumnA,
        columnB: normalizedColumnB,
        displayText: `${index + 1} ${normalizedColumnA} → ${normalizedColumnB}`,
      };
    });
  const pairOrderText = pairs.length > 0
    ? pairs.map((pair) => pair.displayText).join('\n')
    : 'No pairs selected yet.';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pairOrderText);
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm shadow-gray-950/5 dark:border-gray-700 dark:bg-gray-800/60 dark:shadow-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Current pair order</h4>
        <button aria-label="Copy current pair order" className="btn btn-secondary px-3 py-1 text-xs" onClick={handleCopy} type="button">
          Copy
        </button>
      </div>
      {pairs.length > 0 ? (
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {pairs.map((pair, index) => (
            <div key={`${pair.columnA}-${pair.columnB}-${index}`} className="truncate" title={pair.displayText}>
              {pair.displayText}
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
