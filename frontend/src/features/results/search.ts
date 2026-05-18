import type { MappingDto, ResultResponse } from '../../types/api';

export const SEARCHABLE_FIELD_GROUPS = ['general', 'mapped', 'fileA', 'fileB'] as const;

export type SearchableFieldGroup = typeof SEARCHABLE_FIELD_GROUPS[number];
export type SearchableFieldId = string;

export type SearchableFieldOption = {
  id: SearchableFieldId;
  label: string;
  group: SearchableFieldGroup;
  placeholder: string;
};

export type ComparisonColumns = {
  fileA: string[];
  fileB: string[];
  mappings?: MappingDto[];
};

export type SearchableResultValueCell = {
  column: string | null;
  value: string;
};

export type SearchableExpandableDetail = {
  title: string;
  summary: string;
  toggleLabel: string;
  panels: Array<{
    label: string | null;
    fields: Array<{
      columnA: string | null;
      columnB: string | null;
      valueA: string;
      valueB: string;
    }>;
  }>;
};

type SearchableFieldTextInput = {
  result: ResultResponse;
  badgeLabel: string;
  filterBucket: string;
  description: string | null;
  fileAValues: SearchableResultValueCell[][];
  fileBValues: SearchableResultValueCell[][];
  expandableDetail: SearchableExpandableDetail | null;
  comparisonColumns: ComparisonColumns;
};

export const SEARCHABLE_FIELD_ALL: SearchableFieldId = 'all';

export const SEARCH_FIELD_GROUP_LABELS: Record<SearchableFieldGroup, string> = {
  general: 'General',
  mapped: 'Mapped columns',
  fileA: 'File A columns',
  fileB: 'File B columns',
};

const GENERAL_SEARCHABLE_FIELDS: SearchableFieldOption[] = [
  { id: SEARCHABLE_FIELD_ALL, label: 'All fields', group: 'general', placeholder: 'Search all result fields' },
  { id: 'type', label: 'Type', group: 'general', placeholder: 'Search result types' },
  { id: 'key', label: 'Key', group: 'general', placeholder: 'Search keys' },
  { id: 'fileA', label: 'File A values', group: 'general', placeholder: 'Search File A values' },
  { id: 'fileB', label: 'File B values', group: 'general', placeholder: 'Search File B values' },
  { id: 'details', label: 'Details', group: 'general', placeholder: 'Search details' },
];

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function joinSearchParts(parts: Array<string | number | null | undefined>): string {
  return normalizeSearchText(parts.filter((part) => part !== null && part !== undefined && String(part).length > 0).join(' '));
}

function encodeSearchableFieldSegment(value: string): string {
  return encodeURIComponent(value);
}

export function getMappedSearchableFieldId(columnA: string, columnB: string): SearchableFieldId {
  return `mapped:${encodeSearchableFieldSegment(columnA)}:${encodeSearchableFieldSegment(columnB)}`;
}

export function getFileASearchableFieldId(column: string): SearchableFieldId {
  return `fileA:${encodeSearchableFieldSegment(column)}`;
}

export function getFileBSearchableFieldId(column: string): SearchableFieldId {
  return `fileB:${encodeSearchableFieldSegment(column)}`;
}

function addUniqueSearchableField(options: SearchableFieldOption[], seen: Set<string>, option: SearchableFieldOption): void {
  if (seen.has(option.id)) {
    return;
  }

  options.push(option);
  seen.add(option.id);
}

export function getSearchableFieldOptions(
  comparisonColumns: ComparisonColumns = { fileA: [], fileB: [], mappings: [] },
): SearchableFieldOption[] {
  const options = [...GENERAL_SEARCHABLE_FIELDS];
  const seen = new Set(options.map((option) => option.id));
  const selectedColumnsA = new Set(comparisonColumns.fileA);
  const selectedColumnsB = new Set(comparisonColumns.fileB);

  for (const mapping of comparisonColumns.mappings ?? []) {
    if (!selectedColumnsA.has(mapping.file_a_column) || !selectedColumnsB.has(mapping.file_b_column)) {
      continue;
    }

    const label = mapping.file_a_column === mapping.file_b_column
      ? mapping.file_a_column
      : `${mapping.file_a_column} ↔ ${mapping.file_b_column}`;
    addUniqueSearchableField(options, seen, {
      id: getMappedSearchableFieldId(mapping.file_a_column, mapping.file_b_column),
      label,
      group: 'mapped',
      placeholder: `Search ${label}`,
    });
  }

  for (const column of comparisonColumns.fileA) {
    addUniqueSearchableField(options, seen, {
      id: getFileASearchableFieldId(column),
      label: column,
      group: 'fileA',
      placeholder: `Search ${column}`,
    });
  }

  for (const column of comparisonColumns.fileB) {
    addUniqueSearchableField(options, seen, {
      id: getFileBSearchableFieldId(column),
      label: column,
      group: 'fileB',
      placeholder: `Search ${column}`,
    });
  }

  return options;
}

