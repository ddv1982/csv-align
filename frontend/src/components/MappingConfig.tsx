import { ColumnInfo, ComparisonNormalizationConfig, MappingResponse } from '../types/api';

type MappingSelectionState = {
  keyColumnsA: string[];
  keyColumnsB: string[];
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
};

interface MappingConfigProps {
  fileA: {
    headers: string[];
    columns: ColumnInfo[];
  };
  fileB: {
    headers: string[];
    columns: ColumnInfo[];
  };
  selection: MappingSelectionState;
  normalization: ComparisonNormalizationConfig;
  onSelectionChange: (selection: MappingSelectionState) => void;
  onNormalizationChange: (normalization: ComparisonNormalizationConfig) => void;
  onCompare: (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingResponse[],
    normalization: ComparisonNormalizationConfig
  ) => void;
}

export function MappingConfig({
  fileA,
  fileB,
  selection,
  normalization,
  onSelectionChange,
  onNormalizationChange,
  onCompare,
}: MappingConfigProps) {
  const {
    keyColumnsA,
    keyColumnsB,
    comparisonColumnsA,
    comparisonColumnsB,
  } = selection;

  const updateSelection = (updates: Partial<MappingSelectionState>) => {
    onSelectionChange({ ...selection, ...updates });
  };

  const updateNormalization = (updates: Partial<ComparisonNormalizationConfig>) => {
    onNormalizationChange({ ...normalization, ...updates });
  };

  const updateDateNormalization = (updates: Partial<ComparisonNormalizationConfig['date_normalization']>) => {
    onNormalizationChange({
      ...normalization,
      date_normalization: {
        ...normalization.date_normalization,
        ...updates,
      },
    });
  };

  const handleKeyColumnToggle = (column: string, isFileA: boolean) => {
    if (isFileA) {
      const next = keyColumnsA.includes(column)
        ? keyColumnsA.filter(c => c !== column)
        : [...keyColumnsA, column];
      updateSelection({ keyColumnsA: next });
    } else {
      const next = keyColumnsB.includes(column)
        ? keyColumnsB.filter(c => c !== column)
        : [...keyColumnsB, column];
      updateSelection({ keyColumnsB: next });
    }
  };

  const handleComparisonColumnToggle = (column: string, isFileA: boolean) => {
    if (isFileA) {
      const next = comparisonColumnsA.includes(column)
        ? comparisonColumnsA.filter(c => c !== column)
        : [...comparisonColumnsA, column];
      updateSelection({ comparisonColumnsA: next });
    } else {
      const next = comparisonColumnsB.includes(column)
        ? comparisonColumnsB.filter(c => c !== column)
        : [...comparisonColumnsB, column];
      updateSelection({ comparisonColumnsB: next });
    }
  };

  const hasManualPairSelection =
    comparisonColumnsA.length > 0 &&
    comparisonColumnsB.length > 0 &&
    comparisonColumnsA.length === comparisonColumnsB.length;

  const manualMappings: MappingResponse[] = comparisonColumnsA.map((fileAColumn, idx) => ({
    file_a_column: fileAColumn,
    file_b_column: comparisonColumnsB[idx] ?? '',
    mapping_type: 'manual',
  }));

  const handleCompare = () => {
    if (!hasManualPairSelection) {
      return;
    }

    onCompare(
      keyColumnsA.length > 0 ? keyColumnsA : [fileA.headers[0]],
      keyColumnsB.length > 0 ? keyColumnsB : [fileB.headers[0]],
      comparisonColumnsA,
      comparisonColumnsB,
      manualMappings,
      normalization
    );
  };

  const pairPreview = comparisonColumnsA
    .slice(0, comparisonColumnsB.length)
    .map((colA, idx) => ({ colA, colB: comparisonColumnsB[idx] }));

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Manual column pairing</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select comparison columns in File A and File B in the order you want to pair them. No automatic suggestions are applied.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cleanup before compare</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose a few optional cleanup rules to avoid false mismatches.
        </p>

        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={normalization.treat_empty_as_null}
            onChange={(e) => updateNormalization({ treat_empty_as_null: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Treat blank cells as missing
        </label>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Also treat these exact values as missing
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter literal values like `null`, `n/a`, or `unknown`, separated by commas.
          </p>
          <input
            type="text"
            value={normalization.null_tokens.join(', ')}
            onChange={(e) => {
              const tokens = e.target.value
                .split(',')
                .map((token) => token.trim())
                .filter((token) => token.length > 0);
              updateNormalization({ null_tokens: tokens });
            }}
            placeholder="null"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.null_token_case_insensitive}
              onChange={(e) => updateNormalization({ null_token_case_insensitive: e.target.checked })}
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
              onChange={(e) => updateNormalization({ case_insensitive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Ignore uppercase/lowercase
          </label>

          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={normalization.trim_whitespace}
              onChange={(e) => updateNormalization({ trim_whitespace: e.target.checked })}
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
              onChange={(e) => updateDateNormalization({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Match dates across different formats
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Off by default. Turn this on only if your files store the same dates in different formats.
          </p>

          <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 marker:hidden dark:text-gray-300">
              <span aria-hidden="true" className="mr-2 text-gray-400 dark:text-gray-500">▸</span>
              Advanced date patterns
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Only change these if the default patterns miss dates in your files. Enter one format per line.
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date formats to try
              </label>
              <textarea
                rows={5}
                value={normalization.date_normalization.formats.join('\n')}
                onChange={(e) => {
                  const formats = e.target.value
                    .split('\n')
                    .map((format) => format.trim())
                    .filter((format) => format.length > 0);
                  updateDateNormalization({ formats });
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </details>
        </div>
      </div>

      {/* Key Columns Selection */}
      <div className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Key Columns (for row matching)
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">File A Key Columns</h4>
            <div className="flex flex-wrap gap-2">
              {fileA.headers.map(col => (
                <button
                  key={col}
                  onClick={() => handleKeyColumnToggle(col, true)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    keyColumnsA.includes(col)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                   }`}
                >
                  {col}
                </button>
              ))}
            </div>
            {keyColumnsA.length === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to select key columns (default: first column)</p>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">File B Key Columns</h4>
            <div className="flex flex-wrap gap-2">
              {fileB.headers.map(col => (
                <button
                  key={col}
                  onClick={() => handleKeyColumnToggle(col, false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    keyColumnsB.includes(col)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                   }`}
                >
                  {col}
                </button>
              ))}
            </div>
            {keyColumnsB.length === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to select key columns (default: first column)</p>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Columns Selection */}
      <div className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Comparison Columns
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">File A Columns</h4>
            <div className="flex flex-wrap gap-2">
              {fileA.headers.map(col => (
                <button
                  key={col}
                  onClick={() => handleComparisonColumnToggle(col, true)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    comparisonColumnsA.includes(col)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                   }`}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">File B Columns</h4>
            <div className="flex flex-wrap gap-2">
              {fileB.headers.map(col => (
                <button
                  key={col}
                  onClick={() => handleComparisonColumnToggle(col, false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    comparisonColumnsB.includes(col)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                   }`}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Current pair order</h4>
          {pairPreview.length > 0 ? (
            <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {pairPreview.map((pair, idx) => (
                <div key={`${pair.colA}-${pair.colB}-${idx}`} className="flex items-center gap-2">
                  <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">{idx + 1}</span>
                  <span className="truncate" title={pair.colA}>{pair.colA}</span>
                  <span aria-hidden="true">→</span>
                  <span className="truncate" title={pair.colB}>{pair.colB}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No pairs selected yet.</p>
          )}
          {comparisonColumnsA.length !== comparisonColumnsB.length && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              Select the same number of comparison columns in both files to run comparison.
            </p>
          )}
        </div>
      </div>

      {/* Run Comparison Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={!hasManualPairSelection}
          className={`btn btn-success flex items-center gap-2 px-8 py-3 text-lg ${
            !hasManualPairSelection ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Run Comparison
        </button>
      </div>
    </div>
  );
}
