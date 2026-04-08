import { useCallback, useState } from 'react';
import { ColumnInfo } from '../types/api';

interface FileUploadProps {
  label: string;
  file: {
    name: string;
    headers: string[];
    columns: ColumnInfo[];
    rowCount: number;
  } | null;
  onUpload: (file: File) => void;
}

export function FileUpload({ label, file, onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

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
      const droppedFile = files[0];
      if (droppedFile.name.endsWith('.csv')) {
        onUpload(droppedFile);
      }
    }
  }, [onUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  }, [onUpload]);

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
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {file.rowCount} rows • {file.headers.length} columns
              </p>
            </div>
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Columns:</p>
            <div className="flex flex-wrap gap-2">
              {file.columns.map((col) => (
                <span
                  key={col.name}
                  className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  {col.name}
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({col.data_type})</span>
                </span>
              ))}
            </div>
          </div>

          <label className="mt-4 btn btn-secondary w-full text-center cursor-pointer block">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            Replace File
          </label>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            isDragging
               ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
               : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/60'
           }`}
        >
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isDragging ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <svg
                className={`w-8 h-8 ${isDragging ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            
              <p className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
                {isDragging ? 'Drop your file here' : 'Drag & drop your CSV file to select it'}
              </p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">or</p>
            
              <label className="btn btn-primary cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                Select File
              </label>
            
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">Supports CSV files up to 50MB</p>
          </div>
        </div>
      )}
    </div>
  );
}
