import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { AssuranceSet } from '../types/assurance';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';

const initialState = useMapStore.getState();
const baseSet = initialState.assuranceSets[0] || ({} as AssuranceSet);

const TEST_SET_EXCLUDE_RESTORE: AssuranceSet = {
  ...baseSet,
  id: 'AS-TEST-EXCLUDE-RESTORE',
  title: 'Subsea Inspection Campaign Beta',
  stage: 'Verification',
  assuranceType: 'Crew',
  subtypes: ['Crew'],
  vesselName: 'Pacific Responder',
  clientOrg: 'Chevron Australia Pty Ltd',
  serviceProviderOrg: 'Tidewater Marine',
  crewGroups: [
    {
      groupId: 'CG-001',
      groupName: 'Dive Team Alpha',
      specialization: 'Subsea & Diving Operations',
      memberIds: ['CREW-101', 'CREW-104'],
      addedAt: '2026-11-04T00:00:00.000Z',
    },
  ],
  assuranceObjects: [
    {
      id: 'VESSEL-001',
      name: 'Pacific Responder',
      type: 'vessel',
      ownerOrganization: 'Tidewater Marine',
      identifier: 'IMO: 9123456',
    },
    {
      id: 'CREW-101',
      name: 'Capt. James Ward',
      type: 'person',
      ownerOrganization: 'Tidewater Marine',
      identifier: 'CREW-101',
    },
    {
      id: 'CREW-104',
      name: 'Elena Rostova',
      type: 'person',
      ownerOrganization: 'Tidewater Marine',
      identifier: 'CREW-104',
    },
  ],
  requirements: [
    {
      id: 'REQ-1',
      title: 'STCW Certificate of Competency',
      category: 'statutory',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 100,
      targetObjectId: 'CREW-101',
      verifierStatus: 'Verified',
    },
    {
      id: 'REQ-2',
      title: 'Commercial Diving Medical',
      category: 'statutory',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 100,
      targetObjectId: 'CREW-104',
      verifierStatus: 'Verified',
    },
  ],
  targetDate: '2027-01-01',
};

