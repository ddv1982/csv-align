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
    <nav className="mb-8" aria-label="Progress">
      <ol className="card flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        {STEPS.map((currentStep, index) => {
          const isActive = step === currentStep.id;
          const isComplete = index < activeIndex;
          const isUnlocked = unlockedSteps.includes(currentStep.id);
          const canNavigate = isUnlocked && !isActive;

          const badgeClasses = `flex h-8 min-w-8 items-center justify-center border font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
            isActive
              ? 'border-[color:var(--color-kinetic-accent)] bg-[rgba(110,231,255,0.12)] text-[color:var(--color-kinetic-accent)]'
              : isComplete
                ? 'border-[rgba(108,255,190,0.45)] bg-[rgba(108,255,190,0.08)] text-[color:var(--color-kinetic-success)]'
                : isUnlocked
                  ? 'border-[color:var(--color-kinetic-line)] bg-[rgba(255,255,255,0.03)] text-[color:var(--color-kinetic-copy)]'
                  : 'border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-muted)]'
          }`;

          const textClasses = isActive
            ? 'text-[color:var(--color-kinetic-copy)]'
            : isUnlocked
              ? 'text-[color:var(--color-kinetic-muted)]'
              : 'text-[rgba(149,162,179,0.55)]';

          const commonContent = (
            <>
              <span className={badgeClasses}>{currentStep.number}</span>
              <span className="ml-3">
                <span className="hud-label block">Stage {currentStep.number}</span>
                <span className="block text-sm font-medium uppercase tracking-[0.14em]">{currentStep.label}</span>
              </span>
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
                  className={`group flex items-center px-2 py-1 transition-colors hover:bg-[rgba(255,255,255,0.04)] ${textClasses}`}
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
                  className="mx-3 h-px w-8 bg-[color:var(--color-kinetic-line)] sm:mx-4 sm:w-12"
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
