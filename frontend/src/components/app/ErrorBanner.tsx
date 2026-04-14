export function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="mb-6 animate-fade-in rounded-lg border border-danger bg-danger-light p-4 dark:border-red-400/40 dark:bg-red-950/50">
      <div className="flex items-center">
        <svg className="mr-2 h-5 w-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-danger-dark dark:text-red-200">{error}</span>
      </div>
    </div>
  );
}
