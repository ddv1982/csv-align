import type { CompareResultType, ResultFilter, ResultResponse } from '../../types/api';

type ResultFilterOption = {
  value: ResultFilter;
  label: string;
  accent: string;
};

type ResultBadge = {
  label: string;
  bg: string;
  text: string;
  dot: string;
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
  { value: 'missing_left', label: 'Missing Left', accent: 'bg-sky-500 dark:bg-sky-400' },
  { value: 'missing_right', label: 'Missing Right', accent: 'bg-violet-500 dark:bg-violet-400' },
  { value: 'unkeyed_left', label: 'Unkeyed Left', accent: 'bg-rose-500 dark:bg-rose-400' },
  { value: 'unkeyed_right', label: 'Unkeyed Right', accent: 'bg-fuchsia-500 dark:bg-fuchsia-400' },
  { value: 'duplicate', label: 'Duplicates', accent: DUPLICATE_BADGE.dot },
];

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
  return {
    all: results.length,
    match: results.filter((result) => matchesResultFilter(result, 'match')).length,
    mismatch: results.filter((result) => matchesResultFilter(result, 'mismatch')).length,
    missing_left: results.filter((result) => matchesResultFilter(result, 'missing_left')).length,
    missing_right: results.filter((result) => matchesResultFilter(result, 'missing_right')).length,
    unkeyed_left: results.filter((result) => matchesResultFilter(result, 'unkeyed_left')).length,
    unkeyed_right: results.filter((result) => matchesResultFilter(result, 'unkeyed_right')).length,
    duplicate: results.filter((result) => matchesResultFilter(result, 'duplicate')).length,
  };
}

export function getResultBadge(resultType: CompareResultType): ResultBadge {
  switch (resultType) {
    case 'match':
      return {
        bg: 'border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25',
        text: 'text-emerald-800 dark:text-emerald-200',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: 'Match',
      };
    case 'mismatch':
      return {
        bg: 'border border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25',
        text: 'text-amber-800 dark:text-amber-200',
        dot: 'bg-amber-500 dark:bg-amber-400',
        label: 'Mismatch',
      };
    case 'missing_left':
      return {
        bg: 'border border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25',
        text: 'text-sky-800 dark:text-sky-200',
        dot: 'bg-sky-500 dark:bg-sky-400',
        label: 'Missing Left',
      };
    case 'missing_right':
      return {
        bg: 'border border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/25',
        text: 'text-violet-800 dark:text-violet-200',
        dot: 'bg-violet-500 dark:bg-violet-400',
        label: 'Missing Right',
      };
    case 'unkeyed_left':
      return {
        bg: 'border border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/25',
        text: 'text-rose-800 dark:text-rose-200',
        dot: 'bg-rose-500 dark:bg-rose-400',
        label: 'Unkeyed Left',
      };
    case 'unkeyed_right':
      return {
        bg: 'border border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/25',
        text: 'text-fuchsia-800 dark:text-fuchsia-200',
        dot: 'bg-fuchsia-500 dark:bg-fuchsia-400',
        label: 'Unkeyed Right',
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
