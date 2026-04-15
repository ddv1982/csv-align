import { MappingConfig } from '../MappingConfig';
import type { ComparisonNormalizationConfig, MappingResponse } from '../../types/api';
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
  onBack,
}: ConfigurationStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-end">
        <button onClick={onBack} className="btn btn-secondary flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to file selection
        </button>
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
      />
    </div>
  );
}
