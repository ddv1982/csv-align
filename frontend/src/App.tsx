import { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { MappingConfig } from './components/MappingConfig';
import { ResultsTable } from './components/ResultsTable';
import { SummaryStats } from './components/SummaryStats';
import { FilterBar } from './components/FilterBar';
import {
  createSession,
  uploadFile,
  compareFiles,
  exportResults,
  downloadBlob,
} from './services/tauri';
import {
  AppState,
  ComparisonNormalizationConfig,
  MappingResponse,
  ResultType,
} from './types/api';

const initialState: AppState = {
  sessionId: null,
  fileA: null,
  fileB: null,
  mappings: [],
  results: [],
  summary: null,
  filter: 'all',
  error: null,
  loading: false,
};

const THEME_STORAGE_KEY = 'csv-align-theme';

type MappingSelectionState = {
  keyColumnsA: string[];
  keyColumnsB: string[];
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
};

const initialMappingSelection: MappingSelectionState = {
  keyColumnsA: [],
  keyColumnsB: [],
  comparisonColumnsA: [],
  comparisonColumnsB: [],
};

const initialNormalizationConfig: ComparisonNormalizationConfig = {
  treat_empty_as_null: true,
  null_tokens: ['null'],
  null_token_case_insensitive: true,
  case_insensitive: false,
  trim_whitespace: false,
  date_normalization: {
    enabled: false,
    formats: ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%m-%d-%Y'],
  },
};

function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [step, setStep] = useState<'upload' | 'configure' | 'results'>('upload');
  const [mappingSelection, setMappingSelection] = useState<MappingSelectionState>(initialMappingSelection);
  const [normalizationConfig, setNormalizationConfig] = useState<ComparisonNormalizationConfig>(initialNormalizationConfig);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Create session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const response = await createSession();
        setState(prev => ({ ...prev, sessionId: response.session_id }));
      } catch (err) {
        setState(prev => ({ ...prev, error: (err as Error).message }));
      }
    }
    initSession();
  }, []);

  const handleFileUpload = useCallback(async (file: File, fileLetter: 'a' | 'b') => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await uploadFile(state.sessionId, file, fileLetter);

      const fileData = {
        name: file.name,
        headers: response.headers,
        columns: response.columns,
        rowCount: response.row_count,
      };

      setState(prev => ({
        ...prev,
        [fileLetter === 'a' ? 'fileA' : 'fileB']: fileData,
        loading: false,
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  // Move to configuration when both files are loaded.
  // Mapping choices are manual and user-driven.
  useEffect(() => {
    if (state.fileA && state.fileB) {
      setState(prev => ({ ...prev, mappings: [] }));
      setMappingSelection(initialMappingSelection);
      setNormalizationConfig(initialNormalizationConfig);
      setStep('configure');
    }
  }, [state.fileA, state.fileB]);

  const handleSelectionChange = useCallback((selection: MappingSelectionState) => {
    setMappingSelection(selection);
  }, []);

  const handleCompare = useCallback(async (
    keyColumnsA: string[],
    keyColumnsB: string[],
    comparisonColumnsA: string[],
    comparisonColumnsB: string[],
    columnMappings: MappingResponse[],
    normalization: ComparisonNormalizationConfig
  ) => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await compareFiles(state.sessionId, {
        key_columns_a: keyColumnsA,
        key_columns_b: keyColumnsB,
        comparison_columns_a: comparisonColumnsA,
        comparison_columns_b: comparisonColumnsB,
        column_mappings: columnMappings.map(m => ({
          file_a_column: m.file_a_column,
          file_b_column: m.file_b_column,
          mapping_type: m.mapping_type,
          similarity: m.similarity,
        })),
        normalization,
      });

      setState(prev => ({
        ...prev,
        mappings: columnMappings,
        results: response.results,
        summary: response.summary,
        loading: false,
      }));
      setStep('results');
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  const handleExport = useCallback(async () => {
    if (!state.sessionId) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const blob = await exportResults(state.sessionId);
      if (blob) {
        downloadBlob(blob, 'comparison-results.csv');
      }
      setState(prev => ({ ...prev, loading: false }));
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message, loading: false }));
    }
  }, [state.sessionId]);

  const handleFilterChange = useCallback((filter: ResultType) => {
    setState(prev => ({ ...prev, filter }));
  }, []);

  const handleReset = useCallback(async () => {
    setState(initialState);
    setMappingSelection(initialMappingSelection);
    setNormalizationConfig(initialNormalizationConfig);
    setStep('upload');
    
    // Create new session
    try {
      const response = await createSession();
      setState(prev => ({ ...prev, sessionId: response.session_id }));
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message }));
    }
  }, []);

  const handleThemeToggle = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleBackToConfigure = useCallback(() => {
    setStep('configure');
  }, []);

  const filteredResults = state.filter === 'all'
    ? state.results
    : state.results.filter(r => {
        if (state.filter === 'match') return r.result_type === 'match';
        if (state.filter === 'mismatch') return r.result_type === 'mismatch';
        if (state.filter === 'missing_left') return r.result_type === 'missing_left';
        if (state.filter === 'missing_right') return r.result_type === 'missing_right';
        if (state.filter === 'duplicate') return r.result_type.startsWith('duplicate');
        return true;
      });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 transition-colors dark:from-gray-950 dark:to-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CSV Align</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compare CSV files with ease</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleThemeToggle}
                className="btn btn-secondary flex items-center gap-2"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Light
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="btn btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex items-center justify-center mb-8">
          <ol className="flex items-center">
            <li className={`flex items-center ${step === 'upload' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
              <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step === 'upload' ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
                1
              </span>
              <span className="ml-2 text-sm font-medium">Select Files</span>
            </li>
            <svg className="w-12 h-5 mx-4 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <li className={`flex items-center ${step === 'configure' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
              <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step === 'configure' ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
                2
              </span>
              <span className="ml-2 text-sm font-medium">Configure</span>
            </li>
            <svg className="w-12 h-5 mx-4 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <li className={`flex items-center ${step === 'results' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
              <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step === 'results' ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
                3
              </span>
              <span className="ml-2 text-sm font-medium">Results</span>
            </li>
          </ol>
        </nav>

        {/* Error Display */}
        {state.error && (
          <div className="mb-6 animate-fade-in rounded-lg border border-danger bg-danger-light p-4 dark:border-red-400/40 dark:bg-red-950/50">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-danger mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-danger-dark dark:text-red-200">{state.error}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {state.loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Step Content */}
        {!state.loading && step === 'upload' && (
          <div className="animate-fade-in">
            <div className="grid md:grid-cols-2 gap-6">
              <FileUpload
                label="File A"
                file={state.fileA}
                onUpload={(file) => handleFileUpload(file, 'a')}
              />
              <FileUpload
                label="File B"
                file={state.fileB}
                onUpload={(file) => handleFileUpload(file, 'b')}
              />
            </div>
          </div>
        )}

        {!state.loading && step === 'configure' && state.fileA && state.fileB && (
          <div className="animate-fade-in">
            <MappingConfig
              fileA={state.fileA}
              fileB={state.fileB}
              selection={mappingSelection}
              normalization={normalizationConfig}
              onSelectionChange={handleSelectionChange}
              onNormalizationChange={setNormalizationConfig}
              onCompare={handleCompare}
            />
          </div>
        )}

        {!state.loading && step === 'results' && state.summary && (
            <div className="animate-fade-in space-y-6">
            <SummaryStats
              summary={state.summary}
              fileAName={state.fileA?.name ?? 'File A'}
              fileBName={state.fileB?.name ?? 'File B'}
            />

            <div className="flex justify-end">
              <button
                onClick={handleBackToConfigure}
                className="btn btn-secondary flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to configuration
              </button>
            </div>
            
            <FilterBar
              filter={state.filter}
              results={state.results}
              onFilterChange={handleFilterChange}
              onExport={handleExport}
            />
            
            <ResultsTable
              results={filteredResults}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>CSV Align - Compare CSV files with visual difference highlighting</p>
      </footer>
    </div>
  );
}

export default App;
