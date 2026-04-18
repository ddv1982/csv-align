import { MappingConfig } from '../MappingConfig';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../../types/api';
import type { AppFile, MappingSelectionState } from '../../types/ui';
import { Cog6ToothIcon } from '../icons';
import { NavButton } from '../ui/NavButton';
import { SectionCard } from '../ui/SectionCard';

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
    columnMappings: MappingDto[],
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
      <SectionCard
        eyebrow="Step 2 · Configure"
        title="Pair up columns and tune cleanup rules"
        headingLevel="h2"
        description="Set the key columns for row matching and pick which comparison columns should be compared between both files."
        icon={
          <Cog6ToothIcon className="h-5 w-5" />
        }
        action={
          <NavButton direction="back" onClick={onBack} className="shadow-sm shadow-gray-200/70 dark:shadow-none">
            Back to file selection
          </NavButton>
        }
      >
        <div />
      </SectionCard>

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
