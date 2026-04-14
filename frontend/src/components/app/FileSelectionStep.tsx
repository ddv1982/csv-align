import { FileSelector } from '../FileSelector';
import type { AppFile } from '../../types/ui';

interface FileSelectionStepProps {
  fileA: AppFile | null;
  fileB: AppFile | null;
  onFileSelect: (file: File, fileLetter: 'a' | 'b') => void;
  onContinue: () => void;
}

export function FileSelectionStep({ fileA, fileB, onFileSelect, onContinue }: FileSelectionStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select two local CSV files</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose the files you want to compare. You can reselect either file before running the comparison.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <FileSelector label="File A" file={fileA} onSelect={(file) => onFileSelect(file, 'a')} />
        <FileSelector label="File B" file={fileB} onSelect={(file) => onFileSelect(file, 'b')} />
      </div>

      {fileA && fileB && (
        <div className="mt-6 flex justify-end">
          <button onClick={onContinue} className="btn btn-secondary flex items-center gap-2">
            Continue to configuration
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
