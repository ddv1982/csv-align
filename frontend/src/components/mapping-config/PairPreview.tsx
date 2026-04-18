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
  const hasMismatchedCounts = comparisonColumnsA.length !== comparisonColumnsB.length;

  return (
    <div className="kinetic-panel mt-6 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="hud-label">Preview</p>
          <h4 className="mt-0.5 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">Current pair order</h4>
        </div>
        <button
          aria-label={buttonLabel}
          className={`btn btn-ghost px-2 py-1 text-xs ${copySucceeded ? 'text-[color:var(--color-kinetic-success)]' : ''}`}
          onClick={handleCopy}
          title={buttonLabel}
          type="button"
        >
          <span className="sr-only">{buttonLabel}</span>
          <span aria-hidden="true">{copySucceeded ? 'OK' : 'CP'}</span>
        </button>
      </div>
      {pairs.length > 0 ? (
        <div className="space-y-1 font-mono text-sm text-[color:var(--color-kinetic-copy)]">
          {pairs.map((pair, index) => (
            <div key={`${pair.columnA}-${pair.columnB}-${index}`} className="truncate" title={pair.displayText}>
              {pair.displayText}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--color-kinetic-muted)]">No pairs selected yet.</p>
      )}
      {hasMismatchedCounts && (
        <p className="mt-3 text-sm text-[color:var(--color-kinetic-warning)]">
          Select the same number of comparison columns in both files to run comparison.
        </p>
      )}
    </div>
  );
}
