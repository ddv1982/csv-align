import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface NavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  direction: 'back' | 'forward';
  children: ReactNode;
}

export function NavButton({ direction, children, className, type = 'button', ...buttonProps }: NavButtonProps) {
  const glyph = direction === 'back' ? '<<' : '>>';

  return (
    <button
      type={type}
      className={`btn btn-ghost flex items-center gap-2 ${className ?? ''}`.trim()}
      {...buttonProps}
    >
      {direction === 'back' ? <span aria-hidden="true">{glyph}</span> : null}
      {children}
      {direction === 'forward' ? <span aria-hidden="true">{glyph}</span> : null}
    </button>
  );
}
