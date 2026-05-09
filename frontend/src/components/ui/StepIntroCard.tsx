import type { ReactNode } from 'react';

interface StepIntroCardProps {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  copyClassName?: string;
  actionClassName?: string;
}

export function StepIntroCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  copyClassName,
  actionClassName,
}: StepIntroCardProps) {
  return (
    <div className={`card step-intro-card overflow-hidden p-0 ${className ?? ''}`.trim()}>
      <div
        className={`flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between ${headerClassName ?? ''}`.trim()}
      >
        <div className={`max-w-3xl ${copyClassName ?? ''}`.trim()}>
          <p className="hud-label text-app-accent">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-app-text sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
            {description}
          </p>
        </div>
        {action && <div className={actionClassName}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

interface StepActionPanelProps {
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  children?: ReactNode;
  className?: string;
}

export function StepActionPanel({
  title,
  description,
  icon,
  iconClassName,
  children,
  className,
}: StepActionPanelProps) {
  return (
    <div className={`saved-result-panel min-w-0 ${className ?? ''}`.trim()}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconClassName ?? ''}`.trim()}
            >
              {icon}
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold text-app-text">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-app-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
