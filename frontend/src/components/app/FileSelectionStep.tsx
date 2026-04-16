import { useCallback, useId } from 'react';
import { FileSelector } from '../FileSelector';
import { isTauri } from '../../services/tauri';
import type { AppFile } from '../../types/ui';

interface FileSelectionStepProps {
  fileA: AppFile | null;
  fileB: AppFile | null;
  onFileSelect: (file: File, fileLetter: 'a' | 'b') => void;
  onLoadResult: (file?: File) => void;
  onContinue: () => void;
}

export function FileSelectionStep({ fileA, fileB, onFileSelect, onLoadResult, onContinue }: FileSelectionStepProps) {
  const loadResultInputId = useId();
  const handleLoadResultChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onLoadResult(selectedFile);
    }
    event.target.value = '';
  }, [onLoadResult]);

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
            {isTauri ? (
              <button type="button" onClick={() => onLoadResult()} className="mt-3 inline-flex items-center gap-2 btn btn-secondary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-6l-4-4m0 0L8 10m4-4v12" />
                </svg>
                Load result
              </button>
            ) : (
              <>
                <label htmlFor={loadResultInputId} className="mt-3 inline-flex cursor-pointer items-center gap-2 btn btn-secondary">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-6l-4-4m0 0L8 10m4-4v12" />
                  </svg>
                  Load result
                </label>
                <input
                  id={loadResultInputId}
                  data-testid="load-result-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleLoadResultChange}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
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
