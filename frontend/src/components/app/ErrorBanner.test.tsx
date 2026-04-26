import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ErrorBanner } from './ErrorBanner';

test('announces errors as an assertive alert', () => {
  render(<ErrorBanner error="Something went wrong" />);

  const alert = screen.getByRole('alert');
  expect(alert).toHaveAttribute('aria-live', 'assertive');
  expect(alert).toHaveTextContent('Something went wrong');
});
