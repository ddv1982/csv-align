import { useState } from 'react';
import appLogo from '../../assets/icon.svg';
import { openNewAppWindow } from '../../services/tauri';
import { ArrowPathIcon, MoonIcon, SunIcon } from '../icons';

interface AppHeaderProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onReset: () => void;
}

export function AppHeader({ theme, onThemeToggle, onReset }: AppHeaderProps) {
  const [openWindowError, setOpenWindowError] = useState<string | null>(null);

  async function handleOpenNewWindow() {
    try {
      setOpenWindowError(null);
      await openNewAppWindow();
    } catch {
      setOpenWindowError('Unable to open a new window right now.');
    }
  }

  const nextThemeLabel = theme === 'dark' ? 'light mode' : 'dark mode';

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/5 dark:ring-white/10">
              <img src={appLogo} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                CSV Align
              </h1>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Compare CSV files with ease
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 border-r border-gray-200/80 pr-3 dark:border-gray-800">
            <button
              onClick={() => void handleOpenNewWindow()}
              className="btn btn-secondary"
              type="button"
              title="Open CSV Align in a new window"
            >
              <ArrowPathIcon
                className="h-4 w-4"
                style={{ transform: 'rotate(-45deg)' }}
              />
              New window
            </button>

            <button onClick={onReset} className="btn btn-secondary" type="button">
              <ArrowPathIcon className="h-4 w-4" />
              Reset
            </button>
          </div>

          <button
            onClick={onThemeToggle}
            className="btn btn-secondary inline-flex h-10 w-10 shrink-0 items-center justify-center p-0"
            type="button"
            aria-label={`Switch to ${nextThemeLabel}`}
            title={`Switch to ${nextThemeLabel}`}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </button>
        </div>

        {openWindowError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {openWindowError}
          </p>
        )}
      </div>
    </header>
  );
}
