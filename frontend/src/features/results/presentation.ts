import type { CompareResultType, ResultFilter, ResultResponse, SummaryResponse } from '../../types/api';

export type ResultValueCell = {
  column: string | null;
  value: string;
};

export type ResultDetailField = {
  columnA: string | null;
  columnB: string | null;
  valueA: string;
  valueB: string;
};

export type ResultDetailPanel = {
  label: string | null;
  fields: ResultDetailField[];
};

export type ResultExpandableDetail = {
  variant: 'differences' | 'inspection';
  title: string;
  summary: string;
  toggleLabel: string;
  panels: ResultDetailPanel[];
};

type ResultFilterOption = {
  value: ResultFilter;
  label: string;
  accent: string;
};

export type ResultBadge = {
  label: string;
  bg: string;
  text: string;
  dot: string;
};

export type ResultBadgeTone =
  | 'match'
  | 'mismatch'
  | 'missing-left'
  | 'missing-right'
  | 'unkeyed-left'
  | 'unkeyed-right'
  | 'duplicate'
  | 'neutral';

export type ResultSortColumn = 'type' | 'key' | 'fileA' | 'fileB' | 'details';
export type ResultSortDirection = 'asc' | 'desc';
export type ResultFilterBucket = Exclude<ResultFilter, 'all'> | 'duplicate';

export type ResultRowViewModel = {
  id: string;
  result: ResultResponse;
  resultType: CompareResultType;
  filterBucket: ResultFilterBucket;
  badge: ResultBadge;
  badgeLabel: string;
  badgeTone: ResultBadgeTone;
  description: string | null;
  keyText: string;
  fileAValues: ResultValueCell[][];
  fileBValues: ResultValueCell[][];
  detailsCount: number;
  differences: ResultResponse['differences'];
  expandableDetail: ResultExpandableDetail | null;
  searchText: string;
  sortValues: Record<ResultSortColumn, string | number>;
};

export type SummaryStatTone = 'success' | 'warning' | 'accent' | 'danger';

export type SummaryStatViewModel = {
  label: string;
  value: number;
  description: string;
  tone: SummaryStatTone;
  icon: string;
};

export type SummaryBannerViewModel = {
  title: string;
  summary: string;
  details: string[];
  tone: 'accent' | 'warning';
  icon: string;
};

export type SummaryOverview = {
  comparableTotal: number;
  matchPercent: number;
  comparableStats: SummaryStatViewModel[];
  infoBanners: SummaryBannerViewModel[];
};

type ResultStaticCopy = {
  label: string;
  description: string | null;
};

const RESULT_COPY: Record<CompareResultType, ResultStaticCopy> = {
  match: {
    label: 'Match',
    description: null,
  },
  mismatch: {
    label: 'Mismatch',
    description: null,
  },
  missing_left: {
    label: 'Only in File B',
    description: 'Present only in File B for the selected key.',
  },
  missing_right: {
    label: 'Only in File A',
    description: 'Present only in File A for the selected key.',
  },
  unkeyed_left: {
    label: 'Ignored in File B',
    description: 'Skipped because File B has an unusable selected key for this row.',
  },
  unkeyed_right: {
    label: 'Ignored in File A',
    description: 'Skipped because File A has an unusable selected key for this row.',
  },
  duplicate_file_a: {
    label: 'Duplicate',
    description: 'Multiple File A rows share this selected key.',
  },
  duplicate_file_b: {
    label: 'Duplicate',
    description: 'Multiple File B rows share this selected key.',
  },
  duplicate_both: {
    label: 'Duplicate',
    description: 'Multiple rows on both sides share this selected key.',
  },
};

const DUPLICATE_BADGE: ResultBadge = {
  bg: 'border border-orange-200 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/25',
  text: 'text-orange-800 dark:text-orange-200',
  dot: 'bg-orange-500 dark:bg-orange-400',
  label: 'Duplicate',
};

