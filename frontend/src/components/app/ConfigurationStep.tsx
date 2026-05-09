import { MappingConfig } from '../MappingConfig';
import type { ComparisonNormalizationConfig, FileLetter, MappingDto } from '../../types/api';
import type { AppFile, MappingSelectionState } from '../../types/ui';
import { NavButton } from '../ui/NavButton';
import { StepIntroCard } from '../ui/StepIntroCard';

function FileOverview({ label, name, rowCount, columnCount, headers }: { label: string; name: string; rowCount: number; columnCount: number; headers: string[] }) {
  return (
    <section className="surface-panel p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${label === 'File A' ? 'tone-accent-strong' : 'tone-success-strong'}`}>
          {label === 'File A' ? 'A' : 'B'}
        </span>
        <div className="min-w-0">
          <p className="hud-label">{label}</p>
          <h3 className="mt-1 truncate text-sm font-semibold tracking-tight text-app-text">{name}</h3>
        </div>
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
      <StepIntroCard
        eyebrow="Step 2 · Configure"
        title="Configure row keys and comparison pairs"
        description="Choose how rows line up, then select the columns whose values should be compared."
        action={
          <NavButton direction="back" onClick={onBack}>
            Back to file selection
          </NavButton>
        }
        actionClassName="shrink-0"
      >
        <div className="grid gap-4 border-t border-app-border p-5 sm:p-6 lg:grid-cols-2">
          <FileOverview label="File A" name={fileA.name} rowCount={fileA.rowCount} columnCount={fileA.headers.length} headers={fileA.headers} />
          <FileOverview label="File B" name={fileB.name} rowCount={fileB.rowCount} columnCount={fileB.headers.length} headers={fileB.headers} />
        </div>
      </StepIntroCard>

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
