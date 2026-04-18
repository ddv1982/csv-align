export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center border border-[color:var(--color-kinetic-line-strong)] font-mono text-sm uppercase tracking-[0.22em] text-[color:var(--color-kinetic-accent)]">
        SYNC
      </div>
    </div>
  );
}
