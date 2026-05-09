import { useCallback, useId, useRef } from 'react';
import { DocumentArrowUpIcon } from '../icons';
import { isTauri } from '../../services/tauri';

interface LoadResultButtonProps {
  onLoadResult: (file?: File) => void;
}

export function LoadResultButton({ onLoadResult }: LoadResultButtonProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleLoadResultChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onLoadResult(selectedFile);
    }
    event.target.value = '';
  }, [onLoadResult]);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const content = (
    <>
      <DocumentArrowUpIcon className="h-4 w-4" />
      Open saved result
    </>
  );

  if (isTauri) {
    return (
      <button type="button" onClick={() => onLoadResult()} className="btn btn-secondary mt-3 inline-flex items-center gap-2">
        {content}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openFilePicker}
        className="btn btn-secondary mt-3 inline-flex items-center gap-2"
      >
        {content}
      </button>
      <input
        ref={inputRef}
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
