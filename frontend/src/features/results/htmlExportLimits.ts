import { RESOURCE_LIMITS } from '../../services/contracts';

export type HtmlExportLimitKind = 'rows' | 'data' | 'document';

export class HtmlExportLimitError extends Error {
  readonly name = 'HtmlExportLimitError';
  readonly code = 'html_export_limit';

  constructor(
    readonly kind: HtmlExportLimitKind,
    readonly actual: number,
    readonly limit: number,
  ) {
    const description = kind === 'rows'
      ? `HTML export supports at most ${limit.toLocaleString('en-US')} rows; this result set has ${actual.toLocaleString('en-US')}.`
      : `HTML export ${kind} exceeds the ${formatMiB(limit)} MiB limit (${actual.toLocaleString('en-US')} UTF-8 bytes).`;

    super(`${description} Use CSV export or reduce the result set.`);
  }
}

function formatMiB(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString('en-US');
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function validateHtmlExportRowCount(rowCount: number): void {
  if (rowCount > RESOURCE_LIMITS.htmlExportRows) {
    throw new HtmlExportLimitError('rows', rowCount, RESOURCE_LIMITS.htmlExportRows);
  }
}

export function validateHtmlExportDataByteLength(byteLength: number): void {
  if (byteLength > RESOURCE_LIMITS.htmlExportDataBytes) {
    throw new HtmlExportLimitError('data', byteLength, RESOURCE_LIMITS.htmlExportDataBytes);
  }
}

export function validateHtmlExportDocumentByteLength(byteLength: number): void {
  if (byteLength > RESOURCE_LIMITS.htmlExportDocumentBytes) {
    throw new HtmlExportLimitError('document', byteLength, RESOURCE_LIMITS.htmlExportDocumentBytes);
  }
}

export function validateHtmlExportDocument(contents: string): void {
  validateHtmlExportDocumentByteLength(utf8ByteLength(contents));
}
