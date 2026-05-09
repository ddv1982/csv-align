import { FileSelector } from '../FileSelector';
import type { AppFile, SelectedFileSource } from '../../types/ui';
import { LoadResultButton } from '../ui/LoadResultButton';
import { NavButton } from '../ui/NavButton';

interface FileSelectionStepProps {
  fileA: AppFile | null;
  fileB: AppFile | null;
  onFileSelect: (file: SelectedFileSource, fileLetter: 'a' | 'b') => void;
  onLoadResult: (file?: File) => void;
  onContinue: () => void;
}

export function FileSelectionStep({ fileA, fileB, onFileSelect, onLoadResult, onContinue }: FileSelectionStepProps) {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="hud-label">Files</p>
            <h2 className="mt-1 text-lg font-semibold uppercase tracking-[0.14em] text-app-text">Choose the two CSV files</h2>
            <p className="mt-2 text-sm text-app-muted">Select the two local CSV files you want to compare. Row counts and column details stay available if you need to review them.</p>
          </div>

          <div className="utility-strip max-w-md">
            <div>
              <p className="hud-label">Saved Result</p>
              <p className="mt-1 text-sm text-app-muted">Open a saved result to review its findings in read-only mode.</p>
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
