/*
  file summary: vessel detail Assurance sets tab uses shared AssuranceTable scoped to the vessel.
  role in system: automated coverage for Task 5440.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VesselDetailView } from '../views/VesselDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS, MOCK_VESSELS } from '../store/mockData';

const initialState = useMapStore.getState();

describe('vessel detail assurance tab', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        vessels: MOCK_VESSELS,
        assuranceSets: MOCK_ASSURANCE_SETS,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('lists only the vessel assurance sets through AssuranceTable', () => {
    const vessel =
      MOCK_VESSELS.find((v) => MOCK_ASSURANCE_SETS.some((s) => s.vesselId === v.id)) || MOCK_VESSELS[0];
    const linked = MOCK_ASSURANCE_SETS.filter((s) => s.vesselId === vessel.id);
    const other = MOCK_ASSURANCE_SETS.find((s) => s.vesselId && s.vesselId !== vessel.id);

    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /^assurance/i }));

    const table = screen.getByTestId('vessel-scoped-assurance-table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByPlaceholderText(/search/i)).toBeInTheDocument();

    if (other && linked.length > 0 && !linked.some((s) => s.title === other.title)) {
      expect(within(table).queryByText(other.title)).toBeNull();
    }

    if (linked[0]) {
      expect(within(table).getByText(linked[0].title)).toBeInTheDocument();
    }
  });
});