export const RESULT_FILTER_OPTIONS: ResultFilterOption[] = [
  { value: 'all', label: 'All', accent: 'bg-gray-400 dark:bg-gray-500' },
  { value: 'match', label: 'Matches', accent: 'bg-emerald-500 dark:bg-emerald-400' },
  { value: 'mismatch', label: 'Mismatches', accent: 'bg-amber-500 dark:bg-amber-400' },
  { value: 'missing_left', label: RESULT_COPY.missing_left.label, accent: 'bg-sky-500 dark:bg-sky-400' },
  { value: 'missing_right', label: RESULT_COPY.missing_right.label, accent: 'bg-violet-500 dark:bg-violet-400' },
  { value: 'unkeyed_left', label: RESULT_COPY.unkeyed_left.label, accent: 'bg-rose-500 dark:bg-rose-400' },
  { value: 'unkeyed_right', label: RESULT_COPY.unkeyed_right.label, accent: 'bg-fuchsia-500 dark:bg-fuchsia-400' },
  { value: 'duplicate', label: 'Duplicates', accent: DUPLICATE_BADGE.dot },
];

export function getResultLabel(resultType: CompareResultType): string {
  return RESULT_COPY[resultType].label;
}

export function getResultDescription(resultType: CompareResultType): string | null {
  return RESULT_COPY[resultType].description;
}

export function getResultFilterBucket(result: ResultResponse): ResultFilterBucket {
  if (result.result_type.startsWith('duplicate')) {
    return 'duplicate';
  }

  return result.result_type as Exclude<ResultFilter, 'all' | 'duplicate'>;
}

export function getResultBadgeTone(resultType: CompareResultType): ResultBadgeTone {
  switch (resultType) {
    case 'match':
      return 'match';
    case 'mismatch':
      return 'mismatch';
    case 'missing_left':
      return 'missing-left';
    case 'missing_right':
      return 'missing-right';
    case 'unkeyed_left':
      return 'unkeyed-left';
    case 'unkeyed_right':
      return 'unkeyed-right';
    default:
      return resultType.startsWith('duplicate') ? 'duplicate' : 'neutral';
  }
}

export function matchesResultFilter(result: ResultResponse, filter: ResultFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'duplicate') {
    return result.result_type.startsWith('duplicate');
  }

  return result.result_type === filter;
}

export function filterResults(results: ResultResponse[], filter: ResultFilter): ResultResponse[] {
  return results.filter((result) => matchesResultFilter(result, filter));
}

export function getResultFilterCounts(results: ResultResponse[]): Record<ResultFilter, number> {
  const initialCounts: Record<ResultFilter, number> = {
    all: results.length,
    match: 0,
    mismatch: 0,
    missing_left: 0,
    missing_right: 0,
    unkeyed_left: 0,
    unkeyed_right: 0,
    duplicate: 0,
  };

  return results.reduce<Record<ResultFilter, number>>((counts, result) => {
    if (result.result_type.startsWith('duplicate')) {
      counts.duplicate += 1;
      return counts;
    }

    const filter = result.result_type as Exclude<ResultFilter, 'all' | 'duplicate'>;
    counts[filter] += 1;
    return counts;
  }, initialCounts);
}

function getDisplayRows(rows: string[][], fallback: string[]): string[][] {
  if (rows.length > 0) {
    return rows;
  }

  return fallback.length > 0 ? [fallback] : [];
}

