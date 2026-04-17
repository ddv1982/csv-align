import type { ChangeEvent, ReactNode } from 'react';
import { useRef } from 'react';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../types/api';
import { isTauri } from '../services/tauri';
import type { AppFile, MappingSelectionState } from '../types/ui';
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

interface SectionCardProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  headingLevel?: 'h3' | 'h4';
  children: ReactNode;
  action?: ReactNode;
}

function SectionCard({ eyebrow, title, description, icon, headingLevel = 'h3', children, action }: SectionCardProps) {
  const HeadingTag = headingLevel;
  return (
    <section className="rounded-2xl border border-gray-200/90 bg-white/95 p-6 shadow-sm shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
            {icon}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{eyebrow}</p>
            <HeadingTag className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</HeadingTag>
            {description && (
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
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
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
          </svg>
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
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
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
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
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
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Run Comparison
        </button>
      </div>
    </div>
  );
}
