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

  it('lists the individual category items under Assurance Objects without All Objects', () => {
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

    expect(screen.queryByRole('button', { name: /^All Objects$/i })).toBeNull();
    const vesselsBtn = screen.getByRole('button', { name: /Vessels/i });
    const equipmentBtn = screen.getByRole('button', { name: /Equipment/i });
    const crewBtn = screen.getByRole('button', { name: /Crew Directory/i });
    const activitiesBtn = screen.getByRole('button', { name: /Activities/i });

    expect(vesselsBtn).toBeInTheDocument();
    expect(equipmentBtn).toBeInTheDocument();
    expect(crewBtn).toBeInTheDocument();
    expect(activitiesBtn).toBeInTheDocument();
  });

  it('opens Assurance Objects with Activities selected when clicking Activities', () => {
    render(<AppSidebar />);

    const activitiesBtn = screen.getByRole('button', { name: /Activities/i });
    fireEvent.click(activitiesBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('objects');
    expect(state.currentEntityId).toBe('activity');
  });

  it('navigates to vessels when clicking Vessels in sidebar', () => {
    render(<AppSidebar />);

    const vesselsBtn = screen.getByRole('button', { name: /Vessels/i });
    fireEvent.click(vesselsBtn);

    const state = useMapStore.getState();
    expect(state.currentHashView).toBe('vessels');
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

  it('renders Settings group and allows navigating to Roles & Permissions for Administrator', () => {
    render(<AppSidebar />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    const rolesPermissionsBtn = screen.getByRole('button', { name: /Roles & Permissions/i });
    expect(rolesPermissionsBtn).toBeInTheDocument();

    fireEvent.click(rolesPermissionsBtn);
    expect(useMapStore.getState().currentHashView).toBe('roles-permissions');
  });

  it('hides Assurance Objects group and Marketplace in sidebar for all non-admin roles (Submitter, Verifier, Inspector, Approver)', () => {
    const nonAdminRoles = ['Submitter', 'Verifier', 'Inspector', 'Approver'] as const;

    nonAdminRoles.forEach((role) => {
      cleanup();
      useMapStore.setState({
        isAuthenticated: true,
        activePersona: role,
        activeDemoOrganization: role === 'Submitter' ? 'Northwind Marine Pty Ltd' : 'Bureau Veritas Inspectorate',
        currentHashView: 'dashboard',
      });

      render(<AppSidebar />);

      // Assurance Objects group header and its child buttons must not be present
      expect(screen.queryByText('Assurance Objects')).toBeNull();
      expect(screen.queryByRole('button', { name: /Vessels/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Equipment/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Crew Directory/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Activities/i })).toBeNull();
      // Marketplace must not be present
      expect(screen.queryByRole('button', { name: /Marketplace/i })).toBeNull();
    });
  });

  it('keeps Assurance Objects group and Marketplace visible for Administrator as client (C Admin)', () => {
    cleanup();
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      currentHashView: 'dashboard',
    });

    render(<AppSidebar />);

    expect(screen.getByText('Assurance Objects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vessels/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Equipment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activities/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marketplace/i })).toBeInTheDocument();
  });
});
