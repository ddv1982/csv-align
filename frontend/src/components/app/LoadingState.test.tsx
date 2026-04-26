import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { LoadingState } from './LoadingState';

test('exposes polite status semantics while loading', () => {
  render(<LoadingState />);

  const status = screen.getByRole('status');
  expect(status).toHaveAttribute('aria-live', 'polite');
  expect(status).toHaveAttribute('aria-busy', 'true');
  expect(status).toHaveTextContent('Loading comparison data');
  expect(screen.getByText('SYNC')).toHaveAttribute('aria-hidden', 'true');
});
