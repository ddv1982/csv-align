import { INITIAL_NORMALIZATION_CONFIG } from './normalization';
import { expect, test } from 'vitest';

test('uses the intended default null tokens without dash', () => {
  expect(INITIAL_NORMALIZATION_CONFIG.null_tokens).toEqual(['null', 'na', 'n/a', 'none']);
  expect(INITIAL_NORMALIZATION_CONFIG.null_tokens).not.toContain('-');
});
