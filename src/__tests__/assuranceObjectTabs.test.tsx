import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssuranceObjectsView } from '../views/AssuranceObjectsView';
import { useMapStore } from '../store/useMapStore';

describe('AssuranceObjectsView tabs', () => {
  beforeEach(() => {
    useMapStore.setState({
      currentUser: {
        id: 'USR-ADMIN',
        name: 'Alex Admin',
        email: 'alex@map.com',
        role: 'Administrator',
        persona: 'Administrator',
        organization: 'Marine Assurance Platform',
      },
    });
  });

  it('renders exactly the 6 tabs: All, Vessels, Crew Directory, Equipment, Procedures, Methods', () => {
    render(<AssuranceObjectsView />);

    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((tab) => {
      const labelEl = tab.querySelector('.map-count-tab-label') || tab;
      return labelEl.textContent?.trim() || '';
    });

    expect(tabLabels).toEqual([
      'All',
      'Vessels',
      'Crew Directory',
      'Equipment',
      'Procedures',
      'Methods',
    ]);
  });

  it('does not render dropped tabs (Organizations, Documents, Persons)', () => {
    render(<AssuranceObjectsView />);

    expect(screen.queryByRole('tab', { name: /Organizations/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Documents/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Persons/i })).toBeNull();
  });
});
