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
  const stepClasses = 'flex min-w-[11rem] items-center px-2 py-1 text-left transition-colors';

  return (
    <nav className="mb-8" aria-label="Progress">
      <ol className="card mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 px-4 py-4 sm:px-5">
        {STEPS.map((currentStep, index) => {
          const isActive = step === currentStep.id;
          const isComplete = index < activeIndex;
          const isUnlocked = unlockedSteps.includes(currentStep.id);
          const canNavigate = isUnlocked && !isActive;

          const badgeClasses = `flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
            isActive
              ? 'app-surface-accent'
              : isComplete
                ? 'app-surface-success'
                : isUnlocked
                  ? 'border-app-border app-surface-subtle text-app-text'
                  : 'border-app-border bg-transparent text-app-muted'
          }`;

          const textClasses = isActive
            ? 'text-app-text'
            : isUnlocked
              ? 'text-app-muted'
              : 'text-[rgba(149,162,179,0.55)]';

          const commonContent = (
            <>
              <span className={badgeClasses}>{currentStep.number}</span>
              <span className="ml-3 text-left">
                <span className="hud-label block">Step {currentStep.number}</span>
                <span className="block text-sm font-medium uppercase tracking-[0.14em]">{currentStep.label}</span>
              </span>
            </>
          );

          return (
            <li key={currentStep.id} className="flex shrink-0 items-center">
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
              {index < STEPS.length - 1 && (
                <span
                  className="mx-3 h-px w-8 bg-app-border sm:mx-4 sm:w-12"
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
