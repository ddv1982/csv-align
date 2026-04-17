import { useEffect, useState } from 'react';

interface PairPreviewProps {
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
}

function normalizeVisibleText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function PairPreview({ comparisonColumnsA, comparisonColumnsB }: PairPreviewProps) {
  const [copySucceeded, setCopySucceeded] = useState(false);
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

  useEffect(() => {
    if (!copySucceeded) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopySucceeded(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copySucceeded]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pairOrderText);
    setCopySucceeded(true);
  };

  const buttonLabel = copySucceeded ? 'Copied current pair order' : 'Copy current pair order';

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm shadow-gray-950/5 dark:border-gray-700 dark:bg-gray-800/60 dark:shadow-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Current pair order</h4>
        <button
          aria-label={buttonLabel}
          className={`btn btn-secondary px-2 py-1 text-xs ${copySucceeded ? 'text-green-600 dark:text-green-400' : ''}`}
          onClick={handleCopy}
          title={buttonLabel}
          type="button"
        >
          <span className="sr-only">{buttonLabel}</span>
          {copySucceeded ? (
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5.25" y="3.25" width="7.5" height="9.5" rx="1.25" />
              <path d="M3.25 10.75V4.5C3.25 3.81 3.81 3.25 4.5 3.25H9.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
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
