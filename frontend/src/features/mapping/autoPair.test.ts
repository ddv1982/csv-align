import { expect, test } from 'vitest';
import { buildAutoPairSelection, isConfidentAutoPairMapping } from './autoPair';

test('keeps only confident non-key mappings and orders them by File A', () => {
  const selection = buildAutoPairSelection({
    fileAHeaders: ['id', 'full_name', 'email_address', 'notes'],
    fileBHeaders: ['record_id', 'display_name', 'email', 'comment'],
    leadingSide: 'a',
    excludedColumnsA: ['id'],
    excludedColumnsB: ['record_id'],
    mappings: [
      { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'id', file_b_column: 'record_id', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'notes', file_b_column: 'comment', mapping_type: 'fuzzy', similarity: 0.8 },
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
    ],
  });

  expect(selection).toEqual({
    comparisonColumnsA: ['full_name', 'email_address'],
    comparisonColumnsB: ['display_name', 'email'],
  });
});

test('orders confident mappings by File B when File B leads', () => {
  const selection = buildAutoPairSelection({
    fileAHeaders: ['id', 'email_address', 'full_name'],
    fileBHeaders: ['record_id', 'display_name', 'email'],
    leadingSide: 'b',
    excludedColumnsA: ['id'],
    excludedColumnsB: ['record_id'],
    mappings: [
      { file_a_column: 'email_address', file_b_column: 'email', mapping_type: 'fuzzy', similarity: 0.93 },
      { file_a_column: 'full_name', file_b_column: 'display_name', mapping_type: 'fuzzy', similarity: 0.93 },
    ],
  });

  expect(selection).toEqual({
    comparisonColumnsA: ['full_name', 'email_address'],
    comparisonColumnsB: ['display_name', 'email'],
  });
});

test('treats exact mappings as confident and rejects weaker fuzzy ones', () => {
  expect(isConfidentAutoPairMapping({
    file_a_column: 'first_name',
    file_b_column: 'first_name',
    mapping_type: 'exact',
  })).toBe(true);

  expect(isConfidentAutoPairMapping({
    file_a_column: 'notes',
    file_b_column: 'comment',
    mapping_type: 'fuzzy',
    similarity: 0.84,
  })).toBe(false);
});
