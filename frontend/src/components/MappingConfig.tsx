import { ColumnInfo, MappingResponse } from '../types/api';

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
  onSelectionChange: (selection: MappingSelectionState) => void;
  onCompare: (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingResponse[]
  ) => void;
}

export function MappingConfig({
  fileA,
  fileB,
  selection,
  onSelectionChange,
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
      manualMappings
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
