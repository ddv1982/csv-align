import { useCallback, useState } from 'react';
import { ColumnInfo } from '../types/api';
import { CheckBadgeIcon, DocumentArrowUpIcon, DocumentTextIcon } from './icons';

function hasCsvExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

interface FileSelectorProps {
  label: string;
  file: {
    name: string;
    headers: string[];
    columns: ColumnInfo[];
    rowCount: number;
  } | null;
  onSelect: (file: File) => void;
}

export function FileSelector({ label, file, onSelect }: FileSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const handleSelectedFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) {
      return;
    }

    if (!hasCsvExtension(selectedFile.name)) {
      setSelectionError('Please choose a file with a .csv extension.');
      return;
    }

    setSelectionError(null);
    onSelect(selectedFile);
  }, [onSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleSelectedFile(files[0]);
    }
  }, [handleSelectedFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleSelectedFile(files?.[0]);
    e.target.value = '';
  }, [handleSelectedFile]);

  const openFilePicker = useCallback(() => {
    const input = document.getElementById(`file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`) as HTMLInputElement | null;
    input?.click();
  }, [label]);

  const handleDropzoneKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openFilePicker();
  }, [openFilePicker]);

  return (
    <div className="card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
          label === 'File A'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
        }`}>
          {label === 'File A' ? 'A' : 'B'}
        </span>
        {label}
      </h3>

      {file ? (
        <div className="animate-slide-up">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm shadow-gray-950/5 dark:border-gray-600 dark:bg-gray-700/50 dark:shadow-none">
            <DocumentTextIcon className="w-10 h-10 text-primary-600" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {file.rowCount} rows • {file.headers.length} columns
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              <CheckBadgeIcon className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Columns:</p>
            <div className="flex flex-wrap gap-2">
              {file.columns.map((col) => (
                <span
                  key={col.name}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm shadow-gray-950/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:shadow-none"
                >
                  {col.name}
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({col.data_type})</span>
                </span>
              ))}
            </div>
          </div>

          <label className="mt-4 btn btn-secondary w-full text-center cursor-pointer block">
            <input
              id={`file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            Select Another File
          </label>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${label} file selector`}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
            isDragging
              ? 'border-primary-400 bg-primary-50 shadow-sm shadow-primary-500/10 dark:bg-primary-900/20 dark:shadow-none'
              : 'border-gray-300 bg-white/80 hover:border-primary-400 hover:bg-white dark:border-gray-600 dark:bg-gray-800/40 dark:hover:bg-gray-800/60'
           }`}
         >
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isDragging ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <DocumentArrowUpIcon
                className={`w-8 h-8 ${isDragging ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`}
              />
            </div>

            <p className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
              {isDragging ? 'Drop the local CSV file here' : 'Drag & drop a local CSV file to choose it'}
            </p>
             <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">or</p>

            <label className="btn btn-primary cursor-pointer">
              <input
                id={`file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              Choose Local CSV
            </label>

          </div>
        </div>
      )}

      {selectionError && (
        <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">{selectionError}</p>
      )}
    </div>
  );
}

export { hasCsvExtension };
