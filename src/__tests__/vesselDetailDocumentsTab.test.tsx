/*
  file summary: vessel detail Documents tab uses shared DocumentTable scoped to vessel docs.
  role in system: automated coverage for Task 5439.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VesselDetailView } from '../views/VesselDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_VESSELS, MOCK_DOCUMENTS } from '../store/mockData';

const initialState = useMapStore.getState();

describe('vessel detail documents tab', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        vessels: MOCK_VESSELS,
        documents: MOCK_DOCUMENTS,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('lists only the vessel documents through DocumentTable', () => {
    const vessel = MOCK_VESSELS.find((v) => MOCK_DOCUMENTS.some((d) => d.vesselId === v.id)) || MOCK_VESSELS[0];
    const linked = MOCK_DOCUMENTS.filter((d) => d.vesselId === vessel.id);
    const other = MOCK_DOCUMENTS.find((d) => d.vesselId && d.vesselId !== vessel.id);

    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /^documents/i }));

    const table = screen.getByTestId('vessel-scoped-document-table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByPlaceholderText(/search documents/i)).toBeInTheDocument();

    // Scoped list should not show another vessel's unique title when present
    if (other && linked.length > 0 && !linked.some((d) => d.title === other.title)) {
      expect(within(table).queryByText(other.title)).toBeNull();
    }

    // At least the vessel's first linked document title appears when any exist
    if (linked[0]) {
      expect(within(table).getByText(linked[0].title)).toBeInTheDocument();
    }
  });
});
