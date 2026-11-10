import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';
import { clickNext, objectRowIds, pickReviewerRoles, removeObjectRow, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('CreateAssuranceSetView - Crew Group Picking & Member Snapshot (Task 5341)', () => {
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

  it('renders crew group pickers in wizard Step 2 (Objects tab)', () => {
    const { container } = renderWizardWithDefaultVessel();
    pickReviewerRoles(container);
    clickNext();
    /* the handed-over vessel sets the vendor; removing it frees the crew group picker for every organization */
    removeObjectRow(container, objectRowIds(container)[0]);

    const headerGroupSelect = container.querySelector('#wizard-pick-crew-group') as HTMLSelectElement;
    expect(headerGroupSelect).not.toBeNull();
    expect(headerGroupSelect.options.length).toBeGreaterThanOrEqual(2);

    const typeSelect = container.querySelector('#grid-add-object-type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'person' } });

    const gridGroupSelect = container.querySelector('#grid-pick-crew-group') as HTMLSelectElement;
    expect(gridGroupSelect).not.toBeNull();
    expect(screen.getByText(/or pick an entire group/i)).toBeInTheDocument();
  });

  it('picking a group adds all member seafarers to the objects table and displays snapshot bar', () => {
    const { container } = renderWizardWithDefaultVessel();
    pickReviewerRoles(container);
    clickNext();
    /* the handed-over vessel sets the vendor; removing it frees the crew group picker for every organization */
    removeObjectRow(container, objectRowIds(container)[0]);

    // Select Dive Team (CG-001: CREW-101 and CREW-104)
    const headerGroupSelect = container.querySelector('#wizard-pick-crew-group') as HTMLSelectElement;
    fireEvent.change(headerGroupSelect, { target: { value: 'CG-001' } });

    const rowIds = objectRowIds(container);
    expect(rowIds).toContain('CREW-101');
    expect(rowIds).toContain('CREW-104');

    const groupBadgeBar = screen.getByTestId('selected-crew-groups-bar');
    expect(groupBadgeBar).toBeInTheDocument();
    expect(groupBadgeBar).toHaveTextContent('Dive Team');
    expect(groupBadgeBar).toHaveTextContent('2 members snapshot');
  });

  it('copies member snapshot at creation and preserves snapshot when master roster changes', () => {
    const { container } = renderWizardWithDefaultVessel();
    pickReviewerRoles(container);

    // Step 1: Set unique title
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Dive Operations Multi-Member Set' } });

    // Step 2: Objects
    clickNext();
    /* the handed-over vessel sets the vendor; removing it frees the crew group picker for every organization */
    removeObjectRow(container, objectRowIds(container)[0]);

    // Pick Survey Team (CG-002: CREW-102 and CREW-103)
    const headerGroupSelect = container.querySelector('#wizard-pick-crew-group') as HTMLSelectElement;
    fireEvent.change(headerGroupSelect, { target: { value: 'CG-002' } });

    const rowIds = objectRowIds(container);
    expect(rowIds).toContain('CREW-102');
    expect(rowIds).toContain('CREW-103');
    expect(rowIds).toContain('CREW-105');
    fireEvent.click(screen.getByRole('button', { name: /^1\s*General/ }));
    pickReviewerRoles(container);
    clickNext();

    // Step 3: Requirements
    clickNext();

    // Step 4: Review
    clickNext();

    expect(screen.getByTestId('review-crew-groups-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('review-crew-groups-snapshot')).toHaveTextContent('Survey Team');

    // Create Assurance Set
    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    fireEvent.click(createBtn);

    // Verify set was added to store with crewGroups snapshot
    const savedSet = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Dive Operations Multi-Member Set');
    expect(savedSet).toBeDefined();
    expect(savedSet?.crewGroups).toBeDefined();
    expect(savedSet?.crewGroups).toHaveLength(1);

    const snapshot = savedSet?.crewGroups?.[0];
    expect(snapshot?.groupId).toBe('CG-002');
    expect(snapshot?.groupName).toBe('Survey Team');
    expect(snapshot?.memberIds).toEqual(['CREW-102', 'CREW-103', 'CREW-105']);

    // Now mutate master crew group in store (add CREW-106 and remove CREW-102)
    act(() => {
      useMapStore.getState().addMemberToCrewGroup('CG-002', 'CREW-106');
      useMapStore.getState().removeMemberFromCrewGroup('CG-002', 'CREW-102');
    });

    const masterGroup = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-002');
    expect(masterGroup?.memberIds).toEqual(['CREW-103', 'CREW-105', 'CREW-106']);

    // Verify the set snapshot remains untouched with original members
    const setAfterRosterChange = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Dive Operations Multi-Member Set');
    expect(setAfterRosterChange?.crewGroups?.[0].memberIds).toEqual(['CREW-102', 'CREW-103', 'CREW-105']);
  });
});
