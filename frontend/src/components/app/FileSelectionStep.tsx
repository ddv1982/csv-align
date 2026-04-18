import { FileSelector } from '../FileSelector';
import type { AppFile } from '../../types/ui';
import { LoadResultButton } from '../ui/LoadResultButton';
import { NavButton } from '../ui/NavButton';

interface FileSelectionStepProps {
  fileA: AppFile | null;
  fileB: AppFile | null;
  onFileSelect: (file: File, fileLetter: 'a' | 'b') => void;
  onLoadResult: (file?: File) => void;
  onContinue: () => void;
}

export function FileSelectionStep({ fileA, fileB, onFileSelect, onLoadResult, onContinue }: FileSelectionStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="card mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hud-label">Step 1 / Intake</p>
            <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">Select two local CSV files</h2>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-kinetic-muted)]">Choose the files you want to compare. You can reselect either file before running the comparison.</p>
          </div>

          <div className="kinetic-panel lg:max-w-sm p-4">
            <p className="hud-label">Replay</p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">Already have a saved result?</p>
            <p className="mt-1 text-sm text-[color:var(--color-kinetic-muted)]">Load a saved comparison snapshot to reopen the results in read-only mode.</p>
            <LoadResultButton onLoadResult={onLoadResult} />
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <FileSelector label="File A" file={fileA} onSelect={(file) => onFileSelect(file, 'a')} />
        <FileSelector label="File B" file={fileB} onSelect={(file) => onFileSelect(file, 'b')} />
      </div>

      {fileA && fileB && (
        <div className="mt-6 flex justify-end">
          <NavButton direction="forward" onClick={onContinue}>
            Continue to configuration
          </NavButton>
        </div>
      )}
    </div>
  );
}