function buildDisplayValueRows(rows: string[][], fallback: string[], comparisonColumns: string[]): ResultValueCell[][] {
  return getDisplayRows(rows, fallback).map((row) => row.map((value, index) => ({
    column: comparisonColumns[index] ?? null,
    value,
  })));
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function buildDifferenceDetail(differences: ResultResponse['differences']): ResultExpandableDetail | null {
  if (differences.length === 0) {
    return null;
  }

  return {
    variant: 'differences',
    title: 'Value Differences',
    summary: pluralize(differences.length, 'field'),
    toggleLabel: `${differences.length} diff${differences.length === 1 ? '' : 's'}`,
    panels: differences.map((diff) => ({
      label: null,
      fields: [{
        columnA: diff.column_a,
        columnB: diff.column_b,
        valueA: diff.value_a,
        valueB: diff.value_b,
      }],
    })),
  };
}

function buildInspectionDetail(fileAValues: ResultValueCell[][], fileBValues: ResultValueCell[][]): ResultExpandableDetail | null {
  const panelCount = Math.max(fileAValues.length, fileBValues.length);

  if (panelCount === 0) {
    return null;
  }

  const panels = Array.from({ length: panelCount }, (_, panelIndex) => {
    const rowA = fileAValues[panelIndex] ?? [];
    const rowB = fileBValues[panelIndex] ?? [];
    const fieldCount = Math.max(rowA.length, rowB.length);

    return {
      label: panelCount > 1 ? `Row ${panelIndex + 1}` : null,
      fields: Array.from({ length: fieldCount }, (_, fieldIndex) => ({
        columnA: rowA[fieldIndex]?.column ?? null,
        columnB: rowB[fieldIndex]?.column ?? null,
        valueA: rowA[fieldIndex]?.value ?? '',
        valueB: rowB[fieldIndex]?.value ?? '',
      })),
    };
  }).filter((panel) => panel.fields.length > 0);

  if (panels.length === 0) {
    return null;
  }

  return {
    variant: 'inspection',
    title: 'Paired Values',
    summary: pluralize(panels.length, 'row'),
    toggleLabel: 'Inspect',
    panels,
  };
}

function buildExpandableDetail(
  result: ResultResponse,
  fileAValues: ResultValueCell[][],
  fileBValues: ResultValueCell[][],
): ResultExpandableDetail | null {
  const differenceDetail = buildDifferenceDetail(result.differences);

  if (differenceDetail) {
    return differenceDetail;
  }

  if (result.result_type === 'mismatch') {
    return null;
  }

  return buildInspectionDetail(fileAValues, fileBValues);
}

function compareResultSortValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function buildResultRows(
  results: ResultResponse[],
  comparisonColumns: {
    fileA: string[];
    fileB: string[];
  } = { fileA: [], fileB: [] },
): ResultRowViewModel[] {
  return results.map((result, index) => {
    const badge = getResultBadge(result.result_type);
    const fileAValues = buildDisplayValueRows(result.duplicate_values_a, result.values_a, comparisonColumns.fileA);
    const fileBValues = buildDisplayValueRows(result.duplicate_values_b, result.values_b, comparisonColumns.fileB);
    const expandableDetail = buildExpandableDetail(result, fileAValues, fileBValues);
    const columnSearchText = [comparisonColumns.fileA.join(' '), comparisonColumns.fileB.join(' ')].join(' ');

    return {
      id: `${index}-${result.result_type}-${result.key.join('|')}`,
      result,
      resultType: result.result_type,
      filterBucket: getResultFilterBucket(result),
      badge,
      badgeLabel: badge.label,
      badgeTone: getResultBadgeTone(result.result_type),
      description: getResultDescription(result.result_type),
      keyText: result.key.join(', '),
      fileAValues,
      fileBValues,
      detailsCount: result.differences.length,
      differences: result.differences,
      expandableDetail,
      searchText: [
        badge.label,
        result.key.join(' '),
        result.values_a.join(' '),
        result.values_b.join(' '),
        result.duplicate_values_a.flat().join(' '),
        result.duplicate_values_b.flat().join(' '),
        columnSearchText,
        result.differences.flatMap((diff) => [diff.column_a, diff.column_b, diff.value_a, diff.value_b]).join(' '),
      ]
        .join(' ')
        .toLowerCase(),
      sortValues: {
        type: badge.label,
        key: result.key.join(' '),
        fileA: [...result.values_a, ...result.duplicate_values_a.flat()].join(' '),
        fileB: [...result.values_b, ...result.duplicate_values_b.flat()].join(' '),
        details: result.differences.length,
      },
    };
  });
}

export function filterAndSortResultRows(
  rows: ResultRowViewModel[],
  params: {
    filter: ResultFilter;
    query: string;
    sortColumn: ResultSortColumn | null;
    sortDirection: ResultSortDirection;
  },
): ResultRowViewModel[] {
  const normalizedQuery = params.query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchesBucket = params.filter === 'all' || row.filterBucket === params.filter;
    const matchesSearch = normalizedQuery.length === 0 || row.searchText.includes(normalizedQuery);
    return matchesBucket && matchesSearch;
  });

  if (!params.sortColumn) {
    return filtered;
  }

  const sortColumn = params.sortColumn;
  const direction = params.sortDirection === 'asc' ? 1 : -1;

  return [...filtered].sort((left, right) => (
    compareResultSortValues(left.sortValues[sortColumn], right.sortValues[sortColumn]) * direction
  ));
}

export function getComparableTotal(summary: SummaryResponse): number {
  return summary.matches + summary.mismatches + summary.missing_left + summary.missing_right;
}