export function normalizeSearchableFieldId(
  fieldId: SearchableFieldId | null | undefined,
  options: SearchableFieldOption[],
): SearchableFieldId {
  return options.some((option) => option.id === fieldId) ? String(fieldId) : SEARCHABLE_FIELD_ALL;
}

export function getSearchableFieldPlaceholder(fieldId: SearchableFieldId, options: SearchableFieldOption[]): string {
  return options.find((option) => option.id === normalizeSearchableFieldId(fieldId, options))?.placeholder
    ?? GENERAL_SEARCHABLE_FIELDS[0].placeholder;
}

function collectCellValues(rows: SearchableResultValueCell[][], column: string): string[] {
  return rows.flatMap((row) => row.filter((cell) => cell.column === column).map((cell) => cell.value));
}

function collectExpandableDetailText(expandableDetail: SearchableExpandableDetail | null): Array<string | null> {
  if (!expandableDetail) {
    return [];
  }

  return [
    expandableDetail.title,
    expandableDetail.summary,
    expandableDetail.toggleLabel,
    ...expandableDetail.panels.flatMap((panel) => [
      panel.label,
      ...panel.fields.flatMap((field) => [field.columnA, field.columnB, field.valueA, field.valueB]),
    ]),
  ];
}

export function buildSearchFields(input: SearchableFieldTextInput): Record<SearchableFieldId, string> {
  const fileATextParts = [input.result.values_a.join(' '), input.result.duplicate_values_a.flat().join(' ')];
  const fileBTextParts = [input.result.values_b.join(' '), input.result.duplicate_values_b.flat().join(' ')];
  const detailsTextParts = [
    input.description,
    ...input.result.differences.flatMap((diff) => [diff.column_a, diff.column_b, diff.value_a, diff.value_b]),
    ...collectExpandableDetailText(input.expandableDetail),
  ];
  const searchFields: Record<SearchableFieldId, string> = {
    type: joinSearchParts([input.badgeLabel, input.result.result_type, input.filterBucket]),
    key: joinSearchParts(input.result.key),
    fileA: joinSearchParts(fileATextParts),
    fileB: joinSearchParts(fileBTextParts),
    details: joinSearchParts(detailsTextParts),
  };

  searchFields[SEARCHABLE_FIELD_ALL] = joinSearchParts([
    searchFields.type,
    searchFields.key,
    searchFields.fileA,
    searchFields.fileB,
    searchFields.details,
  ]);

  for (const mapping of input.comparisonColumns.mappings ?? []) {
    const fieldId = getMappedSearchableFieldId(mapping.file_a_column, mapping.file_b_column);
    const matchingDiffs = input.result.differences.filter((diff) => (
      diff.column_a === mapping.file_a_column && diff.column_b === mapping.file_b_column
    ));

    searchFields[fieldId] = joinSearchParts([
      ...collectCellValues(input.fileAValues, mapping.file_a_column),
      ...collectCellValues(input.fileBValues, mapping.file_b_column),
      ...matchingDiffs.flatMap((diff) => [diff.value_a, diff.value_b]),
    ]);
  }

  for (const column of input.comparisonColumns.fileA) {
    searchFields[getFileASearchableFieldId(column)] = joinSearchParts([
      ...collectCellValues(input.fileAValues, column),
      ...input.result.differences.filter((diff) => diff.column_a === column).map((diff) => diff.value_a),
    ]);
  }

  for (const column of input.comparisonColumns.fileB) {
    searchFields[getFileBSearchableFieldId(column)] = joinSearchParts([
      ...collectCellValues(input.fileBValues, column),
      ...input.result.differences.filter((diff) => diff.column_b === column).map((diff) => diff.value_b),
    ]);
  }

  return searchFields;
}
