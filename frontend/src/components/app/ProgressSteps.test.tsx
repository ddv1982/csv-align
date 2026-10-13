import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ProgressSteps } from './ProgressSteps';

test('uses shared theme surface classes for active, complete, and unlocked steps', () => {
  render(
    <ProgressSteps
      step="configure"
      unlockedSteps={['select', 'configure', 'results']}
      onStepChange={vi.fn()}
    />,
  );

  expect(screen.getByText('2')).toHaveClass('app-surface-accent');
  expect(screen.getByText('1')).toHaveClass('app-surface-success');
  expect(screen.getByText('3')).toHaveClass('app-surface-subtle');

  const stepOneButton = screen.getByRole('button', { name: 'Go to step 1: Choose Files' });
  expect(stepOneButton).toHaveClass('app-surface-hover');
});

test('navigates only for unlocked non-active steps', () => {
  const onStepChange = vi.fn();

  render(
    <ProgressSteps
      step="select"
      unlockedSteps={['select', 'configure']}
      onStepChange={onStepChange}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Go to step 2: Configure' }));

  expect(onStepChange).toHaveBeenCalledWith('configure');
  expect(screen.queryByRole('button', { name: 'Go to step 3: Results' })).not.toBeInTheDocument();
});

test('centers steps on narrow screens and left-aligns them on desktop', () => {
  render(
    <ProgressSteps
      step="configure"
      unlockedSteps={['select', 'configure', 'results']}
      onStepChange={vi.fn()}
    />,
  );

  for (const label of ['Step 1', 'Step 2', 'Step 3']) {
    expect(screen.getByText(label).closest('.workflow-step')).toHaveClass('text-center', 'sm:text-left');
  }
});

test('keeps a consistent step container width for active and navigable steps', () => {
  render(
    <ProgressSteps
      step="configure"
      unlockedSteps={['select', 'configure', 'results']}
      onStepChange={vi.fn()}
    />,
  );

  expect(screen.getByRole('list')).toHaveClass('grid', 'grid-cols-3');
  expect(screen.getByRole('button', { name: 'Go to step 1: Choose Files' })).toHaveClass('w-full', 'min-w-0');
  expect(screen.getByText('Step 2').closest('div')).toHaveClass('w-full', 'min-w-0');
  expect(screen.getByRole('button', { name: 'Go to step 3: Results' })).toHaveClass('w-full', 'min-w-0');
});

test('uses normal app typography instead of HUD styling for step copy', () => {
  render(
    <ProgressSteps
      step="configure"
      unlockedSteps={['select', 'configure', 'results']}
      onStepChange={vi.fn()}
    />,
  );

  expect(screen.getByText('Step 1')).not.toHaveClass('hud-label');
  expect(screen.getByText('Step 1')).toHaveClass('text-xs', 'font-medium', 'text-app-muted');
  const firstLabel = screen.getByText('Choose Files');
  const firstBadge = screen.getByText('1');

  expect(firstLabel).toHaveClass('text-xs', 'sm:text-sm', 'font-semibold', 'tracking-tight');
  expect(firstLabel).not.toHaveClass('uppercase');
  expect(firstLabel).not.toHaveClass('tracking-[0.14em]');
  expect(firstBadge).toHaveClass('text-sm', 'font-semibold');
  expect(firstBadge).not.toHaveClass('font-mono');
  expect(firstBadge).not.toHaveClass('uppercase');
  expect(firstBadge).not.toHaveClass('tracking-[0.18em]');
});
