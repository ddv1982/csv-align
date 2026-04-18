import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface NavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  direction: 'back' | 'forward';
  children: ReactNode;
}

const CHEVRON_PATHS = {
  back: 'M15 19l-7-7 7-7',
  forward: 'M9 5l7 7-7 7',
} as const;

export function NavButton({ direction, children, className, type = 'button', ...buttonProps }: NavButtonProps) {
  const icon = (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CHEVRON_PATHS[direction]} />
    </svg>
  );

  return (
    <button
      type={type}
      className={`btn btn-secondary flex items-center gap-2 ${className ?? ''}`.trim()}
      {...buttonProps}
    >
      {direction === 'back' ? icon : null}
      {children}
      {direction === 'forward' ? icon : null}
    </button>
  );
}
