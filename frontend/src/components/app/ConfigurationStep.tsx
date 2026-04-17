import { MappingConfig } from '../MappingConfig';
import type { ComparisonNormalizationConfig, FileLetter, MappingResponse } from '../../types/api';
import type { AppFile, MappingSelectionState } from '../../types/ui';

interface ConfigurationStepProps {
  fileA: AppFile;
  fileB: AppFile;
  selection: MappingSelectionState;
  normalization: ComparisonNormalizationConfig;
  onSelectionChange: (selection: MappingSelectionState) => void;
  onNormalizationChange: (normalization: ComparisonNormalizationConfig) => void;
  onCompare: (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingResponse[],
    normalization: ComparisonNormalizationConfig,
  ) => void;
  onSavePairOrder: () => void;
  onLoadPairOrder: (file?: File) => void;
  onAutoPairComparisonColumns: (leadingSide: FileLetter) => void;
  onBack: () => void;
}

export function ConfigurationStep({
  fileA,
  fileB,
  selection,
  normalization,
  onSelectionChange,
  onNormalizationChange,
  onCompare,
  onSavePairOrder,
  onLoadPairOrder,
  onAutoPairComparisonColumns,
  onBack,
}: ConfigurationStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-2xl border border-gray-200/90 bg-white/95 p-5 shadow-sm shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">Step 2 · Configure</p>
              <h2 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Pair up columns and tune cleanup rules</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">Set the key columns for row matching and pick which comparison columns should be compared between both files.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 lg:shrink-0">
            <button onClick={onBack} className="btn btn-secondary flex items-center gap-2 shadow-sm shadow-gray-200/70 dark:shadow-none" type="button">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to file selection
            </button>
          </div>
        </div>
      </div>

      <MappingConfig
        fileA={fileA}
        fileB={fileB}
        selection={selection}
        normalization={normalization}
        onSelectionChange={onSelectionChange}
        onNormalizationChange={onNormalizationChange}
        onCompare={onCompare}
        onSavePairOrder={onSavePairOrder}
        onLoadPairOrder={onLoadPairOrder}
        onAutoPairComparisonColumns={onAutoPairComparisonColumns}
      />
    </div>
  );
}
