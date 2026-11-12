import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CrewGroupDetailView } from '../views/CrewGroupDetailView';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';

const initialState = useMapStore.getState();

describe('CrewGroupDetailView - Two Tabs & Master Roster Management (Task 5340)', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'Administrator',
        isAuthenticated: true,
        crewGroups: JSON.parse(JSON.stringify(MOCK_CREW_GROUPS)),
      },
      true,
    );
  });
  afterEach(cleanup);

  it('renders Details and specializations tab with metadata and specialization badges', () => {
    render(<CrewGroupDetailView groupId="CG-001" />);

    expect(screen.getByRole('heading', { name: 'Dive Team', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('CG-001')).toBeInTheDocument();
    expect(screen.getAllByText(/2 seafarers/i).length).toBeGreaterThanOrEqual(1);

    // Verify tabs
    const detailsTab = screen.getByRole('tab', { name: /details and specializations/i });
    const rosterTab = screen.getByRole('tab', { name: /roster/i });
    expect(detailsTab).toBeInTheDocument();
    expect(rosterTab).toBeInTheDocument();
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');

    // Specializations badges
    expect(screen.getAllByText('Subsea & Diving Operations').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Underwater Inspection')).toBeInTheDocument();
    expect(screen.getByText('Hyperbaric Safety')).toBeInTheDocument();
    expect(screen.getByText(/Specialist offshore diving and subsea inspection operations team/i)).toBeInTheDocument();
  });

  it('switches to Roster tab and renders current group members', () => {
    render(<CrewGroupDetailView groupId="CG-001" />);

    const rosterTab = screen.getByRole('tab', { name: /roster/i });
    fireEvent.click(rosterTab);

    expect(rosterTab).toHaveAttribute('aria-selected', 'true');

    const rosterTable = screen.getByTestId('crew-group-roster-table');
    expect(rosterTable).toBeInTheDocument();

    expect(within(rosterTable).getByText('Capt. Alexander Wright')).toBeInTheDocument();
    expect(within(rosterTable).getByText('Bosun David Kowalski')).toBeInTheDocument();
    expect(within(rosterTable).queryByText('Chief Off. Sarah Jenkins')).toBeNull();
  });

  it('allows Crew Provider to add a member and updates master group in store', () => {
    render(<CrewGroupDetailView groupId="CG-001" />);

    // Open Roster tab
    fireEvent.click(screen.getByRole('tab', { name: /roster/i }));

    const select = screen.getByLabelText(/add seafarer to roster/i);
    fireEvent.change(select, { target: { value: 'CREW-103' } });

    const addBtn = screen.getByRole('button', { name: /add to roster/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    // Member is now rendered in roster table
    const rosterTable = screen.getByTestId('crew-group-roster-table');
    expect(within(rosterTable).getByText('Chief Off. Sarah Jenkins')).toBeInTheDocument();

    // Verify store master group was updated
    const updatedGroup = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001');
    expect(updatedGroup?.memberIds).toContain('CREW-103');
    expect(updatedGroup?.memberIds).toHaveLength(3);
  });

  it('allows Crew Provider to remove a member and updates master group in store', () => {
    render(<CrewGroupDetailView groupId="CG-001" />);

    // Open Roster tab
    fireEvent.click(screen.getByRole('tab', { name: /roster/i }));

    const removeBtn = screen.getByRole('button', { name: 'Remove Bosun David Kowalski' });
    fireEvent.click(removeBtn);

    // Member removed from table
    const rosterTable = screen.getByTestId('crew-group-roster-table');
    expect(within(rosterTable).queryByText('Bosun David Kowalski')).toBeNull();

    // Verify store master group was updated
    const updatedGroup = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001');
    expect(updatedGroup?.memberIds).not.toContain('CREW-104');
    expect(updatedGroup?.memberIds).toEqual(['CREW-101']);
  });

  it('renders read-only roster without add/remove controls for non-Crew Provider persona', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
      assuranceSets: [
        {
          ...initialState.assuranceSets[0],
          id: 'AS-CG-RO-TEST',
          createdByUserId: 'USR-221',
          createdByName: 'C. Henderson',
          createdByPersona: 'C Admin',
          initiatorOrg: 'Chevron Australia Pty Ltd',
          clientOrg: 'Chevron Australia Pty Ltd',
          crewGroups: [
            {
              groupId: 'CG-001',
              groupName: 'Dive Team',
              specialization: 'Subsea & Diving Operations',
              memberIds: ['CREW-101', 'CREW-104'],
              addedAt: '2026-11-04T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    render(<CrewGroupDetailView groupId="CG-001" />);

    // Details tab has no Edit Details button
    expect(screen.queryByRole('button', { name: /edit details/i })).toBeNull();

    // Open Roster tab
    fireEvent.click(screen.getByRole('tab', { name: /roster/i }));

    // Read-only notice present
    expect(screen.getByText(/roster editing is restricted to crew provider/i)).toBeInTheDocument();

    // No add member form
    expect(screen.queryByLabelText(/add seafarer to roster/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /add to roster/i })).toBeNull();

    // No remove buttons
    expect(screen.queryByRole('button', { name: /^remove /i })).toBeNull();

    // Members still displayed
    const rosterTable = screen.getByTestId('crew-group-roster-table');
    expect(within(rosterTable).getByText('Capt. Alexander Wright')).toBeInTheDocument();
  });

  it('allows Crew Provider to edit details and specializations and saves to store', () => {
    render(<CrewGroupDetailView groupId="CG-001" />);

    const editBtn = screen.getByRole('button', { name: /edit details/i });
    fireEvent.click(editBtn);

    const nameInput = screen.getByLabelText(/^group name/i);
    fireEvent.change(nameInput, { target: { value: 'Elite Diving Squad' } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(screen.getByRole('heading', { name: 'Elite Diving Squad', level: 1 })).toBeInTheDocument();

    const updatedGroup = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001');
    expect(updatedGroup?.name).toBe('Elite Diving Squad');
  });

  it('shows not-found state when group ID does not exist', () => {
    render(<CrewGroupDetailView groupId="NON-EXISTENT" />);

    expect(screen.getByText('Crew Group Not Found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to crew directory/i })).toBeInTheDocument();
  });
});
