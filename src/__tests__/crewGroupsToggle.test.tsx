import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CrewTable } from '../components/tables/CrewTable';
import { CrewView } from '../views/CrewView';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';

const initialState = useMapStore.getState();

describe('Crew Directory - Individuals and Groups Toggle (Task 5339)', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'Administrator',
        isAuthenticated: true,
        crewGroups: [...MOCK_CREW_GROUPS],
      },
      true,
    );
  });
  afterEach(cleanup);

  it('renders the [ Individuals ] / [ Groups ] toggle and defaults to individuals table', () => {
    render(<CrewTable onSelectCrew={() => {}} />);

    const individualsBtn = screen.getByRole('button', { name: 'Individuals' });
    const groupsBtn = screen.getByRole('button', { name: 'Groups' });

    expect(individualsBtn).toBeInTheDocument();
    expect(groupsBtn).toBeInTheDocument();
    expect(individualsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(groupsBtn).toHaveAttribute('aria-pressed', 'false');

    // Individuals table visible, groups table not present
    expect(screen.getByTestId('crew-individuals-table')).toBeInTheDocument();
    expect(screen.queryByTestId('crew-groups-table')).toBeNull();
    expect(screen.getByText('Capt. Alexander Wright')).toBeInTheDocument();
  });

  it('switches to groups table when clicking [ Groups ]', () => {
    render(<CrewTable onSelectCrew={() => {}} />);

    const groupsBtn = screen.getByRole('button', { name: 'Groups' });
    fireEvent.click(groupsBtn);

    expect(groupsBtn).toHaveAttribute('aria-pressed', 'true');
    const groupsTable = screen.getByTestId('crew-groups-table');
    expect(groupsTable).toBeInTheDocument();
    expect(screen.queryByTestId('crew-individuals-table')).toBeNull();

    // Groups table lists name, specialization, and member count
    expect(within(groupsTable).getByText('Dive Team')).toBeInTheDocument();
    expect(within(groupsTable).getByText('Subsea & Diving Operations')).toBeInTheDocument();
    expect(within(groupsTable).getByText('2 members')).toBeInTheDocument();

    expect(within(groupsTable).getByText('Survey Team')).toBeInTheDocument();
    expect(within(groupsTable).getByText('Hydrographic Survey')).toBeInTheDocument();
    expect(within(groupsTable).getByText('3 members')).toBeInTheDocument();
  });

  it('switches back to individuals table when clicking [ Individuals ]', () => {
    render(<CrewTable onSelectCrew={() => {}} initialMode="groups" />);

    expect(screen.getByTestId('crew-groups-table')).toBeInTheDocument();

    const individualsBtn = screen.getByRole('button', { name: 'Individuals' });
    fireEvent.click(individualsBtn);

    expect(individualsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('crew-individuals-table')).toBeInTheDocument();
    expect(screen.queryByTestId('crew-groups-table')).toBeNull();
    expect(screen.getByText('Capt. Alexander Wright')).toBeInTheDocument();
  });

  it('filters groups by search term and resets with control set', () => {
    render(<CrewTable onSelectCrew={() => {}} initialMode="groups" />);

    const searchInput = screen.getByPlaceholderText('Search groups...');
    fireEvent.change(searchInput, { target: { value: 'Dive' } });

    expect(screen.getByText('Dive Team')).toBeInTheDocument();
    expect(screen.queryByText('Survey Team')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Dive Team')).toBeInTheDocument();
    expect(screen.getByText('Survey Team')).toBeInTheDocument();
  });

  it('calls onSelectGroup when clicking a group row or view button', () => {
    const handleSelectGroup = vi.fn();
    render(<CrewTable onSelectCrew={() => {}} onSelectGroup={handleSelectGroup} initialMode="groups" />);

    const diveTeamRow = screen.getByText('Dive Team').closest('tr');
    expect(diveTeamRow).not.toBeNull();
    fireEvent.click(diveTeamRow!);

    expect(handleSelectGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'CG-001',
        name: 'Dive Team',
      }),
    );
  });

  it('renders correctly inside CrewView', () => {
    render(<CrewView />);

    expect(screen.getByRole('button', { name: 'Individuals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    expect(screen.getByText('Dive Team')).toBeInTheDocument();
    expect(screen.getByText('Survey Team')).toBeInTheDocument();
  });
});
