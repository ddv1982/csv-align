import { AppHeader } from './components/app/AppHeader';
import { ConfigurationStep } from './components/app/ConfigurationStep';
import { ErrorBanner } from './components/app/ErrorBanner';
import { FileSelectionStep } from './components/app/FileSelectionStep';
import { LoadingState } from './components/app/LoadingState';
import { ProgressSteps } from './components/app/ProgressSteps';
import { ResultsStep } from './components/app/ResultsStep';
import { useComparisonWorkflow } from './hooks/useComparisonWorkflow';
import { useThemePreference } from './hooks/useThemePreference';

function App() {
  const { theme, toggleTheme } = useThemePreference();
  const {
    state,
    step,
    mappingSelection,
    normalizationConfig,
    filteredResults,
    setMappingSelection,
    setNormalizationConfig,
    handleFileSelection,
    handleCompare,
    handleExport,
    handleFilterChange,
    handleReset,
    handleBackToConfigure,
    handleBackToSelection,
    handleContinueToConfigure,
  } = useComparisonWorkflow();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 transition-colors dark:from-gray-950 dark:to-gray-900 dark:text-gray-100">
      <AppHeader theme={theme} onThemeToggle={toggleTheme} onReset={handleReset} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ProgressSteps step={step} />

        {state.error && <ErrorBanner error={state.error} />}
        {state.loading && <LoadingState />}

        {!state.loading && step === 'select' && (
          <FileSelectionStep
            fileA={state.fileA}
            fileB={state.fileB}
            onFileSelect={handleFileSelection}
            onContinue={handleContinueToConfigure}
          />
        )}

        {!state.loading && step === 'configure' && state.fileA && state.fileB && (
          <ConfigurationStep
            fileA={state.fileA}
            fileB={state.fileB}
            selection={mappingSelection}
            normalization={normalizationConfig}
            onSelectionChange={setMappingSelection}
            onNormalizationChange={setNormalizationConfig}
            onCompare={handleCompare}
            onBack={handleBackToSelection}
          />
        )}

        {!state.loading && step === 'results' && state.summary && (
          <ResultsStep
            summary={state.summary}
            fileAName={state.fileA?.name ?? 'File A'}
            fileBName={state.fileB?.name ?? 'File B'}
            filter={state.filter}
            results={state.results}
            filteredResults={filteredResults}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            onBack={handleBackToConfigure}
          />
        )}
      </div>

      <footer className="mt-auto py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>CSV Align - Compare CSV files with visual difference highlighting</p>
      </footer>
    </div>
  );
}

export default App;
