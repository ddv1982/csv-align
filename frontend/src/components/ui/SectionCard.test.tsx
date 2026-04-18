import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SectionCard } from './SectionCard';

test('renders eyebrow, title, description, action, and children', () => {
  render(
    <SectionCard
      eyebrow="Step 2 · Configure"
      title="Manual column pairing"
      description="Select key and comparison columns."
      icon={<svg aria-hidden="true" data-testid="section-card-icon" />}
      action={<button type="button">Save pair order</button>}
    >
      <div>Card body</div>
    </SectionCard>,
  );

  expect(screen.getByText('Step 2 · Configure')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Manual column pairing' })).toBeInTheDocument();
  expect(screen.getByText('Select key and comparison columns.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save pair order' })).toBeInTheDocument();
  expect(screen.getByText('Card body')).toBeInTheDocument();
  expect(screen.getByTestId('section-card-icon')).toBeInTheDocument();
});

test('supports alternate heading levels and the info tone', () => {
  const { container } = render(
    <SectionCard
      eyebrow="Read-only snapshot"
      title="Snapshot loaded in read-only mode"
      headingLevel="h2"
      tone="info"
      icon={<svg aria-hidden="true" />}
    >
      <div>Snapshot body</div>
    </SectionCard>,
  );

  expect(screen.getByRole('heading', { level: 2, name: 'Snapshot loaded in read-only mode' })).toBeInTheDocument();
  expect(container.querySelector('p.text-sky-700')).toBeTruthy();
  expect(container.querySelector('div.bg-sky-100')).toBeTruthy();
});

test('applies custom root classes', () => {
  const { container } = render(
    <SectionCard
      eyebrow="Results filter"
      title="Focus on the rows you care about"
      className="border-sky-200 bg-sky-50"
      icon={<svg aria-hidden="true" />}
    >
      <div>Filters</div>
    </SectionCard>,
  );

  expect(container.firstElementChild).toHaveClass('border-sky-200');
  expect(container.firstElementChild).toHaveClass('bg-sky-50');
});
