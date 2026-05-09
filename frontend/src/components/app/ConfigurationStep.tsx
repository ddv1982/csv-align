import { MappingConfig } from '../MappingConfig';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../../types/api';
import type { AppFile, MappingSelectionState } from '../../types/ui';
import { NavButton } from '../ui/NavButton';

function FileOverview({ label, name, rowCount, columnCount, headers }: { label: string; name: string; rowCount: number; columnCount: number; headers: string[] }) {
  return (
    <section className="surface-panel p-4">
      <div className="min-w-0">
        <p className="hud-label">{label}</p>
        <h3 className="mt-1 truncate text-sm font-semibold uppercase tracking-[0.14em] text-app-text">{name}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-muted">
        <span className="table-chip">{rowCount} rows</span>
        <span className="table-chip">{columnCount} columns</span>
      </div>
      <details className="mt-3 group">
        <summary className="cursor-pointer list-none text-sm text-app-muted marker:hidden">
          <span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
          Inspect available columns
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {headers.map((header) => (
            <span key={header} className="table-chip">{header}</span>
          ))}
        </div>
      </details>
    </section>
  );
}

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
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="hud-label">Configure</p>
            <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.14em] text-app-text">Set row keys and comparison pairs</h2>
          </div>
          <div className="shrink-0">
            <NavButton direction="back" onClick={onBack}>
              Back to file selection
            </NavButton>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <FileOverview label="File A" name={fileA.name} rowCount={fileA.rowCount} columnCount={fileA.headers.length} headers={fileA.headers} />
          <FileOverview label="File B" name={fileB.name} rowCount={fileB.rowCount} columnCount={fileB.headers.length} headers={fileB.headers} />
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
