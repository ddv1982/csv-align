import type { ReactNode } from 'react';

type SectionCardTone = 'primary' | 'info';
type SectionCardHeadingLevel = 'h2' | 'h3' | 'h4';

interface ToneClasses {
  eyebrow: string;
  iconWrap: string;
  title: string;
  description: string;
}

const TONE_CLASSES: Record<SectionCardTone, ToneClasses> = {
  primary: {
    eyebrow: 'text-[color:var(--color-kinetic-accent)]',
    iconWrap: 'kinetic-tone-accent-strong',
    title: 'text-[color:var(--color-kinetic-copy)]',
    description: 'text-[color:var(--color-kinetic-muted)]',
  },
  info: {
    eyebrow: 'text-[color:var(--color-kinetic-accent-2)]',
    iconWrap: 'kinetic-tone-highlight-strong',
    title: 'text-[color:var(--color-kinetic-copy)]',
    description: 'text-[color:var(--color-kinetic-muted)]',
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
  children?: ReactNode;
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
  const hasBody = children !== null && children !== undefined && children !== false;

  return (
    <section
      className={`card p-5 ${className ?? ''}`.trim()}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-sm uppercase tracking-[0.18em] ${toneClasses.iconWrap}`}
          >
            {icon}
          </div>
          <div>
            <p className={`hud-label ${toneClasses.eyebrow}`}>{eyebrow}</p>
            <HeadingTag className={`mt-1 text-sm font-semibold uppercase tracking-[0.14em] ${toneClasses.title}`}>{title}</HeadingTag>
            {description && <p className={`mt-1 text-sm leading-6 ${toneClasses.description}`}>{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {hasBody && <div className="mt-5">{children}</div>}
    </section>
  );
}
