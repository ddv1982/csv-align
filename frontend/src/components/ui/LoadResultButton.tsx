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
      <span aria-hidden="true">[[</span>
      Open saved result
    </>
  );

  if (isTauri) {
    return (
      <button type="button" onClick={() => onLoadResult()} className="btn btn-ghost mt-3 inline-flex items-center gap-2">
        {content}
      </button>
    );
  }

    return (
      <>
       <label htmlFor={inputId} className="btn btn-ghost mt-3 inline-flex cursor-pointer items-center gap-2">
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
