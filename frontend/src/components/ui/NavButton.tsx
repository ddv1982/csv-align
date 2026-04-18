import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

interface NavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  direction: 'back' | 'forward';
  children: ReactNode;
}

export function NavButton({ direction, children, className, type = 'button', ...buttonProps }: NavButtonProps) {
  const icon = (
    direction === 'back' ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />
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
