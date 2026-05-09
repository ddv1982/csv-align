import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckDocumentIcon, DocumentArrowUpIcon } from './icons';
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
  const fileLetter = label === 'File A' ? 'A' : 'B';
  const fileToneClass = label === 'File A' ? 'tone-accent-strong' : 'tone-success-strong';

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

  return (
    <div className="card file-selector-card p-5 sm:p-6">
      <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold tracking-tight text-app-text">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-sm font-bold ${fileToneClass}`}>
          {fileLetter}
        </span>
        {label}
      </h3>

      {file ? (
        <div className="animate-slide-up">
          <div className="surface-panel flex items-center gap-3 p-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${fileToneClass}`}>
              <CheckDocumentIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-app-text">{file.name}</p>
              <p className="text-sm text-app-muted">
                {file.rowCount} rows • {file.headers.length} columns
              </p>
            </div>
            <div className="tone-success-strong flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs uppercase">
              OK
            </div>
          </div>

          <details className="surface-panel group mt-4 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <div>
                <p className="hud-label">Details</p>
                <p className="mt-1 text-sm font-medium text-app-text">View rows, columns, and headers</p>
              </div>
              <span aria-hidden="true" className="font-mono text-sm text-app-muted transition-transform group-open:rotate-90">▸</span>
            </summary>

            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="app-frame px-3 py-2">
                  <dt className="hud-label">Rows</dt>
                  <dd className="mt-1 font-mono text-sm text-app-text">{file.rowCount}</dd>
                </div>
                <div className="app-frame px-3 py-2">
                  <dt className="hud-label">Columns</dt>
                  <dd className="mt-1 font-mono text-sm text-app-text">{file.headers.length}</dd>
                </div>
              </dl>

              <div>
                <p className="hud-label mb-2">Columns</p>
                <div className="flex flex-wrap gap-2">
                  {file.columns.map((col) => (
                    <span key={col.name} className="table-chip">
                      {col.name}
                      <span className="ml-2 text-app-muted">[{col.data_type}]</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <button
            type="button"
            onClick={openFilePicker}
            className="btn btn-secondary mt-4 block w-full text-center"
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
          data-testid={`file-selector-dropzone-${fileLetter.toLowerCase()}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label={`${label} CSV dropzone`}
          className={`border border-dashed p-8 text-center transition-all duration-200 ${
             isDragging
              ? 'file-dropzone-active'
              : 'file-dropzone'
            }`}
        >
          <div className="flex flex-col items-center">
            <div className={`empty-state-icon ${
              isDragging ? 'border-app-accent text-app-accent' : 'border-app-border text-app-muted'
            }`}>
              <DocumentArrowUpIcon className="h-8 w-8" />
            </div>

            <p className="mb-1 text-lg font-semibold tracking-tight text-app-text">
              {isDragging ? 'Drop the CSV file here' : 'Drag & drop a local CSV file to choose it'}
            </p>
            <p className="mb-4 text-sm text-app-muted">or choose one from this device</p>

            <button type="button" onClick={openFilePicker} className="btn btn-primary">
              Choose Local CSV
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
        <p className="tone-danger-strong mt-3 rounded-lg border px-3 py-2 text-sm font-medium">{selectionError}</p>
      )}
    </div>
  );
}

export { hasCsvExtension };
