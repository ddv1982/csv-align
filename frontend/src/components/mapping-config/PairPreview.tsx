import { useEffect, useState } from 'react';
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon } from '../icons';

interface PairPreviewProps {
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  autoPairMessage: string;
  autoPairEnabled: boolean;
  onAutoPairFromFileA: () => void;
  onAutoPairFromFileB: () => void;
  onSavePairOrder: () => void;
  onLoadPairOrder: () => void;
}

function normalizeVisibleText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function PairPreview({
  comparisonColumnsA,
  comparisonColumnsB,
  autoPairMessage,
  autoPairEnabled,
  onAutoPairFromFileA,
  onAutoPairFromFileB,
  onSavePairOrder,
  onLoadPairOrder,
}: PairPreviewProps) {
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
  const hasPairOrderToSave = pairs.length > 0;
  const hasMismatchedCounts = comparisonColumnsA.length !== comparisonColumnsB.length;

  return (
    <div className="kinetic-panel mt-6 p-4">
      <div className="mb-4">
        <p className="hud-label">Preview</p>
        <h4 className="mt-0.5 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">Review auto-pair help and pair order</h4>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Auto-pair helper" className="kinetic-panel p-4">
          <p className="hud-label">Auto-pair</p>
          <p className="mt-1 text-sm text-[color:var(--color-kinetic-muted)]">{autoPairMessage}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="btn btn-ghost px-2 py-1 text-xs"
              disabled={!autoPairEnabled}
              onClick={onAutoPairFromFileA}
              type="button"
            >
              From File A
            </button>
            <button
              className="btn btn-ghost px-2 py-1 text-xs"
              disabled={!autoPairEnabled}
              onClick={onAutoPairFromFileB}
              type="button"
            >
              From File B
            </button>
          </div>
        </section>

        <section aria-label="Pair order" className="kinetic-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="hud-label">Pair order</p>
              <p className="mt-1 text-sm text-[color:var(--color-kinetic-muted)]">Save, load, or copy the order you want to review.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                className={`btn btn-ghost px-2 py-1 text-xs ${!hasPairOrderToSave ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!hasPairOrderToSave}
                onClick={onSavePairOrder}
                type="button"
              >
                Save pair order
              </button>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onLoadPairOrder} type="button">
                Load pair order
              </button>
              <button
                aria-label={buttonLabel}
                className={`btn btn-ghost px-2 py-1 text-xs ${copySucceeded ? 'text-[color:var(--color-kinetic-success)]' : ''}`}
                onClick={handleCopy}
                title={buttonLabel}
                type="button"
              >
                <span className="sr-only">{buttonLabel}</span>
                {copySucceeded ? (
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-[color:var(--color-kinetic-line)] pt-4">
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
                Select the same number of comparison columns in both files to run the comparison.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
