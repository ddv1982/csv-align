import { AppHeader } from './components/app/AppHeader';
import { ConfigurationStep } from './components/app/ConfigurationStep';
import { ErrorBanner } from './components/app/ErrorBanner';
import { FileSelectionStep } from './components/app/FileSelectionStep';
import { LoadingState } from './components/app/LoadingState';
import { ProgressSteps } from './components/app/ProgressSteps';
import { ResultsStep } from './components/app/ResultsStep';
import { filterKeyPairsFromComparisonSelection } from './hooks/useComparisonWorkflow.reducer';
import { useComparisonWorkflow } from './hooks/useComparisonWorkflow';

function App() {
  const {
    state,
    step,
    mappingSelection,
    normalizationConfig,
    filteredResults,
    isSnapshotReadOnly,
    unlockedSteps,
    setMappingSelection,
    setNormalizationConfig,
    handleFileSelection,
    handleCompare,
    handleExportCsv,
    handleExportHtml,
    handleSaveComparisonSnapshot,
    handleLoadComparisonSnapshot,
    handleSavePairOrder,
    handleLoadPairOrder,
    handleAutoPairComparisonColumns,
    handleFilterChange,
    handleReset,
    handleStepNavigation,
    handleBackToConfigure,
    handleBackToSelection,
    handleContinueToConfigure,
  } = useComparisonWorkflow();

  const filteredComparisonSelection = filterKeyPairsFromComparisonSelection(
    mappingSelection.keyColumnsA,
    mappingSelection.keyColumnsB,
    mappingSelection.comparisonColumnsA,
    mappingSelection.comparisonColumnsB,
  );

  return (
    <div className="kinetic-shell flex min-h-screen flex-col bg-[color:var(--color-kinetic-bg)] text-[color:var(--color-kinetic-copy)]">
      <AppHeader onReset={handleReset} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <ProgressSteps step={step} unlockedSteps={unlockedSteps} onStepChange={handleStepNavigation} />

        {state.error && <ErrorBanner error={state.error} />}
        {state.loading && <LoadingState />}

        {!state.loading && step === 'select' && (
          <FileSelectionStep
            fileA={state.fileA}
            fileB={state.fileB}
            onFileSelect={handleFileSelection}
            onLoadResult={handleLoadComparisonSnapshot}
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
            onSavePairOrder={handleSavePairOrder}
            onLoadPairOrder={handleLoadPairOrder}
            onAutoPairComparisonColumns={handleAutoPairComparisonColumns}
            onBack={handleBackToSelection}
          />
        )}

        {!state.loading && step === 'results' && state.summary && (
          <ResultsStep
            summary={state.summary}
            fileAName={state.fileA?.name ?? 'File A'}
            fileBName={state.fileB?.name ?? 'File B'}
            comparisonColumnsA={filteredComparisonSelection.comparisonColumnsA}
            comparisonColumnsB={filteredComparisonSelection.comparisonColumnsB}
            mappings={state.mappings}
            filter={state.filter}
            results={state.results}
            filteredResults={filteredResults}
            snapshotReadOnly={isSnapshotReadOnly}
            onFilterChange={handleFilterChange}
            onExportCsv={handleExportCsv}
            onExportHtml={handleExportHtml}
            onSaveResult={handleSaveComparisonSnapshot}
            onBack={handleBackToConfigure}
            onStartNewComparison={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
