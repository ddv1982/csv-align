import { useState } from 'react';
import appLogo from '../../../../src-tauri/icons/icon.svg';
import { openNewAppWindow } from '../../services/tauri';

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
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7a2 2 0 012-2h7m0 0v7m0-7L9 15m-4 4h10a2 2 0 002-2v-4m-9 6H7a2 2 0 01-2-2V7a2 2 0 012-2h4"
                />
              </svg>
              New window
            </button>

            <button onClick={onReset} className="btn btn-secondary" type="button">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset
            </button>
          </div>

          <button
            onClick={onThemeToggle}
            className="btn btn-secondary shrink-0 !p-2"
            type="button"
            aria-label={`Switch to ${nextThemeLabel}`}
            title={`Switch to ${nextThemeLabel}`}
          >
            {theme === 'dark' ? (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
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
