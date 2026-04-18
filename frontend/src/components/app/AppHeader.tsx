import { useState } from 'react';
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
    <header className="sticky top-0 z-10 border-b border-[color:var(--color-kinetic-line)] bg-[rgba(5,5,5,0.92)] backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[color:var(--color-kinetic-line-strong)] font-mono text-sm uppercase tracking-[0.28em] text-[color:var(--color-kinetic-accent)]">
              CA
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="hud-label">KINETIC Alignment Console</p>
                <span className="kinetic-register">[REG-01]</span>
              </div>
              <h1 className="display-title truncate text-3xl text-[color:var(--color-kinetic-copy)] sm:text-[2.2rem]">
                <span className="kinetic-stroke">CSV</span> ALIGN
              </h1>
              <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-kinetic-muted)]">
                Local intake, deliberate pairing, drift review
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="kinetic-utility-cluster">
              <div className="border border-[color:var(--color-kinetic-line)] px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-kinetic-muted)]">
                <div>Theme locked</div>
                <div className="mt-1 text-[color:var(--color-kinetic-accent)]">Dark / Kinetic</div>
              </div>

              <button
                onClick={() => void handleOpenNewWindow()}
                className="btn btn-ghost"
                type="button"
                title="Open CSV Align in a new window"
              >
                <span aria-hidden="true">//</span>
                New window
              </button>

              <button onClick={onReset} className="btn btn-ghost" type="button">
                <span aria-hidden="true">++</span>
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
