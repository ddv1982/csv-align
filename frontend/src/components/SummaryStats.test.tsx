import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SummaryStats } from './SummaryStats';
import type { SummaryResponse } from '../types/api';

const SUMMARY: SummaryResponse = {
  total_rows_a: 12,
  total_rows_b: 11,
  matches: 6,
  mismatches: 2,
  missing_left: 1,
  missing_right: 1,
  unkeyed_left: 3,
  unkeyed_right: 2,
  duplicates_a: 0,
  duplicates_b: 1,
};

test('separates ignored rows from comparable summary stats', () => {
  render(
    <SummaryStats
      summary={SUMMARY}
      fileAName="file-a.csv"
      fileBName="file-b.csv"
    />,
  );

  expect(screen.getByText('Match rate of comparable rows')).toBeInTheDocument();
  expect(screen.getByText('Only in File A')).toBeInTheDocument();
  expect(screen.getByText('Only in File B')).toBeInTheDocument();
  expect(screen.getByText('Ignored rows')).toBeInTheDocument();
  expect(screen.getByText('2 in File A, 3 in File B')).toBeInTheDocument();
  expect(screen.getByText('Ignored rows were not compared because the selected key was empty or matched a missing-value token after cleanup settings.')).toBeInTheDocument();
  expect(screen.getByText('Ignored rows may correspond to one-sided results on the other file, but they could not be matched confidently by key.')).toBeInTheDocument();
  expect(screen.queryByText('Unkeyed Left')).not.toBeInTheDocument();
  expect(screen.queryByText('Unkeyed Right')).not.toBeInTheDocument();
});

test('keeps summary chips on semantic bordered surfaces', () => {
  render(
    <SummaryStats
      summary={SUMMARY}
      fileAName="file-a.csv"
      fileBName="file-b.csv"
    />,
  );

  const matchesCard = screen.getByText('Matches').closest('.summary-stat');
  const ignoredBanner = screen.getByText('Ignored rows').closest('.summary-banner');

  expect(matchesCard).toBeTruthy();
  expect(ignoredBanner).toBeTruthy();
  expect(matchesCard).toHaveClass('summary-stat');
  expect(ignoredBanner).toHaveClass('summary-banner');
});

test('renders icon-based section markers while keeping A/B identifiers for file-specific outcomes', () => {
  const { container } = render(
    <SummaryStats
      summary={SUMMARY}
      fileAName="file-a.csv"
      fileBName="file-b.csv"
    />,
  );

  const heading = screen.getByRole('heading', { level: 3, name: 'Comparison Summary' });
  const resultsSection = heading.closest('section');
  const fileAOnlyCard = screen.getByText('Only in File A').closest('.summary-stat');
  const fileBOnlyCard = screen.getByText('Only in File B').closest('.summary-stat');

  expect(heading).toBeInTheDocument();
  expect(resultsSection?.querySelector('svg')).not.toBeNull();
  expect(fileAOnlyCard).toHaveTextContent('A');
  expect(fileBOnlyCard).toHaveTextContent('B');
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
});
