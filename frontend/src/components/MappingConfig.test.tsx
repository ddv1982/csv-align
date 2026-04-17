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

  expect(screen.getByRole('heading', { name: 'Manual column pairing' })).toBeInTheDocument();
  expect(screen.getByText('Select key columns first, then choose comparison columns manually or auto-pair confident matches using File A or File B as the leading order.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cleanup before compare' })).toBeInTheDocument();
  expect(screen.getByLabelText('Treat blank cells as missing')).toBeInTheDocument();
  expect(screen.getByText('Also treat these exact values as missing')).toBeInTheDocument();
  expect(screen.getByLabelText('Match dates across different formats')).toBeInTheDocument();
  expect(screen.getByText('Select the same number of key columns in File A and File B to enable auto-pair. Those key pairs are used as the starting point for any generated comparison order.')).toBeInTheDocument();
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

  const copyButton = screen.getByRole('button', { name: 'Copy current pair order' });
  expect(copyButton).toHaveAttribute('title', 'Copy current pair order');

  fireEvent.click(copyButton);

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith('1 id → value\n2 name → id');
    expect(screen.getByRole('button', { name: 'Copied current pair order' })).toHaveClass('text-green-600');
    expect(screen.getByRole('button', { name: 'Copied current pair order' })).toHaveAttribute('title', 'Copied current pair order');
  });

  vi.unstubAllGlobals();
});

test('copies the empty-state text when no pairs are selected yet', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  });

  renderMappingConfig();

  fireEvent.click(screen.getByRole('button', { name: 'Copy current pair order' }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith('No pairs selected yet.');
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

  fireEvent.click(screen.getByRole('button', { name: 'Copy current pair order' }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith('1 full name → customer id\n2 zip code → postal code');
  });

  vi.unstubAllGlobals();
});