function describeComparableShare(value: number, comparableTotal: number): string {
  return comparableTotal > 0
    ? `${Math.round((value / comparableTotal) * 100)}% of comparable rows`
    : 'No comparable rows';
}

export function buildSummaryOverview(summary: SummaryResponse): SummaryOverview {
  const comparableTotal = getComparableTotal(summary);
  const ignoredTotal = summary.unkeyed_left + summary.unkeyed_right;
  const infoBanners: SummaryBannerViewModel[] = [];

  if (ignoredTotal > 0) {
    infoBanners.push({
      title: 'Ignored rows',
      summary: `${summary.unkeyed_right} in File A, ${summary.unkeyed_left} in File B`,
      details: [
        'Ignored rows were not compared because the selected key was empty or matched a missing-value token after cleanup settings.',
        'Ignored rows may correspond to one-sided results on the other file, but they could not be matched confidently by key.',
      ],
      tone: 'accent',
      icon: 'i',
    });
  }

  if (summary.duplicates_a > 0 || summary.duplicates_b > 0) {
    infoBanners.push({
      title: 'Duplicate keys detected',
      summary: `Duplicates found: ${summary.duplicates_a} in File A, ${summary.duplicates_b} in File B`,
      details: ['Rows with duplicate selected keys can produce repeated matches or one-sided results and are worth reviewing before export.'],
      tone: 'warning',
      icon: '!!',
    });
  }

  return {
    comparableTotal,
    matchPercent: comparableTotal > 0 ? Math.round((summary.matches / comparableTotal) * 100) : 0,
    comparableStats: [
      {
        label: 'Matches',
        value: summary.matches,
        description: describeComparableShare(summary.matches, comparableTotal),
        tone: 'success',
        icon: 'OK',
      },
      {
        label: 'Mismatches',
        value: summary.mismatches,
        description: describeComparableShare(summary.mismatches, comparableTotal),
        tone: 'warning',
        icon: '!!',
      },
      {
        label: getResultLabel('missing_left'),
        value: summary.missing_left,
        description: describeComparableShare(summary.missing_left, comparableTotal),
        tone: 'accent',
        icon: 'A',
      },
      {
        label: getResultLabel('missing_right'),
        value: summary.missing_right,
        description: describeComparableShare(summary.missing_right, comparableTotal),
        tone: 'danger',
        icon: 'B',
      },
    ],
    infoBanners,
  };
}

export function getResultBadge(resultType: CompareResultType): ResultBadge {
  switch (resultType) {
    case 'match':
      return {
        bg: 'border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25',
        text: 'text-emerald-800 dark:text-emerald-200',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: RESULT_COPY.match.label,
      };
    case 'mismatch':
      return {
        bg: 'border border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25',
        text: 'text-amber-800 dark:text-amber-200',
        dot: 'bg-amber-500 dark:bg-amber-400',
        label: RESULT_COPY.mismatch.label,
      };
    case 'missing_left':
      return {
        bg: 'border border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25',
        text: 'text-sky-800 dark:text-sky-200',
        dot: 'bg-sky-500 dark:bg-sky-400',
        label: RESULT_COPY.missing_left.label,
      };
    case 'missing_right':
      return {
        bg: 'border border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/25',
        text: 'text-violet-800 dark:text-violet-200',
        dot: 'bg-violet-500 dark:bg-violet-400',
        label: RESULT_COPY.missing_right.label,
      };
    case 'unkeyed_left':
      return {
        bg: 'border border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/25',
        text: 'text-rose-800 dark:text-rose-200',
        dot: 'bg-rose-500 dark:bg-rose-400',
        label: RESULT_COPY.unkeyed_left.label,
      };
    case 'unkeyed_right':
      return {
        bg: 'border border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/25',
        text: 'text-fuchsia-800 dark:text-fuchsia-200',
        dot: 'bg-fuchsia-500 dark:bg-fuchsia-400',
        label: RESULT_COPY.unkeyed_right.label,
      };
    default:
      if (resultType.startsWith('duplicate')) {
        return DUPLICATE_BADGE;
      }

      return {
        bg: 'border border-gray-200 bg-gray-100/70 dark:border-gray-700 dark:bg-gray-800/70',
        text: 'text-gray-700 dark:text-gray-200',
        dot: 'bg-gray-500 dark:bg-gray-400',
        label: resultType,
      };
  }
}
