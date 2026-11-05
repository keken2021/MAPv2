/*
  file summary: vessel detail History tab shows activity timeline only (no status strip / audit table).
  role in system: automated coverage for Task 5442.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VesselDetailView } from '../views/VesselDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_VESSELS } from '../store/mockData';

const initialState = useMapStore.getState();

describe('vessel detail history tab', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        vessels: MOCK_VESSELS,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('shows activity timeline only — no Current Status strip or audit table', () => {
    const vessel = MOCK_VESSELS.find((v) => v.registeredOwner === 'Northwind Marine Pty Ltd') || MOCK_VESSELS[0];
    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /^history$/i }));

    expect(screen.queryByText('Current Status')).toBeNull();
    expect(screen.queryByPlaceholderText(/search status history/i)).toBeNull();
    expect(screen.queryByTestId('vessel-scoped-audit-table')).toBeNull();
    expect(screen.queryByPlaceholderText(/search audit trail/i)).toBeNull();

    expect(screen.getByTestId('vessel-activity')).toBeInTheDocument();
    expect(within(screen.getByTestId('vessel-activity')).getByText('Activity')).toBeInTheDocument();
  });

  it('keeps vessel audit on the Audit tab', () => {
    const vessel = MOCK_VESSELS.find((v) => v.registeredOwner === 'Northwind Marine Pty Ltd') || MOCK_VESSELS[0];
    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /^audit$/i }));
    expect(screen.getByTestId('vessel-scoped-audit-table')).toBeInTheDocument();
    expect(within(screen.getByTestId('vessel-scoped-audit-table')).getByPlaceholderText(/search audit trail/i)).toBeInTheDocument();
  });
});
