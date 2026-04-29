import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../types/api';
import { isTauri } from '../services/tauri';
import type { AppFile, MappingSelectionState } from '../types/ui';
import { SectionCard } from './ui/SectionCard';
import { ColumnChipSelector } from './mapping-config/ColumnChipSelector';
import { NormalizationPanel } from './mapping-config/NormalizationPanel';
import { PairPreview } from './mapping-config/PairPreview';
import { KeyIcon, TableCellsIcon } from './icons';

interface MappingConfigProps {
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
}

function toggleColumnSelection(selectedColumns: string[], column: string) {
  return selectedColumns.includes(column)
    ? selectedColumns.filter((selectedColumn) => selectedColumn !== column)
    : [...selectedColumns, column];
}

export function MappingConfig({
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
}: MappingConfigProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { keyColumnsA, keyColumnsB, comparisonColumnsA, comparisonColumnsB } = selection;

  const updateSelection = (updates: Partial<MappingSelectionState>) => {
    onSelectionChange({ ...selection, ...updates });
  };

  const updateNormalization = (updates: Partial<ComparisonNormalizationConfig>) => {
    onNormalizationChange({ ...normalization, ...updates });
  };

  const updateDateNormalization = (updates: Partial<ComparisonNormalizationConfig['date_normalization']>) => {
    onNormalizationChange({
      ...normalization,
      date_normalization: {
        ...normalization.date_normalization,
        ...updates,
      },
    });
  };

  const updateDecimalRounding = (updates: Partial<ComparisonNormalizationConfig['decimal_rounding']>) => {
    onNormalizationChange({
      ...normalization,
      decimal_rounding: {
        ...normalization.decimal_rounding,
        ...updates,
      },
    });
  };

  const hasManualPairSelection =
    comparisonColumnsA.length > 0 &&
    comparisonColumnsB.length > 0 &&
    comparisonColumnsA.length === comparisonColumnsB.length;
  const hasValidAutoPairKeySelection =
    keyColumnsA.length > 0 &&
    keyColumnsB.length > 0 &&
    keyColumnsA.length === keyColumnsB.length;
  const autoPairMessage = hasValidAutoPairKeySelection
    ? 'Auto-pair starts from the selected row keys and fills in the strongest one-to-one column matches.'
    : 'Select the same number of row keys in both files to enable auto-pair.';

  const manualMappings: MappingDto[] = comparisonColumnsA.map((fileAColumn, index) => ({
    file_a_column: fileAColumn,
    file_b_column: comparisonColumnsB[index] ?? '',
    mapping_type: 'manual',
  }));

  const handleCompare = () => {
    if (!hasManualPairSelection) {
      return;
    }

    onCompare(
      keyColumnsA.length > 0 ? keyColumnsA : [fileA.headers[0]],
      keyColumnsB.length > 0 ? keyColumnsB : [fileB.headers[0]],
      comparisonColumnsA,
      comparisonColumnsB,
      manualMappings,
      normalization,
    );
  };

  const handleLoadButtonClick = () => {
    if (isTauri) {
      onLoadPairOrder();
      return;
    }

    fileInputRef.current?.click();
  };

  const handleLoadInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    await onLoadPairOrder(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <NormalizationPanel
        normalization={normalization}
        onChange={updateNormalization}
        onDateChange={updateDateNormalization}
        onDecimalRoundingChange={updateDecimalRounding}
      />

      <SectionCard
        eyebrow="Keys"
        title="Match rows with row keys"
        description="Pick the columns that identify the same row in each file before comparing values."
        icon={<KeyIcon className="h-5 w-5" />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <ColumnChipSelector
            title="Row keys in File A"
            columns={fileA.headers}
            virtualColumns={fileA.virtualHeaders}
            selectedColumns={keyColumnsA}
            emptyHint="Select row keys (defaults to the first column if left empty)"
            onToggle={(column) => updateSelection({ keyColumnsA: toggleColumnSelection(keyColumnsA, column) })}
          />
          <ColumnChipSelector
            title="Row keys in File B"
            columns={fileB.headers}
            virtualColumns={fileB.virtualHeaders}
            selectedColumns={keyColumnsB}
            emptyHint="Select row keys (defaults to the first column if left empty)"
            onToggle={(column) => updateSelection({ keyColumnsB: toggleColumnSelection(keyColumnsB, column) })}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Comparison"
        title="Choose columns to compare"
        description="Select the columns to compare, then review or reuse the pair order shown below."
        icon={<TableCellsIcon className="h-5 w-5" />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <ColumnChipSelector
            title="File A Columns"
            columns={fileA.headers}
            virtualColumns={fileA.virtualHeaders}
            selectedColumns={comparisonColumnsA}
            onToggle={(column) => updateSelection({ comparisonColumnsA: toggleColumnSelection(comparisonColumnsA, column) })}
          />
          <ColumnChipSelector
            title="File B Columns"
            columns={fileB.headers}
            virtualColumns={fileB.virtualHeaders}
            selectedColumns={comparisonColumnsB}
            onToggle={(column) => updateSelection({ comparisonColumnsB: toggleColumnSelection(comparisonColumnsB, column) })}
          />
        </div>

        <PairPreview
          comparisonColumnsA={comparisonColumnsA}
          comparisonColumnsB={comparisonColumnsB}
          autoPairMessage={autoPairMessage}
          autoPairEnabled={hasValidAutoPairKeySelection}
          onAutoPairFromFileA={() => onAutoPairComparisonColumns('a')}
          onAutoPairFromFileB={() => onAutoPairComparisonColumns('b')}
          onSavePairOrder={onSavePairOrder}
          onLoadPairOrder={handleLoadButtonClick}
        />

        <input
          ref={fileInputRef}
          accept=".txt,text/plain,application/json"
          className="hidden"
          onChange={handleLoadInputChange}
          type="file"
        />
      </SectionCard>

      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={!hasManualPairSelection}
          className={`btn btn-success flex items-center gap-2 px-8 py-3 text-sm ${!hasManualPairSelection ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span aria-hidden="true">GO</span>
          Run Comparison
        </button>
      </div>
    </div>
  );
}
