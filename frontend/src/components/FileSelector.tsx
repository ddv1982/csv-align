import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { listenForTauriDragDrop } from '../services/tauri';
import { ColumnInfo } from '../types/api';
import type { SelectedFileSource } from '../types/ui';
import { getSelectedFileName } from '../utils/selectedFileSource';

function hasCsvExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

function isPointInsideElement(element: HTMLElement, position: { x: number; y: number }): boolean {
  const rect = element.getBoundingClientRect();
  return position.x >= rect.left
    && position.x <= rect.right
    && position.y >= rect.top
    && position.y <= rect.bottom;
}

function toCssPixelPosition(position: { x: number; y: number }): { x: number; y: number } {
  const scaleFactor = window.devicePixelRatio || 1;

  return {
    x: position.x / scaleFactor,
    y: position.y / scaleFactor,
  };
}

interface FileSelectorProps {
  label: string;
  file: {
    name: string;
    headers: string[];
    columns: ColumnInfo[];
    rowCount: number;
  } | null;
  onSelect: (file: SelectedFileSource) => void;
}

export function FileSelector({ label, file, onSelect }: FileSelectorProps) {
  const inputId = useId();
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const handleSelectedFile = useCallback((selectedFile?: SelectedFileSource) => {
    if (!selectedFile) {
      return;
    }

    if (!hasCsvExtension(getSelectedFileName(selectedFile))) {
      setSelectionError('Please choose a file with a .csv extension.');
      return;
    }

    setSelectionError(null);
    onSelect(selectedFile);
  }, [onSelect]);

  useEffect(() => {
    if (file) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForTauriDragDrop((event) => {
      const dropzone = dropzoneRef.current;
      if (disposed || !dropzone) {
        return;
      }

      if (event.type === 'leave') {
        setIsDragging(false);
        return;
      }

      const isInsideDropzone = isPointInsideElement(dropzone, toCssPixelPosition(event.position));

      if (event.type === 'enter' || event.type === 'over') {
        setIsDragging(isInsideDropzone);
        return;
      }

      setIsDragging(false);

      if (!isInsideDropzone || event.paths.length === 0) {
        return;
      }

      handleSelectedFile(event.paths[0]);
    }).then((tauriUnlisten) => {
      if (disposed) {
        tauriUnlisten?.();
        return;
      }

      unlisten = tauriUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [file, handleSelectedFile]);

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
    fileInputRef.current?.click();
  }, []);

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
            ? 'kinetic-tone-accent-strong'
            : 'kinetic-tone-success-strong'
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
            <div className="kinetic-tone-success-strong flex h-8 w-8 items-center justify-center border font-mono text-xs uppercase">
              OK
            </div>
          </div>

          <details className="kinetic-panel mt-4 px-4 py-3 group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <div>
                <p className="hud-label">Details</p>
                <p className="mt-1 text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">View rows, columns, and headers</p>
              </div>
              <span aria-hidden="true" className="font-mono text-sm text-[color:var(--color-kinetic-muted)] transition-transform group-open:rotate-90">▸</span>
            </summary>

            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="kinetic-frame px-3 py-2">
                  <dt className="hud-label">Rows</dt>
                  <dd className="mt-1 font-mono text-sm text-[color:var(--color-kinetic-copy)]">{file.rowCount}</dd>
                </div>
                <div className="kinetic-frame px-3 py-2">
                  <dt className="hud-label">Columns</dt>
                  <dd className="mt-1 font-mono text-sm text-[color:var(--color-kinetic-copy)]">{file.headers.length}</dd>
                </div>
              </dl>

              <div>
                <p className="hud-label mb-2">Columns</p>
                <div className="flex flex-wrap gap-2">
                  {file.columns.map((col) => (
                    <span key={col.name} className="table-chip">
                      {col.name}
                      <span className="ml-2 text-[color:var(--color-kinetic-muted)]">[{col.data_type}]</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <button
            type="button"
            onClick={openFilePicker}
            className="mt-4 btn btn-secondary block w-full text-center"
          >
            Choose a different CSV file
          </button>
          <input
            ref={fileInputRef}
            id={inputId}
            aria-label="Choose a CSV file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div
          ref={dropzoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${label} file selector`}
          title={`Choose a CSV file for ${label}`}
          className={`border p-8 text-center transition-all duration-200 ${
             isDragging
              ? 'kinetic-dropzone-active'
              : 'kinetic-dropzone'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className={`kinetic-empty-glyph ${
                isDragging ? 'border-[color:var(--color-kinetic-accent)] text-[color:var(--color-kinetic-accent)]' : 'border-[color:var(--color-kinetic-line)] text-[color:var(--color-kinetic-muted)]'
              }`}>
                IN
              </div>

              <p className="mb-1 text-lg font-medium uppercase tracking-[0.14em] text-[color:var(--color-kinetic-copy)]">
                {isDragging ? 'Drop the CSV file here' : 'Drag a CSV file here'}
              </p>
              <p className="mb-4 text-sm text-[color:var(--color-kinetic-muted)]">or choose one from this device</p>

              <button type="button" onClick={openFilePicker} className="btn btn-primary">
                Choose a CSV file
              </button>
              <input
                ref={fileInputRef}
                id={inputId}
                aria-label="Choose a CSV file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
      )}

      {selectionError && (
        <p className="kinetic-tone-danger-strong mt-3 border px-3 py-2 text-sm font-medium">{selectionError}</p>
      )}
    </div>
  );
}

export { hasCsvExtension };
