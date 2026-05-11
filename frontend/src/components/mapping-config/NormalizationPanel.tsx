import type { ReactNode } from 'react';
import type { ComparisonNormalizationConfig } from '../../types/api';
import { PencilSquareIcon } from '../icons';
import { SectionCard } from '../ui/SectionCard';

const MAX_DECIMAL_ROUNDING_PLACES = 15;
const CHECKBOX_CLASS = 'h-4 w-4 border-app-border bg-transparent text-app-accent';

interface NormalizationPanelProps {
  normalization: ComparisonNormalizationConfig;
  onChange: (updates: Partial<ComparisonNormalizationConfig>) => void;
  onDateChange: (updates: Partial<ComparisonNormalizationConfig['date_normalization']>) => void;
  onDecimalRoundingChange: (updates: Partial<ComparisonNormalizationConfig['decimal_rounding']>) => void;
}

interface RuleGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function RuleGroup({ title, description, children }: RuleGroupProps) {
  return (
    <fieldset className="rounded-2xl border border-app-border/70 p-4">
      <legend className="px-1 text-sm font-semibold text-app-text">{title}</legend>
      {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </fieldset>
  );
}

interface CheckboxRuleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  helpText?: string;
}

function CheckboxRule({ checked, onChange, label, helpText }: CheckboxRuleProps) {
  return (
    <label className="flex items-start gap-3 text-sm text-app-text">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={`${CHECKBOX_CLASS} mt-0.5`}
      />
      <span>
        <span className="block">{label}</span>
        {helpText ? <span className="mt-1 block text-app-muted">{helpText}</span> : null}
      </span>
    </label>
  );
}

export function NormalizationPanel({
  normalization,
  onChange,
  onDateChange,
  onDecimalRoundingChange,
}: NormalizationPanelProps) {
  return (
    <SectionCard
      eyebrow="Rules"
      title="Comparison rules"
      description="Tune how row keys are matched and how formatted values are cleaned up before comparison."
      icon={<PencilSquareIcon className="h-5 w-5" />}
      className="p-6"
    >
      <div className="space-y-4">
        <RuleGroup
          title="Row-key matching"
          description="Exact key matching stays on unless you explicitly enable flexible matching."
        >
          <CheckboxRule
            checked={normalization.flexible_key_matching}
            onChange={(checked) => onChange({ flexible_key_matching: checked })}
            label="Enable flexible row-key matching"
            helpText="Turn this on when matching rows may use slightly different key text. Use ** as a wildcard for changing parts; CSV Align can also match keys that share one clear, distinctive word when there is only one possible match."
          />
        </RuleGroup>

        <RuleGroup title="Missing values">
          <CheckboxRule
            checked={normalization.treat_empty_as_null}
            onChange={(checked) => onChange({ treat_empty_as_null: checked })}
            label="Treat blank cells as missing"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-app-text">Also treat these values as missing</label>
            <p className="text-sm text-app-muted">Enter exact values such as `null`, `n/a`, or `unknown`, separated by commas.</p>
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
          </div>

          <CheckboxRule
            checked={normalization.null_token_case_insensitive}
            onChange={(checked) => onChange({ null_token_case_insensitive: checked })}
            label="Ignore letter case for those values"
          />
        </RuleGroup>

        <RuleGroup title="Text and numbers">
          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxRule
              checked={normalization.case_insensitive}
              onChange={(checked) => onChange({ case_insensitive: checked })}
              label="Ignore letter case"
            />

            <CheckboxRule
              checked={normalization.trim_whitespace}
              onChange={(checked) => onChange({ trim_whitespace: checked })}
              label="Ignore extra spaces at the start or end of a value"
            />

            <CheckboxRule
              checked={normalization.numeric_equivalence}
              onChange={(checked) => onChange({ numeric_equivalence: checked })}
              label="Match equivalent numbers with or without decimals"
            />
          </div>

          <div className="space-y-2">
            <CheckboxRule
              checked={normalization.decimal_rounding.enabled}
              onChange={(checked) => onDecimalRoundingChange({ enabled: checked })}
              label="Round numeric values to a chosen number of decimal places before comparing"
            />
            <p className="text-sm text-app-muted">
              Choose how many decimal places to keep. Use 0 for whole numbers. Rounded values will also appear in results and exports.
            </p>
            <label className="block text-sm font-medium text-app-text" htmlFor="decimal-rounding-places">
              Decimal places
            </label>
            <input
              id="decimal-rounding-places"
              type="number"
              min={0}
              max={MAX_DECIMAL_ROUNDING_PLACES}
              step={1}
              inputMode="numeric"
              value={normalization.decimal_rounding.decimals}
              disabled={!normalization.decimal_rounding.enabled}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                onDecimalRoundingChange({
                  decimals: Number.isNaN(parsed) || parsed < 0
                    ? 0
                    : Math.min(parsed, MAX_DECIMAL_ROUNDING_PLACES),
                });
              }}
              className="input max-w-32 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </RuleGroup>

        <RuleGroup title="Dates">
          <CheckboxRule
            checked={normalization.date_normalization.enabled}
            onChange={(checked) => onDateChange({ enabled: checked })}
            label="Match dates written in different formats"
          />
          <p className="text-sm text-app-muted">Leave this off unless the same dates appear in different formats across the two files.</p>

          <details className="group surface-panel px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-app-text marker:hidden">
              <span aria-hidden="true" className="mr-2 inline-block text-app-muted transition-transform group-open:rotate-90">▸</span>
              Advanced date patterns
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-app-muted">Only change these if the default patterns miss dates in your files. Enter one format per line.</p>
              <label className="block text-sm font-medium text-app-text">Date formats to try</label>
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
        </RuleGroup>
      </div>
    </SectionCard>
  );
}
