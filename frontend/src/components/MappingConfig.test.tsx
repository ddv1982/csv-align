import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
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
  expect(screen.getByText('Select comparison columns in File A and File B in the order you want to pair them, or auto-pair confident matches using File A or File B as the leading order.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cleanup before compare' })).toBeInTheDocument();
  expect(screen.getByLabelText('Treat blank cells as missing')).toBeInTheDocument();
  expect(screen.getByText('Also treat these exact values as missing')).toBeInTheDocument();
  expect(screen.getByLabelText('Match dates across different formats')).toBeInTheDocument();
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
