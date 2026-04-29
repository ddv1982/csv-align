import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MappingConfig } from './MappingConfig';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import { ComparisonNormalizationConfig } from '../types/api';

const file = {
  name: 'sample.csv',
  headers: ['id', 'name', 'value'],
  columns: [],
  rowCount: 3,
};

const selection = {
  keyColumnsA: [],
  keyColumnsB: [],
  comparisonColumnsA: [],
  comparisonColumnsB: [],
};

function renderMappingConfig(normalization: ComparisonNormalizationConfig = INITIAL_NORMALIZATION_CONFIG) {
  return render(
    <MappingConfig
      fileA={file}
      fileB={file}
      selection={selection}
      normalization={normalization}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />
  );
}

test('shows the simplified cleanup copy and labels', () => {
  renderMappingConfig();

  expect(screen.getByRole('heading', { name: 'Comparison cleanup rules' })).toBeInTheDocument();
  expect(screen.getByLabelText('Treat blank cells as missing')).toBeInTheDocument();
  expect(screen.getByText('Also treat these values as missing')).toBeInTheDocument();
  expect(screen.getByLabelText('Round numeric values before comparing')).toBeInTheDocument();
  expect(screen.getByLabelText('Match dates written in different formats')).toBeInTheDocument();
  expect(screen.getByText('Select the same number of row keys in both files to enable auto-pair.')).toBeInTheDocument();
});

test('disables decimal-place input until rounding is enabled', () => {
  renderMappingConfig();

  expect(screen.getByLabelText('Decimal digits to remove')).toBeDisabled();
});

test('shows save, load, and copy actions inside the pair-order box', () => {
  renderMappingConfig();

  const comparisonSection = screen.getByRole('heading', { name: 'Choose columns to compare' }).closest('section');
  const pairOrderBox = screen.getByLabelText('Pair order');
  const autoPairBox = screen.getByLabelText('Auto-pair helper');

  expect(comparisonSection).not.toBeNull();
  expect(within(pairOrderBox).getByRole('button', { name: 'Save pair order' })).toBeInTheDocument();
  expect(within(pairOrderBox).getByRole('button', { name: 'Load pair order' })).toBeInTheDocument();
  expect(within(pairOrderBox).getByRole('button', { name: 'Copy current pair order' })).toBeInTheDocument();
  expect(within(autoPairBox).queryByRole('button', { name: 'Copy current pair order' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Column pairing' })).not.toBeInTheDocument();
});

test('disables save pair order until at least one pair exists', () => {
  renderMappingConfig();

  expect(within(screen.getByLabelText('Pair order')).getByRole('button', { name: 'Save pair order' })).toBeDisabled();
});

test('disables copy pair order until at least one pair exists', () => {
  renderMappingConfig();

  expect(within(screen.getByLabelText('Pair order')).getByRole('button', { name: 'Copy current pair order' })).toBeDisabled();
});

test('enables save pair order when a pair order exists', () => {
  render(
    <MappingConfig
      fileA={file}
      fileB={file}
      selection={{
        keyColumnsA: [],
        keyColumnsB: [],
        comparisonColumnsA: ['id'],
        comparisonColumnsB: ['value'],
      }}
      normalization={INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />
  );

  expect(within(screen.getByLabelText('Pair order')).getByRole('button', { name: 'Save pair order' })).toBeEnabled();
});

test('shows auto-pair controls in the comparison preview', () => {
  renderMappingConfig();

  const comparisonSection = screen.getByRole('heading', { name: 'Choose columns to compare' }).closest('section');

  expect(comparisonSection).not.toBeNull();
  expect(within(comparisonSection as HTMLElement).getByText('Select the same number of row keys in both files to enable auto-pair.')).toBeInTheDocument();
  expect(within(comparisonSection as HTMLElement).getByRole('button', { name: 'From File A' })).toBeInTheDocument();
  expect(within(comparisonSection as HTMLElement).getByRole('button', { name: 'From File B' })).toBeInTheDocument();
});

test('keeps advanced date controls collapsed by default and lets users reveal them', () => {
  renderMappingConfig();

  const details = screen.getByText('Advanced date patterns').closest('details') as HTMLDetailsElement;
  expect(details).not.toHaveAttribute('open');

  fireEvent.click(within(details).getByText('Advanced date patterns'));

  expect(details).toHaveAttribute('open');
  expect(within(details).getByText('Date formats to try')).toBeInTheDocument();
  expect(within(details).getByRole('textbox')).toHaveValue(
    INITIAL_NORMALIZATION_CONFIG.date_normalization.formats.join('\n')
  );
});

test('copies the current pair order in the same displayed text format and shows success state', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  });

  render(
    <MappingConfig
      fileA={file}
      fileB={file}
      selection={{
        keyColumnsA: [],
        keyColumnsB: [],
        comparisonColumnsA: ['id', 'name'],
        comparisonColumnsB: ['value', 'id'],
      }}
      normalization={INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />
  );

  expect(screen.getByText('1 id → value')).toBeInTheDocument();
  expect(screen.getByText('2 name → id')).toBeInTheDocument();

  const pairOrderBox = screen.getByLabelText('Pair order');
  const copyButton = within(pairOrderBox).getByRole('button', { name: 'Copy current pair order' });
  expect(copyButton).toHaveAttribute('title', 'Copy current pair order');
  expect(copyButton.querySelector('svg')).not.toBeNull();
  expect(within(copyButton).queryByText('CP')).not.toBeInTheDocument();

  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith('1 id → value\n2 name → id');
    const copiedButton = within(pairOrderBox).getByRole('button', { name: 'Copied current pair order' });

    expect(copiedButton).toHaveClass('text-[color:var(--color-kinetic-success)]');
    expect(copiedButton).toHaveAttribute('title', 'Copied current pair order');
    expect(copiedButton.querySelector('svg')).not.toBeNull();
    expect(within(copiedButton).queryByText('OK')).not.toBeInTheDocument();
  });

  vi.unstubAllGlobals();
});

test('does not copy when no pairs are selected yet', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  });

  renderMappingConfig();

  const copyButton = within(screen.getByLabelText('Pair order')).getByRole('button', { name: 'Copy current pair order' });

  expect(copyButton).toBeDisabled();
  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeText).not.toHaveBeenCalled();
  });

  vi.unstubAllGlobals();
});

test('copies the same whitespace-collapsed text shown in the pair preview', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  });

  render(
    <MappingConfig
      fileA={file}
      fileB={file}
      selection={{
        keyColumnsA: [],
        keyColumnsB: [],
        comparisonColumnsA: ['full   name', 'zip\ncode'],
        comparisonColumnsB: ['customer\tid', 'postal   code'],
      }}
      normalization={INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />
  );

  expect(screen.getByText('1 full name → customer id')).toBeInTheDocument();
  expect(screen.getByText('2 zip code → postal code')).toBeInTheDocument();

  fireEvent.click(within(screen.getByLabelText('Pair order')).getByRole('button', { name: 'Copy current pair order' }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith('1 full name → customer id\n2 zip code → postal code');
  });

  vi.unstubAllGlobals();
});
