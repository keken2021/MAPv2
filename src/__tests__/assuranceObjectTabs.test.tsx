import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AssuranceObjectsView } from '../views/AssuranceObjectsView';
import { useMapStore } from '../store/useMapStore';

describe('AssuranceObjectsView type filter', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('renders exactly the 6 options: All, Vessel, Person, Equipment, Procedure, Method and no tabs', () => {
    render(<AssuranceObjectsView />);

    expect(screen.queryByRole('tab')).toBeNull();

    const typeSelect = screen.getByRole('combobox', { name: 'Filter by type' });
    const options = within(typeSelect).getAllByRole('option');
    const optionLabels = options.map((opt) => opt.textContent?.replace(/\s*\(\d+\)$/, '').trim() || '');

    expect(optionLabels).toEqual([
      'All',
      'Vessel',
      'Person',
      'Equipment',
      'Procedure',
      'Method',
    ]);
  });

  it('does not render dropped options (Organizations, Documents)', () => {
    render(<AssuranceObjectsView />);

    const typeSelect = screen.getByRole('combobox', { name: 'Filter by type' });
    expect(within(typeSelect).queryByRole('option', { name: /Organizations/i })).toBeNull();
    expect(within(typeSelect).queryByRole('option', { name: /Documents/i })).toBeNull();
  });
});
