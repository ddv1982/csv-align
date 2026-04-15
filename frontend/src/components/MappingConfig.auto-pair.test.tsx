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

test('renders auto-pair controls beside the pair-order actions and forwards the leading side', () => {
  const onAutoPairComparisonColumns = vi.fn();

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
      onAutoPairComparisonColumns={onAutoPairComparisonColumns}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Auto-pair from File A' }));
  fireEvent.click(screen.getByRole('button', { name: 'Auto-pair from File B' }));

  expect(screen.getByText('Auto-pair keeps the current key selection and only applies confident one-to-one comparison matches.')).toBeInTheDocument();
  expect(onAutoPairComparisonColumns).toHaveBeenNthCalledWith(1, 'a');
  expect(onAutoPairComparisonColumns).toHaveBeenNthCalledWith(2, 'b');
});
