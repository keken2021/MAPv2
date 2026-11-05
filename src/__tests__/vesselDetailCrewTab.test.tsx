/*
  file summary: vessel detail Crew tab uses shared CrewTable scoped to the vessel.
  role in system: automated coverage for Task 5438.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VesselDetailView } from '../views/VesselDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';

const initialState = useMapStore.getState();

describe('vessel detail crew tab', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        vessels: MOCK_VESSELS,
        crew: MOCK_CREW,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('lists only the vessel crew through the shared CrewTable', () => {
    const vessel = MOCK_VESSELS.find((v) => MOCK_CREW.some((c) => c.currentVesselId === v.id)) || MOCK_VESSELS[0];
    const linked = MOCK_CREW.filter(
      (c) =>
        c.currentVesselId === vessel.id ||
        (c.assignments || []).some((a) => a.vesselId === vessel.id),
    );
    const other = MOCK_CREW.find(
      (c) =>
        c.currentVesselId !== vessel.id &&
        !(c.assignments || []).some((a) => a.vesselId === vessel.id),
    );

    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /crew and equipment/i }));

    const table = screen.getByTestId('vessel-scoped-crew-table');
    expect(table).toBeInTheDocument();

    linked.slice(0, 3).forEach((member) => {
      expect(within(table).getByText(member.fullName)).toBeInTheDocument();
    });

    if (other) {
      expect(within(table).queryByText(other.fullName)).toBeNull();
    }
  });
});
