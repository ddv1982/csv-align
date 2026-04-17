import type { AppStep } from '../../types/ui';

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: 'select', label: 'Choose Local Files', number: 1 },
  { id: 'configure', label: 'Configure', number: 2 },
  { id: 'results', label: 'Results', number: 3 },
];

interface ProgressStepsProps {
  step: AppStep;
  unlockedSteps: AppStep[];
  onStepChange: (step: AppStep) => void;
}

export function ProgressSteps({ step, unlockedSteps, onStepChange }: ProgressStepsProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <nav className="mb-8 flex items-center justify-center" aria-label="Progress">
      <ol className="flex flex-wrap items-center justify-center gap-y-3">
        {STEPS.map((currentStep, index) => {
          const isActive = step === currentStep.id;
          const isComplete = index < activeIndex;
          const isUnlocked = unlockedSteps.includes(currentStep.id);
          const canNavigate = isUnlocked && !isActive;

          const badgeClasses = `flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
            isActive
              ? 'border-primary-600 bg-primary-600 text-white'
              : isComplete
                ? 'border-primary-600/30 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-300'
                : isUnlocked
                  ? 'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  : 'border-gray-300 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500'
          }`;

          const textClasses = isActive
            ? 'text-gray-900 dark:text-gray-50'
            : isUnlocked
              ? 'text-gray-600 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-500';

          const commonContent = (
            <>
              <span className={badgeClasses}>{currentStep.number}</span>
              <span className="ml-2 text-sm font-medium">{currentStep.label}</span>
            </>
          );

          return (
            <li key={currentStep.id} className="flex items-center">
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => onStepChange(currentStep.id)}
                  aria-label={`Go to step ${currentStep.number}: ${currentStep.label}`}
                  aria-current={isActive ? 'step' : undefined}
                  className={`group flex items-center rounded-full px-1.5 py-1 -mx-1.5 -my-1 transition-colors hover:bg-gray-100/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:hover:bg-gray-800/60 dark:focus-visible:ring-offset-gray-950 ${textClasses}`}
                >
                  {commonContent}
                </button>
              ) : (
                <div
                  className={`flex items-center ${textClasses}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-disabled={!isUnlocked ? 'true' : undefined}
                >
                  {commonContent}
                </div>
              )}
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
