import { useEffect, useId, useState } from 'react';
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon } from '../icons';

interface PairPreviewProps {
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
  autoPairMessage: string;
  autoPairEnabled: boolean;
  pairOrderKeySelectionValid: boolean;
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
  pairOrderKeySelectionValid,
  onAutoPairFromFileA,
  onAutoPairFromFileB,
  onSavePairOrder,
  onLoadPairOrder,
}: PairPreviewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const saveReasonId = useId();
  const copyReasonId = useId();
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
  const pairOrderText = pairs.map((pair) => pair.displayText).join('\n');
  const hasMismatchedCounts = comparisonColumnsA.length !== comparisonColumnsB.length;
  const hasPairOrderToSave = pairs.length > 0 && !hasMismatchedCounts && pairOrderKeySelectionValid;
  const disabledPairOrderReason = hasMismatchedCounts
    ? 'Select the same number of comparison columns in both files before saving.'
    : !pairOrderKeySelectionValid
      ? 'Select the same number of row keys in both files before saving.'
      : pairs.length === 0
        ? 'Select at least one complete comparison pair before saving or copying.'
        : undefined;

  useEffect(() => {
    if (copyStatus === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyStatus]);

  const handleCopy = async () => {
    if (!hasPairOrderToSave) {
      return;
    }

    if (typeof navigator.clipboard?.writeText !== 'function') {
      setCopyStatus('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(pairOrderText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const buttonLabel = copyStatus === 'copied'
    ? 'Copied current pair order'
    : copyStatus === 'failed'
      ? 'Copy failed. Select the preview text to copy manually.'
      : 'Copy current pair order';

  return (
    <div className="surface-panel mt-6 p-4">
      <div className="mb-4">
        <p className="hud-label">Preview</p>
        <h4 className="mt-0.5 text-sm font-semibold uppercase tracking-[0.14em] text-app-text">Review auto-pair help and pair order</h4>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Auto-pair helper" className="surface-panel p-4">
          <p className="hud-label">Auto-pair</p>
          <p className="mt-1 text-sm text-app-muted">{autoPairMessage}</p>
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

        <section aria-label="Pair order" className="surface-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="hud-label">Pair order</p>
              <p className="mt-1 text-sm text-app-muted">Save, load, or copy the order you want to review.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                className={`btn btn-ghost px-2 py-1 text-xs ${!hasPairOrderToSave ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={!hasPairOrderToSave}
                aria-describedby={!hasPairOrderToSave ? saveReasonId : undefined}
                title={hasPairOrderToSave ? undefined : disabledPairOrderReason}
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
                className={`btn btn-ghost px-2 py-1 text-xs ${copyStatus === 'copied' ? 'text-app-success' : copyStatus === 'failed' ? 'text-app-warning' : ''}`}
                disabled={!hasPairOrderToSave}
                aria-describedby={!hasPairOrderToSave ? copyReasonId : undefined}
                onClick={handleCopy}
                title={buttonLabel}
                type="button"
              >
                <span className="sr-only">{buttonLabel}</span>
                {copyStatus === 'copied' ? (
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-app-border pt-4">
            {pairs.length > 0 ? (
              <div className="space-y-1 font-mono text-sm text-app-text">
                {pairs.map((pair, index) => (
                  <div key={`${pair.columnA}-${pair.columnB}-${index}`} className="truncate" title={pair.displayText}>
                    {pair.displayText}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-app-muted">No pairs selected yet.</p>
            )}
            {hasMismatchedCounts && (
              <p className="mt-3 text-sm text-app-warning">
                Select the same number of comparison columns in both files to run the comparison.
              </p>
            )}
            {!hasPairOrderToSave && disabledPairOrderReason && (
              <p id={saveReasonId} className="mt-3 text-sm text-app-warning">
                {disabledPairOrderReason}
              </p>
            )}
            {!hasPairOrderToSave && disabledPairOrderReason && (
              <span id={copyReasonId} className="sr-only">
                {disabledPairOrderReason}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
