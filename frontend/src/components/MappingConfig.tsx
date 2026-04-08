import { useState } from 'react';
import { ColumnInfo, MappingResponse } from '../types/api';

interface MappingConfigProps {
  fileA: {
    headers: string[];
    columns: ColumnInfo[];
  };
  fileB: {
    headers: string[];
    columns: ColumnInfo[];
  };
  mappings: MappingResponse[];
  onMappingChange: (mappings: MappingResponse[]) => void;
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
  mappings,
  onMappingChange: _onMappingChange,
  onCompare,
}: MappingConfigProps) {
  const [keyColumnsA, setKeyColumnsA] = useState<string[]>([]);
  const [keyColumnsB, setKeyColumnsB] = useState<string[]>([]);
  const [comparisonColumnsA, setComparisonColumnsA] = useState<string[]>([]);
  const [comparisonColumnsB, setComparisonColumnsB] = useState<string[]>([]);

  // Get unmapped columns
  const mappedColumnsA = mappings.map(m => m.file_a_column);
  const mappedColumnsB = mappings.map(m => m.file_b_column);
  const unmappedA = fileA.headers.filter(h => !mappedColumnsA.includes(h));
  const unmappedB = fileB.headers.filter(h => !mappedColumnsB.includes(h));

  const handleKeyColumnToggle = (column: string, isFileA: boolean) => {
    if (isFileA) {
      setKeyColumnsA(prev =>
        prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
      );
    } else {
      setKeyColumnsB(prev =>
        prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
      );
    }
  };

  const handleComparisonColumnToggle = (column: string, isFileA: boolean) => {
    if (isFileA) {
      setComparisonColumnsA(prev =>
        prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
      );
    } else {
      setComparisonColumnsB(prev =>
        prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
      );
    }
  };

  const handleCompare = () => {
    const hasManualSelectionA = comparisonColumnsA.length > 0;
    const hasManualSelectionB = comparisonColumnsB.length > 0;
    const hasManualPairSelection =
      hasManualSelectionA &&
      hasManualSelectionB &&
      comparisonColumnsA.length === comparisonColumnsB.length;

    // Manual selections take priority when both sides are explicitly selected in matched counts.
    const finalComparisonA = hasManualPairSelection
      ? comparisonColumnsA
      : mappings.map(m => m.file_a_column);
    const finalComparisonB = hasManualPairSelection
      ? comparisonColumnsB
      : mappings.map(m => m.file_b_column);

    const finalMappings: MappingResponse[] = hasManualPairSelection
      ? comparisonColumnsA.map((fileAColumn, idx) => ({
          file_a_column: fileAColumn,
          file_b_column: comparisonColumnsB[idx],
          mapping_type: 'manual',
        }))
      : mappings;

    if (finalComparisonA.length === 0 || finalComparisonB.length === 0) {
      return;
    }

    onCompare(
      keyColumnsA.length > 0 ? keyColumnsA : [fileA.headers[0]],
      keyColumnsB.length > 0 ? keyColumnsB : [fileB.headers[0]],
      finalComparisonA,
      finalComparisonB,
      finalMappings
    );
  };

  const hasAutoMappings = mappings.length > 0;
  const hasManualSelections = comparisonColumnsA.length > 0 || comparisonColumnsB.length > 0;
  const hasManualPairSelection =
    comparisonColumnsA.length > 0 &&
    comparisonColumnsB.length > 0 &&
    comparisonColumnsA.length === comparisonColumnsB.length;
  const canRunComparison = hasAutoMappings || hasManualPairSelection;

  const getMappingBadge = (type: string) => {
    switch (type) {
      case 'exact':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-950/50',
          text: 'text-emerald-800 dark:text-emerald-200',
          label: 'Exact',
        };
      case 'fuzzy':
        return {
          bg: 'bg-amber-100 dark:bg-amber-950/50',
          text: 'text-amber-800 dark:text-amber-200',
          label: 'Fuzzy',
        };
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-950/50',
          text: 'text-blue-800 dark:text-blue-200',
          label: 'Manual',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Column Mappings */}
      <div className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Column Mappings
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Suggested Mappings */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Suggested Mappings</h4>
            {mappings.length > 0 ? (
              <div className="space-y-2">
                {mappings.map((mapping, idx) => {
                  const badge = getMappingBadge(mapping.mapping_type);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{mapping.file_a_column}</span>
                        <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{mapping.file_b_column}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                        {mapping.similarity && ` (${Math.round(mapping.similarity * 100)}%)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No automatic mappings found. Create manual mappings below.</p>
            )}
          </div>

          {/* Unmapped Columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unmapped - File A</h4>
              <div className="space-y-1">
                {unmappedA.map(col => (
                  <span key={col} className="block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/35 dark:text-blue-200">
                    {col}
                  </span>
                ))}
                {unmappedA.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">All columns mapped</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unmapped - File B</h4>
              <div className="space-y-1">
                {unmappedB.map(col => (
                  <span key={col} className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-200">
                    {col}
                  </span>
                ))}
                {unmappedB.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">All columns mapped</p>
                )}
              </div>
            </div>
          </div>
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
            {comparisonColumnsA.length === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to select (default: all mapped columns)</p>
            )}
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
            {comparisonColumnsB.length === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Click to select (default: all mapped columns)</p>
            )}
          </div>
        </div>
      </div>

      {/* Run Comparison Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={!canRunComparison}
          className={`btn btn-success flex items-center gap-2 px-8 py-3 text-lg ${
            !canRunComparison ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Run Comparison
        </button>
      </div>

      {!canRunComparison && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {hasManualSelections
            ? 'Select the same number of comparison columns in File A and File B to run a manual comparison.'
            : 'No automatic mappings found. Select matching comparison columns in both files to run manually.'}
        </p>
      )}
    </div>
  );
}
