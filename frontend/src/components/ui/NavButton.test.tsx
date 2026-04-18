import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NavButton } from './NavButton';

test('renders a back navigation button with the glyph before the label', () => {
  render(<NavButton direction="back">Back to configuration</NavButton>);

  const button = screen.getByRole('button', { name: 'Back to configuration' });
  expect(button.firstElementChild).toHaveTextContent('<<');
  expect(button).toHaveTextContent('Back to configuration');
});

test('renders a forward navigation button with the glyph after the label and forwards clicks', () => {
  const handleClick = vi.fn();

  render(
    <NavButton direction="forward" onClick={handleClick}>
      Continue to configuration
    </NavButton>,
  );

  const button = screen.getByRole('button', { name: 'Continue to configuration' });
  expect(button.lastElementChild).toHaveTextContent('>>');

  fireEvent.click(button);
  expect(handleClick).toHaveBeenCalledTimes(1);
});
