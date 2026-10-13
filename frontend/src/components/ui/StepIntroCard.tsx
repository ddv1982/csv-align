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
    <div className={`step-intro-card min-w-0 ${className ?? ''}`.trim()}>
      <div
        className={`step-intro-header flex flex-col gap-5 py-2 lg:flex-row lg:items-start lg:justify-between ${headerClassName ?? ''}`.trim()}
      >
        <div className={`min-w-0 max-w-3xl ${copyClassName ?? ''}`.trim()}>
          <p className="text-sm font-medium text-app-accent">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-app-text sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
            {description}
          </p>
        </div>
        {action && <div className={`step-intro-action min-w-0 ${actionClassName ?? ''}`.trim()}>{action}</div>}
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
    <div className={`step-action-panel min-w-0 ${className ?? ''}`.trim()}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className={`step-action-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName ?? ''}`.trim()}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-app-text">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-app-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
