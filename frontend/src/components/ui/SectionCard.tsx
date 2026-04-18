import type { ReactNode } from 'react';

type SectionCardTone = 'primary' | 'info';
type SectionCardHeadingLevel = 'h2' | 'h3' | 'h4';

interface ToneClasses {
  eyebrow: string;
  iconWrap: string;
}

const TONE_CLASSES: Record<SectionCardTone, ToneClasses> = {
  primary: {
    eyebrow: 'text-primary-600 dark:text-primary-300',
    iconWrap:
      'bg-primary-100 text-primary-700 ring-primary-200/80 shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30 dark:shadow-none',
  },
  info: {
    eyebrow: 'text-sky-700 dark:text-sky-200',
    iconWrap: 'bg-sky-100 text-sky-700 ring-sky-200/80 shadow-white/40',
  },
};

export interface SectionCardProps {
  /** Short uppercase context label shown above the title. */
  eyebrow: string;
  /** Main heading content for the card. */
  title: ReactNode;
  /** Optional supporting copy rendered below the title. */
  description?: ReactNode;
  /** Leading decorative icon shown beside the heading copy. */
  icon: ReactNode;
  /** Semantic heading level for the title. */
  headingLevel?: SectionCardHeadingLevel;
  /** Optional trailing action area aligned to the card header. */
  action?: ReactNode;
  /** Card body content. */
  children: ReactNode;
  /** Optional root class overrides for spacing or surface tweaks. */
  className?: string;
  /** Visual treatment for eyebrow and icon chip. */
  tone?: SectionCardTone;
}

export function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  headingLevel = 'h3',
  action,
  children,
  className,
  tone = 'primary',
}: SectionCardProps) {
  const HeadingTag = headingLevel;
  const toneClasses = TONE_CLASSES[tone];

  return (
    <section
      className={`rounded-2xl border border-gray-200/90 bg-white/95 p-5 shadow-sm shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-none ${className ?? ''}`.trim()}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm ${toneClasses.iconWrap}`}
          >
            {icon}
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${toneClasses.eyebrow}`}>{eyebrow}</p>
            <HeadingTag className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</HeadingTag>
            {description && <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
