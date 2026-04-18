import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SectionCard } from './SectionCard';

test('renders eyebrow, title, description, action, and children', () => {
  render(
    <SectionCard
      eyebrow="Step 2 · Configure"
      title="Manual column pairing"
      description="Select key and comparison columns."
      icon={<span aria-hidden="true" data-testid="section-card-icon">::</span>}
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
  render(
    <SectionCard
      eyebrow="Read-only snapshot"
      title="Snapshot loaded in read-only mode"
      headingLevel="h2"
      tone="info"
      icon={<span aria-hidden="true">!!</span>}
    >
      <div>Snapshot body</div>
    </SectionCard>,
  );

  expect(screen.getByRole('heading', { level: 2, name: 'Snapshot loaded in read-only mode' })).toBeInTheDocument();
  expect(screen.getByText('Read-only snapshot')).toHaveClass('text-[color:var(--color-kinetic-accent-2)]');
  expect(screen.getByText('!!')).toBeInTheDocument();
});

test('applies tone-aware title and description classes for primary and info variants', () => {
  const { rerender } = render(
    <SectionCard
      eyebrow="Step 2 · Configure"
      title="Primary card"
      description="Primary description"
      tone="primary"
      icon={<span aria-hidden="true">ST</span>}
    >
      <div>Primary body</div>
    </SectionCard>,
  );

  expect(screen.getByRole('heading', { level: 3, name: 'Primary card' })).toHaveClass('text-[color:var(--color-kinetic-copy)]');
  expect(screen.getByText('Primary description')).toHaveClass('text-[color:var(--color-kinetic-muted)]');

  rerender(
    <SectionCard
      eyebrow="Read-only snapshot"
      title="Info card"
      description="Info description"
      tone="info"
      icon={<span aria-hidden="true">IN</span>}
    >
      <div>Info body</div>
    </SectionCard>,
  );

  expect(screen.getByRole('heading', { level: 3, name: 'Info card' })).toHaveClass('text-[color:var(--color-kinetic-copy)]');
  expect(screen.getByText('Info description')).toHaveClass('text-[color:var(--color-kinetic-muted)]');
});

test('applies custom root classes', () => {
  const { container } = render(
    <SectionCard
      eyebrow="Results filter"
      title="Focus on the rows you care about"
      className="border-sky-200 bg-sky-50"
      icon={<span aria-hidden="true">FL</span>}
    >
      <div>Filters</div>
    </SectionCard>,
  );

  expect(container.firstElementChild).toHaveClass('border-sky-200');
  expect(container.firstElementChild).toHaveClass('bg-sky-50');
});

test('omits the body spacer when children is null', () => {
  const { container } = render(
    <SectionCard eyebrow="Read-only snapshot" title="Header only" icon={<span aria-hidden="true">HD</span>}>
      {null}
    </SectionCard>,
  );

  expect(screen.queryByText('Header only')).toBeInTheDocument();
  expect(container.querySelector('.mt-5')).toBeNull();
});

test('omits the body spacer when children is omitted', () => {
  const { container } = render(
    <SectionCard eyebrow="Read-only snapshot" title="Header only" icon={<span aria-hidden="true">HD</span>} />,
  );

  expect(screen.queryByText('Header only')).toBeInTheDocument();
  expect(container.querySelector('.mt-5')).toBeNull();
});
