import type { AppStep } from '../../types/ui';

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: 'select', label: 'Choose Files', number: 1 },
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
  const stepClasses = 'workflow-step flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-2 rounded-lg px-1 py-2 text-center transition-colors sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left';

  return (
    <nav className="mb-6" aria-label="Progress">
      <ol className="workflow-progress mx-auto grid max-w-4xl grid-cols-3 gap-1 sm:gap-3">
        {STEPS.map((currentStep, index) => {
          const isActive = step === currentStep.id;
          const isComplete = index < activeIndex;
          const isUnlocked = unlockedSteps.includes(currentStep.id);
          const canNavigate = isUnlocked && !isActive;

          const badgeClasses = `workflow-step-number flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
            isActive
              ? 'app-surface-accent'
              : isComplete
                ? 'app-surface-success'
                : isUnlocked
                  ? 'border-app-border app-surface-subtle text-app-text'
                  : 'border-app-border bg-transparent text-app-muted'
          }`;

          const textClasses = isActive ? 'text-app-text' : 'text-app-muted';

          const commonContent = (
            <>
              <span className={badgeClasses}>{currentStep.number}</span>
              <span className="workflow-step-copy min-w-0">
                <span className="hidden text-xs font-medium text-app-muted sm:block">Step {currentStep.number}</span>
                <span className="workflow-step-label block whitespace-nowrap text-xs font-semibold tracking-tight sm:text-sm">{currentStep.label}</span>
              </span>
            </>
          );

          return (
            <li key={currentStep.id} className="min-w-0">
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => onStepChange(currentStep.id)}
                  aria-label={`Go to step ${currentStep.number}: ${currentStep.label}`}
                  aria-current={isActive ? 'step' : undefined}
                  className={`group app-surface-hover ${stepClasses} ${textClasses}`}
                >
                  {commonContent}
                </button>
              ) : (
                <div
                  className={`${stepClasses} ${textClasses}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-disabled={!isUnlocked ? 'true' : undefined}
                >
                  {commonContent}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
