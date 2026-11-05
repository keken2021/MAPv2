/*
  file summary: vessel detail Audit and CAPA surfaces use shared tables scoped to the vessel.
  role in system: automated coverage for Task 5441.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { VesselDetailView } from '../views/VesselDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS, MOCK_VESSELS, MOCK_AUDIT_TRAIL } from '../store/mockData';
import { MOCK_CAPA_ITEMS } from '../store/capaMockData';

const initialState = useMapStore.getState();

describe('vessel detail audit and capa tabs', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        vessels: MOCK_VESSELS,
        assuranceSets: MOCK_ASSURANCE_SETS,
        capaItems: MOCK_CAPA_ITEMS,
        auditEvents: MOCK_AUDIT_TRAIL,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('lists only the vessel CAPAs through CapaTable on Inspections', () => {
    const vessel =
      MOCK_VESSELS.find((v) =>
        MOCK_CAPA_ITEMS.some(
          (c) => c.vesselId === v.id || c.vesselName.toLowerCase() === v.name.toLowerCase(),
        ),
      ) || MOCK_VESSELS[0];
    const linked = MOCK_CAPA_ITEMS.filter(
      (c) => c.vesselId === vessel.id || c.vesselName.toLowerCase() === vessel.name.toLowerCase(),
    );
    const other = MOCK_CAPA_ITEMS.find(
      (c) => c.vesselId !== vessel.id && c.vesselName.toLowerCase() !== vessel.name.toLowerCase(),
    );

    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /^inspections/i }));

    const table = screen.getByTestId('vessel-scoped-capa-table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByPlaceholderText(/search capas/i)).toBeInTheDocument();

    if (other && linked.length > 0 && !linked.some((c) => c.id === other.id)) {
      expect(within(table).queryByText(other.id)).toBeNull();
    }
    if (linked[0]) {
      expect(within(table).getByText(linked[0].id)).toBeInTheDocument();
    }
  });

  it('lists only the vessel audit events through AuditTrailTable on History', () => {
    const vessel =
      MOCK_VESSELS.find((v) =>
        MOCK_AUDIT_TRAIL.some(
          (a) => a.targetAsset.includes(v.imoNumber) || a.targetAsset.includes(v.name),
        ),
      ) || MOCK_VESSELS[0];

    const linked = MOCK_AUDIT_TRAIL.filter(
      (a) => a.targetAsset.includes(vessel.imoNumber) || a.targetAsset.includes(vessel.name),
    );
    const other = MOCK_AUDIT_TRAIL.find(
      (a) =>
        !a.targetAsset.includes(vessel.imoNumber) &&
        !a.targetAsset.includes(vessel.name) &&
        linked.every((l) => l.action !== a.action || l.id === a.id),
    );

    render(<VesselDetailView vesselId={vessel.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    const table = screen.getByTestId('vessel-scoped-audit-table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByPlaceholderText(/search audit trail/i)).toBeInTheDocument();

    if (linked[0]) {
      expect(within(table).getByText(linked[0].action)).toBeInTheDocument();
    }
    if (other && linked.length > 0 && !linked.some((e) => e.id === other.id)) {
      // Other vessel's unique action should not appear when distinct
      const otherOnlyAction = !linked.some((e) => e.action === other.action);
      if (otherOnlyAction) {
        expect(within(table).queryByText(other.action)).toBeNull();
      }
    }
  });
});
