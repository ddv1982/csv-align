import { INITIAL_NORMALIZATION_CONFIG } from './normalization';
import { expect, test } from 'vitest';

test('uses the intended default cleanup normalization baseline', () => {
  expect(INITIAL_NORMALIZATION_CONFIG.treat_empty_as_null).toBe(true);
  expect(INITIAL_NORMALIZATION_CONFIG.null_tokens).toEqual(['null', 'na', 'n/a', 'none']);
  expect(INITIAL_NORMALIZATION_CONFIG.null_tokens).not.toContain('-');
  expect(INITIAL_NORMALIZATION_CONFIG.null_token_case_insensitive).toBe(true);
  expect(INITIAL_NORMALIZATION_CONFIG.case_insensitive).toBe(false);
  expect(INITIAL_NORMALIZATION_CONFIG.trim_whitespace).toBe(false);
  expect(INITIAL_NORMALIZATION_CONFIG.numeric_equivalence).toBe(false);
  expect(INITIAL_NORMALIZATION_CONFIG.date_normalization.enabled).toBe(false);
  expect(INITIAL_NORMALIZATION_CONFIG.date_normalization.formats).toEqual([
    '%Y-%m-%d',
    '%d/%m/%Y',
    '%m/%d/%Y',
    '%d-%m-%Y',
    '%m-%d-%Y',
  ]);
});
