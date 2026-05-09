export function ErrorBanner({ error }: { error: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="animate-fade-in mb-6 border border-[rgba(255,122,122,0.45)] bg-[rgba(255,122,122,0.08)] p-4"
    >
      <div className="flex items-center">
        <span aria-hidden="true" className="mr-2 border border-[rgba(255,122,122,0.45)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-app-danger">ER</span>
        <span className="text-app-danger">{error}</span>
      </div>
    </div>
  );
}
