import { useCallback, useId } from 'react';
import { isTauri } from '../../services/tauri';

interface LoadResultButtonProps {
  onLoadResult: (file?: File) => void;
}

export function LoadResultButton({ onLoadResult }: LoadResultButtonProps) {
  const inputId = useId();
  const handleLoadResultChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onLoadResult(selectedFile);
    }
    event.target.value = '';
  }, [onLoadResult]);

  const content = (
    <>
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-6l-4-4m0 0L8 10m4-4v12" />
      </svg>
      Load result
    </>
  );

  if (isTauri) {
    return (
      <button type="button" onClick={() => onLoadResult()} className="mt-3 inline-flex items-center gap-2 btn btn-secondary">
        {content}
      </button>
    );
  }

  return (
    <>
      <label htmlFor={inputId} className="mt-3 inline-flex cursor-pointer items-center gap-2 btn btn-secondary">
        {content}
      </label>
      <input
        id={inputId}
        data-testid="load-result-input"
        type="file"
        accept=".json,application/json"
        onChange={handleLoadResultChange}
        className="hidden"
      />
    </>
  );
}
