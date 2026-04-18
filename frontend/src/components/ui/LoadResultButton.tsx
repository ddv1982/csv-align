import { useCallback, useId } from 'react';
import { isTauri } from '../../services/tauri';
import { ArrowDownTrayIcon } from '../icons';

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
      <ArrowDownTrayIcon className="h-4 w-4" style={{ transform: 'rotate(180deg)' }} />
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
