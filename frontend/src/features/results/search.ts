import type { MappingDto, ResultResponse } from '../../types/api';

export const SEARCHABLE_FIELD_IDS = ['all', 'type', 'key', 'fileA', 'fileB'] as const;

export type SearchableFieldId = typeof SEARCHABLE_FIELD_IDS[number];

export type SearchableFieldOption = {
  id: SearchableFieldId;
  label: string;
  placeholder: string;
};

export type ComparisonColumns = {
  fileA: string[];
  fileB: string[];
  mappings?: MappingDto[];
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
  expandableDetail: SearchableExpandableDetail | null;
};

export const SEARCHABLE_FIELD_ALL = 'all';

const GENERAL_SEARCHABLE_FIELDS: SearchableFieldOption[] = [
  { id: SEARCHABLE_FIELD_ALL, label: 'All fields', placeholder: 'Search all result fields' },
  { id: 'type', label: 'Type', placeholder: 'Search result types' },
  { id: 'key', label: 'Key', placeholder: 'Search keys' },
  { id: 'fileA', label: 'File A values', placeholder: 'Search File A values' },
  { id: 'fileB', label: 'File B values', placeholder: 'Search File B values' },
];

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function joinSearchParts(parts: Array<string | number | null | undefined>): string {
  return normalizeSearchText(parts.filter((part) => part !== null && part !== undefined && String(part).length > 0).join(' '));
}

export function getSearchableFieldOptions(): SearchableFieldOption[] {
  return [...GENERAL_SEARCHABLE_FIELDS];
}

export function normalizeSearchableFieldId(
  fieldId: string | null | undefined,
  options: SearchableFieldOption[],
): SearchableFieldId {
  return options.some((option) => option.id === fieldId) ? (fieldId as SearchableFieldId) : SEARCHABLE_FIELD_ALL;
}

export function getSearchableFieldPlaceholder(fieldId: string, options: SearchableFieldOption[]): string {
  return options.find((option) => option.id === normalizeSearchableFieldId(fieldId, options))?.placeholder
    ?? GENERAL_SEARCHABLE_FIELDS[0].placeholder;
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
  const typeText = joinSearchParts([input.badgeLabel, input.result.result_type, input.filterBucket]);
  const keyText = joinSearchParts(input.result.key);
  const fileAText = joinSearchParts(fileATextParts);
  const fileBText = joinSearchParts(fileBTextParts);
  const detailText = joinSearchParts(detailsTextParts);

  return {
    [SEARCHABLE_FIELD_ALL]: joinSearchParts([
      typeText,
      keyText,
      fileAText,
      fileBText,
      detailText,
    ]),
    type: typeText,
    key: keyText,
    fileA: fileAText,
    fileB: fileBText,
  };
}
