import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../types/api';
import { isTauri } from '../services/tauri';
import type { AppFile, MappingSelectionState } from '../types/ui';
import { SectionCard } from './ui/SectionCard';
import { CheckDocumentIcon, KeyIcon, PencilSquareIcon, TableCellsIcon } from './icons';
import { ColumnChipSelector } from './mapping-config/ColumnChipSelector';
import { NormalizationPanel } from './mapping-config/NormalizationPanel';
import { PairPreview } from './mapping-config/PairPreview';

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
        eyebrow="Step 2 · Configure"
        title="Manual column pairing"
        description="Select key columns first, then choose comparison columns manually or auto-pair confident matches using File A or File B as the leading order."
        headingLevel="h3"
        className="p-6"
        icon={
          <TableCellsIcon className="h-5 w-5" />
        }
      >
        <div className="flex flex-wrap gap-3">
          <button onClick={onSavePairOrder} className="btn btn-secondary" type="button">
            Save pair order
          </button>
          <button onClick={handleLoadButtonClick} className="btn btn-secondary" type="button">
            Load pair order
          </button>
          <button
            onClick={() => onAutoPairComparisonColumns('a')}
            disabled={!hasValidAutoPairKeySelection}
            className={`btn btn-secondary ${!hasValidAutoPairKeySelection ? 'cursor-not-allowed opacity-50' : ''}`}
            type="button"
          >
            Auto-pair from File A
          </button>
          <button
            onClick={() => onAutoPairComparisonColumns('b')}
            disabled={!hasValidAutoPairKeySelection}
            className={`btn btn-secondary ${!hasValidAutoPairKeySelection ? 'cursor-not-allowed opacity-50' : ''}`}
            type="button"
          >
            Auto-pair from File B
          </button>
          <input
            ref={fileInputRef}
            accept=".txt,text/plain,application/json"
            className="hidden"
            onChange={handleLoadInputChange}
            type="file"
          />
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {hasValidAutoPairKeySelection
            ? 'When confident comparison matches are found, auto-pair starts with the selected key pair(s) and then adds the remaining one-to-one matches.'
            : 'Select the same number of key columns in File A and File B to enable auto-pair. Those key pairs are used as the starting point for any generated comparison order.'}
        </p>
      </SectionCard>

      <NormalizationPanel normalization={normalization} onChange={updateNormalization} onDateChange={updateDateNormalization} />

      <SectionCard
        eyebrow="Keys"
        title="Key Columns (for row matching)"
        description="Selected keys align rows between File A and File B."
        icon={
          <KeyIcon className="h-5 w-5" />
        }
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
        description="Pick the columns whose values should actually be compared between the two files."
        icon={
          <PencilSquareIcon className="h-5 w-5" />
        }
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

        <PairPreview comparisonColumnsA={comparisonColumnsA} comparisonColumnsB={comparisonColumnsB} />
      </SectionCard>

      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={!hasManualPairSelection}
          className={`btn btn-success flex items-center gap-2 px-8 py-3 text-lg shadow-sm shadow-emerald-300/40 dark:shadow-none ${!hasManualPairSelection ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <CheckDocumentIcon className="h-6 w-6" />
          Run Comparison
        </button>
      </div>
    </div>
  );
}
