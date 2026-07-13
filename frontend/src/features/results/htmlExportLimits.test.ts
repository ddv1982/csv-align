import { expect, test } from 'vitest';
import { RESOURCE_LIMITS } from '../../services/contracts';
import {
  HtmlExportLimitError,
  utf8ByteLength,
  validateHtmlExportDataByteLength,
  validateHtmlExportDocumentByteLength,
  validateHtmlExportRowCount,
} from './htmlExportLimits';

test('counts HTML export strings as UTF-8 bytes', () => {
  expect(utf8ByteLength('plain')).toBe(5);
  expect(utf8ByteLength('é')).toBe(2);
  expect(utf8ByteLength('🙂')).toBe(4);
});

test('accepts exact HTML export limits and rejects limit plus one without truncation', () => {
  expect(() => validateHtmlExportRowCount(RESOURCE_LIMITS.htmlExportRows)).not.toThrow();
  expect(() => validateHtmlExportDataByteLength(RESOURCE_LIMITS.htmlExportDataBytes)).not.toThrow();
  expect(() => validateHtmlExportDocumentByteLength(RESOURCE_LIMITS.htmlExportDocumentBytes)).not.toThrow();

  for (const [validate, limit] of [
    [validateHtmlExportRowCount, RESOURCE_LIMITS.htmlExportRows],
    [validateHtmlExportDataByteLength, RESOURCE_LIMITS.htmlExportDataBytes],
    [validateHtmlExportDocumentByteLength, RESOURCE_LIMITS.htmlExportDocumentBytes],
  ] as const) {
    expect(() => validate(limit + 1)).toThrow(HtmlExportLimitError);

    try {
      validate(limit + 1);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'html_export_limit',
        actual: limit + 1,
        limit,
      });
      expect((error as Error).message).toContain('Use CSV export or reduce the result set.');
    }
  }
});