describe('Crew Groups - Exclude and Restore a Member in a Set (Task 5343)', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
        isAuthenticated: true,
        crewGroups: JSON.parse(JSON.stringify(MOCK_CREW_GROUPS)),
        assuranceSets: [JSON.parse(JSON.stringify(TEST_SET_EXCLUDE_RESTORE)), ...initialState.assuranceSets],
      },
      true,
    );
  });

  afterEach(cleanup);

  it('allows Administrator to exclude a member with a required reason', () => {
    render(<AssuranceDetailView setId="AS-TEST-EXCLUDE-RESTORE" initialTab="objects" />);

    // Expand the group
    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    fireEvent.click(toggleBtn);

    // Initial check: both members present, neither is excluded
    expect(screen.getByText('Capt. James Ward')).toBeInTheDocument();
    expect(screen.queryByTestId('member-excluded-badge-CREW-101')).not.toBeInTheDocument();

    // Click exclude on CREW-101
    const excludeBtn = screen.getByTestId('exclude-member-btn-CREW-101');
    fireEvent.click(excludeBtn);

    // Modal appears
    expect(screen.getByText('Exclude Seafarer from Set')).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('confirm-exclude-btn');
    expect(confirmBtn).toBeDisabled();

    // Fill in required reason
    const reasonInput = screen.getByTestId('exclude-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Transferred to shore standby' } });
    expect(confirmBtn).not.toBeDisabled();

    // Confirm exclusion
    fireEvent.click(confirmBtn);

    // Modal closed
    expect(screen.queryByText('Exclude Seafarer from Set')).not.toBeInTheDocument();

    // Member row is now marked excluded
    const excludedBadge = screen.getByTestId('member-excluded-badge-CREW-101');
    expect(excludedBadge).toBeInTheDocument();
    expect(screen.getByText('Transferred to shore standby')).toBeInTheDocument();

    // Roll-up verification reflects only 1 active member
    const rollupBadge = screen.getByTestId('group-rollup-CG-001');
    expect(rollupBadge).toHaveTextContent('1/1 verified');
  });

  it('allows Administrator to restore an excluded member', () => {
    const setWithExclusion: AssuranceSet = {
      ...TEST_SET_EXCLUDE_RESTORE,
      memberExclusions: [
        {
          memberId: 'CREW-101',
          reason: 'Transferred to shore standby',
          excludedBy: 'Administrator',
          excludedAt: '2026-11-04T00:00:00.000Z',
          restored: false,
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [setWithExclusion, ...initialState.assuranceSets],
    });

    render(<AssuranceDetailView setId="AS-TEST-EXCLUDE-RESTORE" initialTab="objects" />);

    // Expand group
    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    fireEvent.click(toggleBtn);

    // Currently excluded
    expect(screen.getByTestId('member-excluded-badge-CREW-101')).toBeInTheDocument();

    // Click restore
    const restoreBtn = screen.getByTestId('restore-member-btn-CREW-101');
    expect(restoreBtn).toBeInTheDocument();
    fireEvent.click(restoreBtn);

    // Excluded badge is removed, member is restored
    expect(screen.queryByTestId('member-excluded-badge-CREW-101')).not.toBeInTheDocument();

    // Roll-up reflects both members active
    const rollupBadge = screen.getByTestId('group-rollup-CG-001');
    expect(rollupBadge).toHaveTextContent('2/2 verified');
  });

  it('prevents excluding the last active member of a group', () => {
    const setWithOneExcluded: AssuranceSet = {
      ...TEST_SET_EXCLUDE_RESTORE,
      memberExclusions: [
        {
          memberId: 'CREW-101',
          reason: 'On sick leave',
          excludedBy: 'Administrator',
          excludedAt: '2026-11-04T00:00:00.000Z',
          restored: false,
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [setWithOneExcluded, ...initialState.assuranceSets],
    });

    render(<AssuranceDetailView setId="AS-TEST-EXCLUDE-RESTORE" initialTab="objects" />);

    // Expand group
    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    fireEvent.click(toggleBtn);

    // CREW-104 is the only remaining active member in the group
    const lastMemberExcludeBtn = screen.getByTestId('exclude-member-btn-CREW-104');
    expect(lastMemberExcludeBtn).toBeDisabled();
    expect(lastMemberExcludeBtn).toHaveAttribute('title', 'The last member of a group cannot be excluded');
  });

  it('keeps master crew group completely isolated and deep-equal before and after', () => {
    const masterGroupBefore = JSON.parse(
      JSON.stringify(useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001')),
    );

    // Exclude via store action
    useMapStore.getState().excludeGroupMember(
      'AS-TEST-EXCLUDE-RESTORE',
      'CREW-101',
      'Operational replacement',
      'Administrator',
    );

    const masterGroupAfterExclude = JSON.parse(
      JSON.stringify(useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001')),
    );
    expect(masterGroupAfterExclude).toEqual(masterGroupBefore);

    // Restore via store action
    useMapStore.getState().restoreGroupMember(
      'AS-TEST-EXCLUDE-RESTORE',
      'CREW-101',
      'Administrator',
    );

    const masterGroupAfterRestore = JSON.parse(
      JSON.stringify(useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001')),
    );
    expect(masterGroupAfterRestore).toEqual(masterGroupBefore);
  });

  it('role test: non-Administrator roles cannot exclude or restore members', () => {
    // Submitter persona
    useMapStore.setState({
      activePersona: 'Submitter',
    });

    render(<AssuranceDetailView setId="AS-TEST-EXCLUDE-RESTORE" initialTab="objects" />);

    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    fireEvent.click(toggleBtn);

    // Submitter cannot see exclude buttons
    expect(screen.queryByTestId('exclude-member-btn-CREW-101')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exclude-member-btn-CREW-104')).not.toBeInTheDocument();
  });
});
