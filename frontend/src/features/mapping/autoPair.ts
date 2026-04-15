import type { FileLetter, MappingResponse } from '../../types/api';

export const AUTO_PAIR_MIN_FUZZY_SIMILARITY = 0.85;

interface BuildAutoPairSelectionArgs {
  fileAHeaders: string[];
  fileBHeaders: string[];
  mappings: MappingResponse[];
  leadingSide: FileLetter;
  excludedColumnsA?: string[];
  excludedColumnsB?: string[];
}

export function isConfidentAutoPairMapping(mapping: MappingResponse): boolean {
  if (mapping.mapping_type === 'exact') {
    return true;
  }

  return mapping.mapping_type === 'fuzzy'
    && typeof mapping.similarity === 'number'
    && mapping.similarity >= AUTO_PAIR_MIN_FUZZY_SIMILARITY;
}

export function buildAutoPairSelection({
  fileAHeaders,
  fileBHeaders,
  mappings,
  leadingSide,
  excludedColumnsA = [],
  excludedColumnsB = [],
}: BuildAutoPairSelectionArgs) {
  const fileAIndex = buildHeaderIndex(fileAHeaders);
  const fileBIndex = buildHeaderIndex(fileBHeaders);
  const excludedA = new Set(excludedColumnsA);
  const excludedB = new Set(excludedColumnsB);

  const orderedMappings = mappings
    .filter(isConfidentAutoPairMapping)
    .filter((mapping) => !excludedA.has(mapping.file_a_column) && !excludedB.has(mapping.file_b_column))
    .sort((left, right) => compareMappings(left, right, fileAIndex, fileBIndex, leadingSide));

  return {
    comparisonColumnsA: orderedMappings.map((mapping) => mapping.file_a_column),
    comparisonColumnsB: orderedMappings.map((mapping) => mapping.file_b_column),
  };
}

function buildHeaderIndex(headers: string[]) {
  return new Map(headers.map((header, index) => [header, index]));
}

function compareMappings(
  left: MappingResponse,
  right: MappingResponse,
  fileAIndex: Map<string, number>,
  fileBIndex: Map<string, number>,
  leadingSide: FileLetter,
) {
  const primaryLeft = leadingSide === 'a'
    ? fileAIndex.get(left.file_a_column) ?? Number.POSITIVE_INFINITY
    : fileBIndex.get(left.file_b_column) ?? Number.POSITIVE_INFINITY;
  const primaryRight = leadingSide === 'a'
    ? fileAIndex.get(right.file_a_column) ?? Number.POSITIVE_INFINITY
    : fileBIndex.get(right.file_b_column) ?? Number.POSITIVE_INFINITY;

  if (primaryLeft !== primaryRight) {
    return primaryLeft - primaryRight;
  }

  const secondaryLeft = leadingSide === 'a'
    ? fileBIndex.get(left.file_b_column) ?? Number.POSITIVE_INFINITY
    : fileAIndex.get(left.file_a_column) ?? Number.POSITIVE_INFINITY;
  const secondaryRight = leadingSide === 'a'
    ? fileBIndex.get(right.file_b_column) ?? Number.POSITIVE_INFINITY
    : fileAIndex.get(right.file_a_column) ?? Number.POSITIVE_INFINITY;

  return secondaryLeft - secondaryRight;
}
