export function NoticeBanner({ notice }: { notice: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in mb-6 border border-app-border bg-app-surface p-4"
    >
      <div className="flex items-center">
        <span aria-hidden="true" className="mr-2 border border-app-border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">OK</span>
        <span className="text-app-muted">{notice}</span>
      </div>
    </div>
  );
}
