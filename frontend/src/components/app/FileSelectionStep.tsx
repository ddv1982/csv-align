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
    <div className="animate-fade-in space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="hud-label">Intake</p>
            <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">Stage the two CSV feeds</h2>
            <p className="mt-2 text-sm text-[color:var(--color-kinetic-muted)]">Choose the two local files you want to compare. Full column inventories stay tucked away until you need them.</p>
          </div>

          <div className="kinetic-utility-strip max-w-md">
            <div>
              <p className="hud-label">Replay</p>
              <p className="mt-1 text-sm text-[color:var(--color-kinetic-muted)]">Load a saved result to reopen its findings in read-only mode.</p>
            </div>
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
