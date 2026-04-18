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
      <div className="mb-6 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm shadow-gray-950/5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select two local CSV files</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Choose the files you want to compare. You can reselect either file before running the comparison.</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 lg:max-w-sm dark:border-gray-700 dark:bg-gray-800/70">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Already have a saved result?</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Load a saved comparison snapshot to reopen the results in read-only mode.</p>
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
