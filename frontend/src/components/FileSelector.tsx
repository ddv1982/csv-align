import { useCallback, useId, useState } from 'react';
import { ColumnInfo } from '../types/api';

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
  const inputId = useId();
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
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    input?.click();
  }, [inputId]);

  const handleDropzoneKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openFilePicker();
  }, [openFilePicker]);

  return (
    <div className="card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">
        <span className={`flex h-7 w-7 items-center justify-center border font-mono text-sm font-bold ${
           label === 'File A'
            ? 'border-[rgba(110,231,255,0.4)] bg-[rgba(110,231,255,0.08)] text-[color:var(--color-kinetic-accent)]'
            : 'border-[rgba(108,255,190,0.4)] bg-[rgba(108,255,190,0.08)] text-[color:var(--color-kinetic-success)]'
         }`}>
          {label === 'File A' ? 'A' : 'B'}
        </span>
        {label}
      </h3>

      {file ? (
        <div className="animate-slide-up">
          <div className="kinetic-panel flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center border border-[color:var(--color-kinetic-line-strong)] font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-kinetic-accent)]">
              CSV
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[color:var(--color-kinetic-copy)]">{file.name}</p>
              <p className="text-sm text-[color:var(--color-kinetic-muted)]">
                {file.rowCount} rows • {file.headers.length} columns
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center border border-[rgba(108,255,190,0.4)] bg-[rgba(108,255,190,0.08)] font-mono text-xs uppercase text-[color:var(--color-kinetic-success)]">
              OK
            </div>
          </div>

          <div className="mt-4">
            <p className="hud-label mb-2">Columns</p>
            <div className="flex flex-wrap gap-2">
              {file.columns.map((col) => (
                <span
                  key={col.name}
                  className="table-chip"
                >
                  {col.name}
                  <span className="ml-2 text-[color:var(--color-kinetic-muted)]">[{col.data_type}]</span>
                </span>
              ))}
            </div>
          </div>

          <label className="mt-4 btn btn-secondary w-full text-center cursor-pointer block">
            <input
              id={inputId}
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
          title={`Choose a local CSV for ${label}`}
          className={`border p-8 text-center transition-all duration-200 ${
             isDragging
              ? 'border-[color:var(--color-kinetic-accent)] bg-[rgba(110,231,255,0.08)]'
              : 'border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.02)] hover:border-[color:var(--color-kinetic-line-strong)] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
          >
           <div className="flex flex-col items-center">
             <div className={`mb-4 flex h-16 w-16 items-center justify-center border font-mono text-lg uppercase tracking-[0.24em] ${
               isDragging ? 'border-[color:var(--color-kinetic-accent)] text-[color:var(--color-kinetic-accent)]' : 'border-[color:var(--color-kinetic-line)] text-[color:var(--color-kinetic-muted)]'
             }`}>
               IN
             </div>

             <p className="mb-1 text-lg font-medium uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">
               {isDragging ? 'Drop the local CSV file here' : 'Drag & drop a local CSV file to choose it'}
             </p>
              <p className="mb-4 text-sm text-[color:var(--color-kinetic-muted)]">or</p>

             <label className="btn btn-primary cursor-pointer">
               <input
                id={inputId}
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
        <p className="mt-3 border border-[rgba(255,122,122,0.45)] bg-[rgba(255,122,122,0.08)] px-3 py-2 text-sm font-medium text-[color:var(--color-kinetic-danger)]">{selectionError}</p>
      )}
    </div>
  );
}

export { hasCsvExtension };
