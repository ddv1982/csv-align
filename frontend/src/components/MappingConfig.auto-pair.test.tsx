import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MappingConfig } from './MappingConfig';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';

const fileA = {
  name: 'left.csv',
  headers: ['id', 'full_name'],
  columns: [],
  rowCount: 2,
};

const fileB = {
  name: 'right.csv',
  headers: ['record_id', 'display_name'],
  columns: [],
  rowCount: 2,
};

test('keeps auto-pair disabled until matching key selections are present', () => {
  render(
    <MappingConfig
      fileA={fileA}
      fileB={fileB}
      selection={{
        keyColumnsA: [],
        keyColumnsB: [],
        comparisonColumnsA: [],
        comparisonColumnsB: [],
      }}
      normalization={INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />,
  );

  expect(screen.getByRole('button', { name: 'Auto-pair from File A' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Auto-pair from File B' })).toBeDisabled();
  expect(screen.getByText('Select the same number of key columns in File A and File B to enable auto-pair. Those key pairs are used as the starting point for any generated comparison order.')).toBeInTheDocument();
});

test('enables auto-pair beside the pair-order actions after matching key selections and forwards the leading side', () => {
  const onAutoPairComparisonColumns = vi.fn();

  render(
    <MappingConfig
      fileA={fileA}
      fileB={fileB}
      selection={{
        keyColumnsA: ['id'],
        keyColumnsB: ['record_id'],
        comparisonColumnsA: [],
        comparisonColumnsB: [],
      }}
      normalization={INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={() => undefined}
      onNormalizationChange={() => undefined}
      onCompare={() => undefined}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={onAutoPairComparisonColumns}
    />,
  );

  expect(screen.getByRole('button', { name: 'Auto-pair from File A' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Auto-pair from File B' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Auto-pair from File A' }));
  fireEvent.click(screen.getByRole('button', { name: 'Auto-pair from File B' }));

  expect(screen.getByText('When confident comparison matches are found, auto-pair starts with the selected key pair(s) and then adds the remaining one-to-one matches.')).toBeInTheDocument();
  expect(onAutoPairComparisonColumns).toHaveBeenNthCalledWith(1, 'a');
  expect(onAutoPairComparisonColumns).toHaveBeenNthCalledWith(2, 'b');
});
