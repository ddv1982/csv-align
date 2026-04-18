import type { ComparisonNormalizationConfig } from '../../types/api';
import { PencilSquareIcon } from '../icons';
import { SectionCard } from '../ui/SectionCard';

interface NormalizationPanelProps {
  normalization: ComparisonNormalizationConfig;
  onChange: (updates: Partial<ComparisonNormalizationConfig>) => void;
  onDateChange: (updates: Partial<ComparisonNormalizationConfig['date_normalization']>) => void;
}

export function NormalizationPanel({ normalization, onChange, onDateChange }: NormalizationPanelProps) {
  return (
    <SectionCard
      eyebrow="Cleanup"
      title="Cleanup before compare"
      description="Choose a few optional cleanup rules to avoid false mismatches."
      icon={<PencilSquareIcon className="h-5 w-5" />}
      className="p-6"
    >
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-[color:var(--color-kinetic-copy)]">
          <input
            type="checkbox"
            checked={normalization.treat_empty_as_null}
            onChange={(event) => onChange({ treat_empty_as_null: event.target.checked })}
            className="h-4 w-4 border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-accent)]"
          />
          Treat blank cells as missing
        </label>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[color:var(--color-kinetic-copy)]">Also treat these exact values as missing</label>
          <p className="text-sm text-[color:var(--color-kinetic-muted)]">Enter literal values like `null`, `n/a`, or `unknown`, separated by commas.</p>
          <input
            type="text"
            value={normalization.null_tokens.join(', ')}
            onChange={(event) => {
              const tokens = event.target.value
                .split(',')
                .map((token) => token.trim())
                .filter((token) => token.length > 0);

              onChange({ null_tokens: tokens });
            }}
            placeholder="null"
            className="input px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-3 text-sm text-[color:var(--color-kinetic-copy)]">
            <input
              type="checkbox"
              checked={normalization.null_token_case_insensitive}
              onChange={(event) => onChange({ null_token_case_insensitive: event.target.checked })}
              className="h-4 w-4 border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-accent)]"
            />
            Ignore uppercase/lowercase for those values
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-[color:var(--color-kinetic-copy)]">
            <input
              type="checkbox"
              checked={normalization.case_insensitive}
              onChange={(event) => onChange({ case_insensitive: event.target.checked })}
              className="h-4 w-4 border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-accent)]"
            />
            Ignore uppercase/lowercase
          </label>

          <label className="flex items-center gap-3 text-sm text-[color:var(--color-kinetic-copy)]">
            <input
              type="checkbox"
              checked={normalization.trim_whitespace}
              onChange={(event) => onChange({ trim_whitespace: event.target.checked })}
              className="h-4 w-4 border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-accent)]"
            />
            Ignore extra spaces at the start or end
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-[color:var(--color-kinetic-copy)]">
            <input
              type="checkbox"
              checked={normalization.date_normalization.enabled}
              onChange={(event) => onDateChange({ enabled: event.target.checked })}
              className="h-4 w-4 border-[color:var(--color-kinetic-line)] bg-transparent text-[color:var(--color-kinetic-accent)]"
            />
            Match dates across different formats
          </label>
          <p className="text-sm text-[color:var(--color-kinetic-muted)]">Off by default. Turn this on only if your files store the same dates in different formats.</p>

          <details className="group kinetic-panel px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--color-kinetic-copy)] marker:hidden">
              <span aria-hidden="true" className="mr-2 inline-block text-[color:var(--color-kinetic-muted)] transition-transform group-open:rotate-90">▸</span>
              Advanced date patterns
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-[color:var(--color-kinetic-muted)]">Only change these if the default patterns miss dates in your files. Enter one format per line.</p>
              <label className="block text-sm font-medium text-[color:var(--color-kinetic-copy)]">Date formats to try</label>
              <textarea
                rows={5}
                value={normalization.date_normalization.formats.join('\n')}
                onChange={(event) => {
                  const formats = event.target.value
                    .split('\n')
                    .map((format) => format.trim())
                    .filter((format) => format.length > 0);

                  onDateChange({ formats });
                }}
                className="input px-3 py-2 text-sm"
              />
            </div>
          </details>
        </div>
      </div>
    </SectionCard>
  );
}
