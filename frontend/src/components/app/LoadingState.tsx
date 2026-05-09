export function LoadingState() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center py-12">
      <span className="sr-only">Loading comparison data</span>
      <div aria-hidden="true" className="flex h-16 w-16 animate-pulse items-center justify-center border border-app-border-strong font-mono text-sm uppercase tracking-[0.22em] text-app-accent">
        SYNC
      </div>
    </div>
  );
}
