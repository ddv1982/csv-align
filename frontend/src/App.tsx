import { AppHeader } from './components/app/AppHeader';
import { ConfigurationStep } from './components/app/ConfigurationStep';
import { ErrorBanner } from './components/app/ErrorBanner';
import { FileSelectionStep } from './components/app/FileSelectionStep';
import { LoadingState } from './components/app/LoadingState';
import { ProgressSteps } from './components/app/ProgressSteps';
import { ResultsStep } from './components/app/ResultsStep';
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
    handleExport,
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

  return (
    <div className="kinetic-shell flex min-h-screen flex-col bg-[color:var(--color-kinetic-bg)] text-[color:var(--color-kinetic-copy)]">
      <AppHeader onReset={handleReset} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <section className="card mb-6 overflow-hidden px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="hud-label">KINETIC Broadcast Alignment Console</p>
              <h2 className="display-title mt-2 text-5xl text-[color:var(--color-kinetic-copy)] sm:text-6xl">
                <span className="kinetic-stroke">CSV</span> ALIGN
              </h2>
              <p className="serif-accent mt-3 max-w-2xl text-base text-[color:var(--color-kinetic-muted)]">
                Stage local files, register comparison columns, and audit row drift through a dark broadcast-HUD workflow.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span className="kinetic-badge -rotate-3">Live Alignment Feed</span>
              <div className="flex flex-wrap items-center gap-3 text-right">
                <div>
                  <div className="hud-label">Engine</div>
                  <div className="font-mono text-sm uppercase tracking-[0.22em] text-[color:var(--color-kinetic-copy)]">Kinetic / Fixed Dark</div>
                </div>
                <div className="kinetic-register">[REG-01]</div>
              </div>
            </div>
          </div>
        </section>

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
            filter={state.filter}
            results={state.results}
            filteredResults={filteredResults}
            snapshotReadOnly={isSnapshotReadOnly}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            onSaveResult={handleSaveComparisonSnapshot}
            onBack={handleBackToConfigure}
            onStartNewComparison={handleReset}
          />
        )}
      </main>

      <footer className="status-strip mt-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Broadcast HUD active | Local files only | Web and Tauri transport preserved</p>
          <p className="kinetic-register">CSV Align / Registry Mark / v2 Interface Sweep</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
