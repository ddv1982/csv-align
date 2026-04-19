import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../types/api';
import { isTauri } from '../services/tauri';
import type { AppFile, MappingSelectionState } from '../types/ui';
import { SectionCard } from './ui/SectionCard';
import { ColumnChipSelector } from './mapping-config/ColumnChipSelector';
import { NormalizationPanel } from './mapping-config/NormalizationPanel';
import { PairPreview } from './mapping-config/PairPreview';
import { ArrowsRightLeftIcon, KeyIcon, TableCellsIcon } from './icons';

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

  const hasManualPairSelection =
    comparisonColumnsA.length > 0 &&
    comparisonColumnsB.length > 0 &&
    comparisonColumnsA.length === comparisonColumnsB.length;
  const hasValidAutoPairKeySelection =
    keyColumnsA.length > 0 &&
    keyColumnsB.length > 0 &&
    keyColumnsA.length === keyColumnsB.length;
  const autoPairMessage = hasValidAutoPairKeySelection
    ? 'Auto-pair uses the selected key columns as its anchor, then fills in confident one-to-one matches.'
    : 'Select the same number of key columns in both files to unlock auto-pair.';

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
      <SectionCard
        eyebrow="Pairing"
        title="Column pairing"
        description="Use matching row keys to unlock auto-pair from either file."
        headingLevel="h3"
        className="p-6"
        icon={<ArrowsRightLeftIcon className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="kinetic-panel p-4">
            <p className="hud-label">Auto-pair</p>
            <p className="mt-1 text-sm text-[color:var(--color-kinetic-muted)]">{autoPairMessage}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                onClick={() => onAutoPairComparisonColumns('a')}
                disabled={!hasValidAutoPairKeySelection}
                className="btn btn-ghost"
                type="button"
              >
                From File A
              </button>
              <button
                onClick={() => onAutoPairComparisonColumns('b')}
                disabled={!hasValidAutoPairKeySelection}
                className="btn btn-ghost"
                type="button"
              >
                From File B
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            accept=".txt,text/plain,application/json"
            className="hidden"
            onChange={handleLoadInputChange}
            type="file"
          />
        </div>
      </SectionCard>

      <NormalizationPanel normalization={normalization} onChange={updateNormalization} onDateChange={updateDateNormalization} />

      <SectionCard
        eyebrow="Keys"
        title="Row keys"
        description="Use matching key sets to line up rows before comparing values."
        icon={<KeyIcon className="h-5 w-5" />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <ColumnChipSelector
            title="File A Key Columns"
            columns={fileA.headers}
            selectedColumns={keyColumnsA}
            emptyHint="Click to select key columns (default: first column)"
            onToggle={(column) => updateSelection({ keyColumnsA: toggleColumnSelection(keyColumnsA, column) })}
          />
          <ColumnChipSelector
            title="File B Key Columns"
            columns={fileB.headers}
            selectedColumns={keyColumnsB}
            emptyHint="Click to select key columns (default: first column)"
            onToggle={(column) => updateSelection({ keyColumnsB: toggleColumnSelection(keyColumnsB, column) })}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Comparison"
        title="Comparison Columns"
        description="Choose the value columns to compare, then save, load, or copy the exact review order."
        icon={<TableCellsIcon className="h-5 w-5" />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <ColumnChipSelector
            title="File A Columns"
            columns={fileA.headers}
            selectedColumns={comparisonColumnsA}
            onToggle={(column) => updateSelection({ comparisonColumnsA: toggleColumnSelection(comparisonColumnsA, column) })}
          />
          <ColumnChipSelector
            title="File B Columns"
            columns={fileB.headers}
            selectedColumns={comparisonColumnsB}
            onToggle={(column) => updateSelection({ comparisonColumnsB: toggleColumnSelection(comparisonColumnsB, column) })}
          />
        </div>

        <PairPreview
          comparisonColumnsA={comparisonColumnsA}
          comparisonColumnsB={comparisonColumnsB}
          onSavePairOrder={onSavePairOrder}
          onLoadPairOrder={handleLoadButtonClick}
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
