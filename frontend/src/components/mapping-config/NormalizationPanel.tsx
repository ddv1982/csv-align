import type { ComparisonNormalizationConfig } from '../../types/api';
import { Bars3Icon } from '../icons';

interface NormalizationPanelProps {
  normalization: ComparisonNormalizationConfig;
  onChange: (updates: Partial<ComparisonNormalizationConfig>) => void;
  onDateChange: (updates: Partial<ComparisonNormalizationConfig['date_normalization']>) => void;
}

export function NormalizationPanel({ normalization, onChange, onDateChange }: NormalizationPanelProps) {
  return (
    <section className="rounded-2xl border border-gray-200/90 bg-white/95 p-6 shadow-sm shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-none">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-white/40 dark:bg-primary-500/15 dark:text-primary-200 dark:ring-primary-500/30">
          <Bars3Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">Cleanup</p>
          <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">Cleanup before compare</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">Choose a few optional cleanup rules to avoid false mismatches.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={normalization.treat_empty_as_null}
            onChange={(event) => onChange({ treat_empty_as_null: event.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Treat blank cells as missing
        </label>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Also treat these exact values as missing</label>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter literal values like `null`, `n/a`, or `unknown`, separated by commas.</p>
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
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.null_token_case_insensitive}
              onChange={(event) => onChange({ null_token_case_insensitive: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Ignore uppercase/lowercase for those values
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.case_insensitive}
              onChange={(event) => onChange({ case_insensitive: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Ignore uppercase/lowercase
          </label>

          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.trim_whitespace}
              onChange={(event) => onChange({ trim_whitespace: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Ignore extra spaces at the start or end
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.date_normalization.enabled}
              onChange={(event) => onDateChange({ enabled: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Match dates across different formats
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">Off by default. Turn this on only if your files store the same dates in different formats.</p>

          <details className="group rounded-xl border border-gray-200/90 bg-gray-50/70 px-4 py-3 shadow-sm shadow-gray-200/50 dark:border-gray-700/80 dark:bg-gray-950/40 dark:shadow-none">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 marker:hidden dark:text-gray-200">
              <span aria-hidden="true" className="mr-2 inline-block text-gray-400 transition-transform group-open:rotate-90 dark:text-gray-500">▸</span>
              Advanced date patterns
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Only change these if the default patterns miss dates in your files. Enter one format per line.</p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date formats to try</label>
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
    </section>
  );
}
