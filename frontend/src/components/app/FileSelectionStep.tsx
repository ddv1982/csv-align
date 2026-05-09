import { FileSelector } from '../FileSelector';
import type { AppFile, SelectedFileSource } from '../../types/ui';
import { LoadResultButton } from '../ui/LoadResultButton';
import { NavButton } from '../ui/NavButton';
import { StepActionPanel, StepIntroCard } from '../ui/StepIntroCard';

interface FileSelectionStepProps {
  fileA: AppFile | null;
  fileB: AppFile | null;
  onFileSelect: (file: SelectedFileSource, fileLetter: 'a' | 'b') => void;
  onLoadResult: (file?: File) => void;
  onContinue: () => void;
}

export function FileSelectionStep({ fileA, fileB, onFileSelect, onLoadResult, onContinue }: FileSelectionStepProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <StepIntroCard
        eyebrow="Step 1 · Local files"
        title="Select two local CSV files"
        description="Choose the files you want to compare. You can reselect either file before running the comparison."
        headerClassName="lg:items-stretch"
        copyClassName="self-center"
        action={
          <StepActionPanel
            title="Already have a saved result?"
            description="Load a comparison snapshot to reopen the results in read-only mode."
            className="lg:w-[24rem]"
          >
            <LoadResultButton onLoadResult={onLoadResult} />
          </StepActionPanel>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <FileSelector label="File A" file={fileA} onSelect={(file) => onFileSelect(file, 'a')} />
        <FileSelector label="File B" file={fileB} onSelect={(file) => onFileSelect(file, 'b')} />
      </div>

      {fileA && fileB && (
        <div className="mt-6 flex justify-end">
          <NavButton direction="forward" onClick={onContinue}>
            Continue to configuration
          </NavButton>
        </div>
      )}
    </div>
  );
}
