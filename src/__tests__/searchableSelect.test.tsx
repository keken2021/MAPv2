import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableSelect, SearchableSelectItem } from '../components/common/SearchableSelect';

const sampleItems: SearchableSelectItem[] = [
  { id: 'doc-1', label: 'Safety Management Certificate', hint: 'Statutory' },
  { id: 'doc-2', label: 'International Oil Pollution Prevention Certificate', hint: 'Environmental' },
  { id: 'doc-3', label: 'Continuous Synopsis Record', hint: 'Registry' },
];

describe('SearchableSelect component', () => {
  it('renders input with placeholder and accessibility attributes', () => {
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
        placeholder="Search documents..."
      />
    );

    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search documents...');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters items by label substring on input', () => {
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Safety Management Certificate')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Pollution' } });
    expect(screen.queryByText('Safety Management Certificate')).not.toBeInTheDocument();
    expect(screen.getByText('International Oil Pollution Prevention Certificate')).toBeInTheDocument();
  });

  it('filters items by hint substring', () => {
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Registry' } });
    expect(screen.getByText('Continuous Synopsis Record')).toBeInTheDocument();
    expect(screen.queryByText('Safety Management Certificate')).not.toBeInTheDocument();
  });

  it('selects an item on click and clears search query', () => {
    const onSelect = vi.fn();
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={onSelect}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Safety' } });
    const option = screen.getByText('Safety Management Certificate');
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleItems[0]);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates with keyboard and selects with Enter', () => {
    const onSelect = vi.fn();
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={onSelect}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Arrow down moves to second item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleItems[1]);
  });

  it('closes dropdown on Escape key', () => {
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows create row when query does not match any item exactly and onCreate is provided', () => {
    const onCreate = vi.fn();
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Towage Survey' } });

    const createOption = screen.getByText("Add 'Towage Survey' as a custom document");
    expect(createOption).toBeInTheDocument();

    fireEvent.click(createOption);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('Towage Survey');
  });

  it('selects create row with keyboard Enter when navigated to it', () => {
    const onCreate = vi.fn();
    render(
      <SearchableSelect
        items={sampleItems}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Unique Requirement' } });

    // Since no item matches, create row is the only option at index 0
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCreate).toHaveBeenCalledWith('Unique Requirement');
  });
});
