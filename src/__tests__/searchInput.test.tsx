import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../components/common/SearchInput';

describe('SearchInput component', () => {
  it('renders search input with aria-label, placeholder, leading icon, and pass-through props', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SearchInput
        value=""
        onChange={handleChange}
        placeholder="Search projects..."
        aria-label="Filter project records"
        id="project-search-input"
        data-testid="search-input"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Filter project records' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search projects...');
    expect(input).toHaveAttribute('id', 'project-search-input');
    expect(input).toHaveClass('map-list-toolbar-search-input');

    const icon = container.querySelector('.position-relative > svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveStyle({ left: '12px' });
  });

  it('triggers onChange on typing', () => {
    const handleChange = vi.fn();
    render(
      <SearchInput
        value="Alpha"
        onChange={handleChange}
        placeholder="Search fleet..."
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search fleet...' });
    expect(input).toHaveValue('Alpha');

    fireEvent.change(input, { target: { value: 'Bravo' } });
    expect(handleChange).toHaveBeenCalledWith('Bravo');
  });

  it('shows clear (x) button when value is present and clears on click', () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    const { rerender } = render(
      <SearchInput
        value=""
        onChange={handleChange}
        onClear={handleClear}
        placeholder="Search crew..."
      />
    );

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    rerender(
      <SearchInput
        value="Captain"
        onChange={handleChange}
        onClear={handleClear}
        placeholder="Search crew..."
      />
    );

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('supports forwarded ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<SearchInput ref={ref} value="test" onChange={vi.fn()} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe('test');
  });
});
