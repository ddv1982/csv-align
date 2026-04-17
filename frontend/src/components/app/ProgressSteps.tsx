import type { AppStep } from '../../types/ui';

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: 'select', label: 'Choose Local Files', number: 1 },
  { id: 'configure', label: 'Configure', number: 2 },
  { id: 'results', label: 'Results', number: 3 },
];

export function ProgressSteps({ step }: { step: AppStep }) {
  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <nav className="mb-8 flex items-center justify-center" aria-label="Progress">
      <ol className="flex flex-wrap items-center justify-center gap-y-3">
        {STEPS.map((currentStep, index) => {
          const isActive = step === currentStep.id;
          const isComplete = index < activeIndex;

          return (
            <li key={currentStep.id} className="flex items-center">
              <div
                className={`flex items-center ${
                  isActive
                    ? 'text-gray-900 dark:text-gray-50'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : isComplete
                        ? 'border-primary-600/30 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-300'
                        : 'border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                  }`}
                >
                  {currentStep.number}
                </span>
                <span className="ml-2 text-sm font-medium">{currentStep.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  className="mx-3 h-px w-8 bg-gray-300 sm:mx-4 sm:w-12 dark:bg-gray-700"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
