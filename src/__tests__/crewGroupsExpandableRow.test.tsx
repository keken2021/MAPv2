import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { AssuranceSet } from '../types/assurance';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';

const initialState = useMapStore.getState();

const baseSet = initialState.assuranceSets[0] || ({} as AssuranceSet);

const TEST_SET_WITH_GROUP: AssuranceSet = {
  ...baseSet,
  id: 'AS-TEST-CREW-GROUP',
  title: 'Offshore Diving Campaign Alpha',
  stage: 'Verification',
  assuranceType: 'Crew',
  subtypes: ['Crew'],
  vesselName: 'Pacific Responder',
  initiatorOrg: 'Northwind Marine Pty Ltd',
  initiatorRole: 'Vessel Provider Admin',
  createdByUserId: 'USR-101',
  createdByName: 'K. Osei',
  createdByPersona: 'Administrator',
  clientOrg: 'Chevron Australia Pty Ltd',
  serviceProviderOrg: 'Northwind Marine Pty Ltd',
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

describe('AssuranceDetailView Objects Tab - Expandable Crew Groups (Task 5342)', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
        isAuthenticated: true,
        crewGroups: JSON.parse(JSON.stringify(MOCK_CREW_GROUPS)),
        assuranceSets: [TEST_SET_WITH_GROUP, ...initialState.assuranceSets],
      },
      true,
    );
  });

  afterEach(cleanup);

  it('renders crew group row with users icon, name, member count, and roll-up verification status', () => {
    render(<AssuranceDetailView setId="AS-TEST-CREW-GROUP" initialTab="objects" />);

    // Group row should be visible
    const groupRow = screen.getByTestId('crew-group-row');
    expect(groupRow).toBeInTheDocument();
    expect(within(groupRow).getByText('Dive Team Alpha')).toBeInTheDocument();
    expect(within(groupRow).getByText(/2 members/i)).toBeInTheDocument();
    expect(within(groupRow).getByText('Crew Group')).toBeInTheDocument();
    expect(within(groupRow).getByText('Subsea & Diving Operations')).toBeInTheDocument();

    // Roll-up verification status badge: both CREW-101 and CREW-104 verified -> 2/2 verified
    const rollupBadge = screen.getByTestId('group-rollup-CG-001');
    expect(rollupBadge).toBeInTheDocument();
    expect(rollupBadge).toHaveTextContent('2/2 verified');

    // Sub-rows should not be visible when collapsed
    expect(screen.queryByTestId('crew-group-member-row')).not.toBeInTheDocument();
  });

  it('expands and collapses group row on toggle chevron', () => {
    render(<AssuranceDetailView setId="AS-TEST-CREW-GROUP" initialTab="objects" />);

    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    expect(screen.queryByTestId('crew-group-member-row')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleBtn);
    const memberRows = screen.getAllByTestId('crew-group-member-row');
    expect(memberRows.length).toBe(2);

    // Verify sub-row displays
    expect(screen.getByText('Capt. James Ward')).toBeInTheDocument();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();

    // Verify no nested <table>: member row is a direct child tr in tbody
    const table = screen.getByTestId('assurance-objects-table');
    expect(table.querySelectorAll('table').length).toBe(0);

    // Collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('crew-group-member-row')).not.toBeInTheDocument();
  });

  it('roll-up counts only included members and excludes excluded members from denominator', () => {
    const setWithExclusion: AssuranceSet = {
      ...TEST_SET_WITH_GROUP,
      id: 'AS-TEST-CREW-EXCLUSION',
      memberExclusions: [
        {
          memberId: 'CREW-101',
          reason: 'Transferred to shore standby',
          excludedBy: 'Creishen Ayuman',
          excludedAt: '2026-11-04T00:00:00.000Z',
          restored: false,
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [setWithExclusion, ...initialState.assuranceSets],
    });

    render(<AssuranceDetailView setId="AS-TEST-CREW-EXCLUSION" initialTab="objects" />);

    // Roll-up should count only 1 member (CREW-104), skipping excluded CREW-101
    const rollupBadge = screen.getByTestId('group-rollup-CG-001');
    expect(rollupBadge).toHaveTextContent('1/1 verified');

    // Expand to verify excluded styling & badge
    const toggleBtn = screen.getByTestId('toggle-group-CG-001');
    fireEvent.click(toggleBtn);

    const excludedBadge = screen.getByTestId('member-excluded-badge-CREW-101');
    expect(excludedBadge).toBeInTheDocument();
    expect(screen.getByText('Transferred to shore standby')).toBeInTheDocument();
  });

  it('keeps standalone objects visible alongside crew groups without duplicating members', () => {
    render(<AssuranceDetailView setId="AS-TEST-CREW-GROUP" initialTab="objects" />);

    // Standalone object row (Pacific Responder vessel) is rendered
    const standaloneRows = screen.getAllByTestId('assurance-object-row');
    expect(standaloneRows.length).toBe(1);
    expect(within(standaloneRows[0]).getByText('Pacific Responder')).toBeInTheDocument();

    // Group members are NOT rendered as standalone rows
    const allRowTexts = standaloneRows.map((r) => r.textContent);
    expect(allRowTexts.some((t) => t?.includes('Capt. James Ward'))).toBe(false);
  });
});
