import { useState } from 'react';
import appLogo from '../../assets/icon.svg';
import { ArrowRightIcon } from '../icons';
import { openNewAppWindow } from '../../services/appWindows';

interface AppHeaderProps {
  onReset: () => void;
}

export function AppHeader({ onReset }: AppHeaderProps) {
  const [openWindowError, setOpenWindowError] = useState<string | null>(null);

  async function handleOpenNewWindow() {
    try {
      setOpenWindowError(null);
      await openNewAppWindow();
    } catch {
      setOpenWindowError('Unable to open a new window right now.');
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/10">
              <img src={appLogo} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-gray-50">
                CSV Align
              </h1>
              <p className="truncate text-xs text-gray-400">
                Compare CSV files with ease
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2 border-l border-gray-800 pl-3">
            <button
              onClick={() => void handleOpenNewWindow()}
              className="btn btn-secondary"
              type="button"
              title="Open CSV Align in a new window"
            >
              <ArrowRightIcon className="h-4 w-4 -rotate-45" />
              New window
            </button>

            <button onClick={onReset} className="btn btn-secondary" type="button">
              Reset
            </button>
          </div>
        </div>

        {openWindowError && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {openWindowError}
          </p>
        )}
      </div>
    </header>
  );
}
