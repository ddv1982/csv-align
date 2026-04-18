import { ExclamationCircleIcon } from '../icons';

export function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="mb-6 animate-fade-in rounded-lg border border-danger bg-danger-light p-4 dark:border-red-400/40 dark:bg-red-950/50">
      <div className="flex items-center">
        <ExclamationCircleIcon className="mr-2 h-5 w-5 text-danger" />
        <span className="text-danger-dark dark:text-red-200">{error}</span>
      </div>
    </div>
  );
}
