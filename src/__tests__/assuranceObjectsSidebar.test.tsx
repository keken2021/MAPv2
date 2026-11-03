import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppSidebar } from '../components/layout/AppSidebar';
import { AssuranceObjectsView } from '../views/AssuranceObjectsView';
import { useMapStore } from '../store/useMapStore';

describe('Assurance objects sidebar and settings suite', () => {
  beforeEach(() => {
    cleanup();
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      currentHashView: 'dashboard',
      currentEntityId: undefined,
      previousHashView: undefined,
      previousEntityId: undefined,
    });
  });

  it('lists exactly the 6 items under Assurance Objects matching the object tabs', () => {
    const { unmount: unmountTabs } = render(<AssuranceObjectsView />);
    const tabElements = screen.getAllByRole('tab');
    const tabLabels = tabElements.map((tab) => {
      const label = tab.querySelector('.map-count-tab-label') || tab;
      return label.textContent?.trim() || '';
    });
    expect(tabLabels).toEqual([
      'All',
      'Vessels',
      'Crew Directory',
      'Equipment',
      'Procedures',
      'Methods',
    ]);
    unmountTabs();

    cleanup();
    render(<AppSidebar />);

    const objectsBtn = screen.getByRole('button', { name: /All Objects/i });
    const vesselsBtn = screen.getByRole('button', { name: /Vessels/i });
    const equipmentBtn = screen.getByRole('button', { name: /Equipment/i });
    const crewBtn = screen.getByRole('button', { name: /Crew Directory/i });
    const proceduresBtn = screen.getByRole('button', { name: /Procedures/i });
    const methodsBtn = screen.getByRole('button', { name: /Methods/i });

    expect(objectsBtn).toBeInTheDocument();
    expect(vesselsBtn).toBeInTheDocument();
    expect(equipmentBtn).toBeInTheDocument();
    expect(crewBtn).toBeInTheDocument();
    expect(proceduresBtn).toBeInTheDocument();
    expect(methodsBtn).toBeInTheDocument();

    const expectedTabBySidebarLabel: Record<string, string> = {
      'All Objects': 'All',
      Vessels: 'Vessels',
      Equipment: 'Equipment',
      'Crew Directory': 'Crew Directory',
      Procedures: 'Procedures',
      Methods: 'Methods',
    };

    Object.entries(expectedTabBySidebarLabel).forEach(([, tabName]) => {
      expect(tabLabels).toContain(tabName);
    });
  });

  it('opens Assurance Objects with Procedures selected when clicking Procedures', () => {
    render(<AppSidebar />);

    const proceduresBtn = screen.getByRole('button', { name: /Procedures/i });
    fireEvent.click(proceduresBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
    expect(state.currentEntityId).toBe('procedure');
  });

  it('opens Assurance Objects with Methods selected when clicking Methods', () => {
    render(<AppSidebar />);

    const methodsBtn = screen.getByRole('button', { name: /Methods/i });
    fireEvent.click(methodsBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
    expect(state.currentEntityId).toBe('method');
  });

  it('opens Assurance Objects all view when clicking All Objects', () => {
    useMapStore.setState({
      currentHashView: 'objects',
      currentEntityId: 'procedure',
    });

    render(<AppSidebar />);

    const objectsBtn = screen.getByRole('button', { name: /All Objects/i });
    fireEvent.click(objectsBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
    expect(state.currentEntityId).toBeUndefined();
  });

  it('renders Organization profile under Settings and navigates to organization-profile', () => {
    render(<AppSidebar />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    const orgProfileBtn = screen.getByRole('button', { name: /Organization profile/i });
    expect(orgProfileBtn).toBeInTheDocument();

    fireEvent.click(orgProfileBtn);
    expect(useMapStore.getState().currentHashView).toBe('organization-profile');
  });

  it('shows Organization profile in Settings for non-admin personas', () => {
    useMapStore.setState({ activePersona: 'Verifier' });

    render(<AppSidebar />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Organization profile/i })).toBeInTheDocument();
  });
});
