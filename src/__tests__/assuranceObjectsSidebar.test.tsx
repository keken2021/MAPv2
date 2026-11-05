import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('lists exactly the 5 items under Assurance Objects matching the object type options', () => {
    const { unmount: unmountView } = render(<AssuranceObjectsView />);
    const typeSelect = screen.getByRole('combobox', { name: 'Filter by type' });
    const optionElements = within(typeSelect).getAllByRole('option');
    const optionLabels = optionElements.map((opt) => opt.textContent?.replace(/\s*\(\d+\)$/, '').trim() || '');
    expect(optionLabels).toEqual([
      'All',
      'Vessel',
      'Person',
      'Equipment',
      'Activity',
    ]);
    unmountView();

    cleanup();
    render(<AppSidebar />);

    const objectsBtn = screen.getByRole('button', { name: /All Objects/i });
    const vesselsBtn = screen.getByRole('button', { name: /Vessels/i });
    const equipmentBtn = screen.getByRole('button', { name: /Equipment/i });
    const crewBtn = screen.getByRole('button', { name: /Crew Directory/i });
    const activitiesBtn = screen.getByRole('button', { name: /Activities/i });

    expect(objectsBtn).toBeInTheDocument();
    expect(vesselsBtn).toBeInTheDocument();
    expect(equipmentBtn).toBeInTheDocument();
    expect(crewBtn).toBeInTheDocument();
    expect(activitiesBtn).toBeInTheDocument();

    const expectedOptionBySidebarLabel: Record<string, string> = {
      'All Objects': 'All',
      Vessels: 'Vessel',
      Equipment: 'Equipment',
      'Crew Directory': 'Person',
      Activities: 'Activity',
    };

    Object.entries(expectedOptionBySidebarLabel).forEach(([, optName]) => {
      expect(optionLabels).toContain(optName);
    });
  });

  it('opens Assurance Objects with Activities selected when clicking Activities', () => {
    render(<AppSidebar />);

    const activitiesBtn = screen.getByRole('button', { name: /Activities/i });
    fireEvent.click(activitiesBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
    expect(state.currentEntityId).toBe('activity');
  });

  it('opens Assurance Objects all view when clicking All Objects', () => {
    useMapStore.setState({
      currentHashView: 'objects',
      currentEntityId: 'activity',
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
