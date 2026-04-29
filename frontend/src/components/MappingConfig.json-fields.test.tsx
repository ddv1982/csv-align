import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { INITIAL_NORMALIZATION_CONFIG } from '../config/normalization';
import type { AppFile, MappingSelectionState } from '../types/ui';
import { MappingConfig } from './MappingConfig';

const fileA: AppFile = {
  name: 'left.csv',
  headers: ['id', 'payload'],
  virtualHeaders: ['payload.customer.id', 'payload.customer.name'],
  columns: [],
  rowCount: 2,
};

const fileB: AppFile = {
  name: 'right.csv',
  headers: ['record_id', 'body'],
  virtualHeaders: ['body.customer.id', 'body.customer.name'],
  columns: [],
  rowCount: 2,
};

const emptySelection: MappingSelectionState = {
  keyColumnsA: [],
  keyColumnsB: [],
  comparisonColumnsA: [],
  comparisonColumnsB: [],
};

function renderMappingConfig(overrides: Partial<{
  selection: MappingSelectionState;
  normalization: Parameters<typeof MappingConfig>[0]['normalization'];
  onSelectionChange: (selection: MappingSelectionState) => void;
  onNormalizationChange: Parameters<typeof MappingConfig>[0]['onNormalizationChange'];
  onCompare: Parameters<typeof MappingConfig>[0]['onCompare'];
}> = {}) {
  return render(
    <MappingConfig
      fileA={fileA}
      fileB={fileB}
      selection={overrides.selection ?? emptySelection}
      normalization={overrides.normalization ?? INITIAL_NORMALIZATION_CONFIG}
      onSelectionChange={overrides.onSelectionChange ?? (() => undefined)}
      onNormalizationChange={overrides.onNormalizationChange ?? (() => undefined)}
      onCompare={overrides.onCompare ?? (() => undefined)}
      onSavePairOrder={() => undefined}
      onLoadPairOrder={() => undefined}
      onAutoPairComparisonColumns={() => undefined}
    />
  );
}

test('allows users to enable equivalent number cleanup', () => {
  const onNormalizationChange = vi.fn();

  renderMappingConfig({ onNormalizationChange });

  fireEvent.click(screen.getByLabelText('Match equivalent numbers with or without decimals'));

  expect(onNormalizationChange).toHaveBeenCalledWith({
    ...INITIAL_NORMALIZATION_CONFIG,
    numeric_equivalence: true,
  });
});

test('allows users to enable decimal rounding cleanup', () => {
  const onNormalizationChange = vi.fn();

  renderMappingConfig({ onNormalizationChange });

  fireEvent.click(screen.getByLabelText('Round numeric values to a chosen number of decimal places before comparing'));

  expect(onNormalizationChange).toHaveBeenCalledWith({
    ...INITIAL_NORMALIZATION_CONFIG,
    decimal_rounding: {
      ...INITIAL_NORMALIZATION_CONFIG.decimal_rounding,
      enabled: true,
    },
  });
});

test('lets users change decimal rounding precision', () => {
  const onNormalizationChange = vi.fn();

  renderMappingConfig({
    onNormalizationChange,
    normalization: {
      ...INITIAL_NORMALIZATION_CONFIG,
      decimal_rounding: {
        enabled: true,
        decimals: 0,
      },
    },
  });

  fireEvent.change(screen.getByLabelText('Decimal places'), { target: { value: '2' } });

  expect(onNormalizationChange).toHaveBeenLastCalledWith({
    ...INITIAL_NORMALIZATION_CONFIG,
    decimal_rounding: {
      enabled: true,
      decimals: 2,
    },
  });
});

test('shows physical columns and virtual JSON fields in mapping selectors', () => {
  renderMappingConfig();

  const rowKeysA = screen.getByRole('heading', { name: 'Row keys in File A' }).closest('div');
  expect(rowKeysA).not.toBeNull();
  expect(within(rowKeysA as HTMLElement).getByText('Physical columns')).toBeInTheDocument();
  expect(within(rowKeysA as HTMLElement).getByRole('button', { name: 'id' })).toBeInTheDocument();
  expect(within(rowKeysA as HTMLElement).getByText('Virtual JSON fields')).toBeInTheDocument();
  expect(within(rowKeysA as HTMLElement).getByRole('button', { name: 'payload.customer.id' })).toBeInTheDocument();
});

test('passes selected virtual JSON fields to compare unchanged', () => {
  const onCompare = vi.fn();

  renderMappingConfig({
    selection: {
      keyColumnsA: ['payload.customer.id'],
      keyColumnsB: ['body.customer.id'],
      comparisonColumnsA: ['payload.customer.name'],
      comparisonColumnsB: ['body.customer.name'],
    },
    onCompare,
  });

  fireEvent.click(screen.getByRole('button', { name: 'Run Comparison' }));

  expect(onCompare).toHaveBeenCalledWith(
    ['payload.customer.id'],
    ['body.customer.id'],
    ['payload.customer.name'],
    ['body.customer.name'],
    [{ file_a_column: 'payload.customer.name', file_b_column: 'body.customer.name', mapping_type: 'manual' }],
    INITIAL_NORMALIZATION_CONFIG,
  );
});

test('selection toggles preserve virtual JSON field strings', () => {
  const onSelectionChange = vi.fn();

  renderMappingConfig({ onSelectionChange });

  const rowKeysA = screen.getByRole('heading', { name: 'Row keys in File A' }).closest('div');
  expect(rowKeysA).not.toBeNull();

  fireEvent.click(within(rowKeysA as HTMLElement).getByRole('button', { name: 'payload.customer.id' }));

  expect(onSelectionChange).toHaveBeenCalledWith({
    ...emptySelection,
    keyColumnsA: ['payload.customer.id'],
  });
});
