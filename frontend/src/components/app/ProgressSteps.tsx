import type { AppStep } from '../../types/ui';

const STEPS: { id: AppStep; label: string; number: number }[] = [
  { id: 'select', label: 'Choose Local Files', number: 1 },
  { id: 'configure', label: 'Configure', number: 2 },
  { id: 'results', label: 'Results', number: 3 },
];

export function ProgressSteps({ step }: { step: AppStep }) {
  return (
    <nav className="mb-8 flex items-center justify-center">
      <ol className="flex flex-wrap items-center justify-center gap-y-3">
        {STEPS.map((currentStep, index) => (
          <li key={currentStep.id} className="flex items-center">
            <div className={`flex items-center ${step === currentStep.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step === currentStep.id ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800'}`}>
                {currentStep.number}
              </span>
              <span className="ml-2 text-sm font-medium">{currentStep.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <svg className="mx-3 h-5 w-10 text-gray-300 dark:text-gray-600 sm:mx-4 sm:w-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
