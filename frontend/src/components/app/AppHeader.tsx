import { useState } from 'react';
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
    <header className="sticky top-0 z-10 border-b border-[color:var(--color-kinetic-line)] bg-[color:var(--color-kinetic-header)] backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="display-title truncate text-3xl text-[color:var(--color-kinetic-copy)] sm:text-[2.2rem]">
                <span className="kinetic-stroke">CSV</span> ALIGN
              </h1>
              <p className="mt-1 truncate text-sm text-[color:var(--color-kinetic-muted)]">
                Compare two local CSV files, tune cleanup, and review row-level drift.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="kinetic-utility-cluster">
              <button
                onClick={() => void handleOpenNewWindow()}
                className="btn btn-ghost"
                type="button"
                title="Open CSV Align in a new window"
              >
                <ArrowRightIcon className="h-4 w-4" />
                New window
              </button>

              <button onClick={onReset} className="btn btn-ghost" type="button">
                Reset
              </button>
            </div>
          </div>
        </div>

        {openWindowError && (
          <p className="mt-3 border border-[rgba(255,122,122,0.45)] bg-[rgba(255,122,122,0.08)] px-3 py-2 text-sm text-[color:var(--color-kinetic-danger)]" role="alert">
            {openWindowError}
          </p>
        )}
      </div>
    </header>
  );
}
