/*
  file summary: asserts EmptyState on empty tabs for vessel, crew, and equipment detail.
  responsibilities: Task 5449 — empty tabs use shared EmptyState.
  role in system: automated coverage for UI declutter empty-state roll-out.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';
import { CrewDetailView } from '../views/CrewDetailView';
import { EquipmentDetailView } from '../views/EquipmentDetailView';

const initialState = useMapStore.getState();

describe('detail screen EmptyState roll-out', () => {
  beforeEach(() => {
    useMapStore.setState(
      { ...initialState, activePersona: 'Administrator', isAuthenticated: true },
      true,
    );
  });
  afterEach(cleanup);

  it('shows EmptyState on vessel Inspections when none are recorded', () => {
    render(<VesselDetailView vesselId="VESSEL-012" />);
    fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));

    expect(screen.getByText('No inspections recorded')).toBeInTheDocument();
    expect(screen.getAllByTestId('empty-state').length).toBeGreaterThan(0);
  });

  it('shows EmptyState on crew Assignments when the member has none', () => {
    const crew = useMapStore.getState().crew[0];
    useMapStore.setState({
      crew: useMapStore.getState().crew.map((c) =>
        c.id === crew.id ? { ...c, assignments: [] } : c,
      ),
    });

    render(<CrewDetailView crewId={crew.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /Assignments/ }));

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No assignments yet')).toBeInTheDocument();
  });

  it('shows EmptyState on equipment Documents when none are on file', () => {
    const item = useMapStore.getState().equipment[0];
    useMapStore.setState({
      documents: [],
      assuranceSets: useMapStore
        .getState()
        .assuranceSets.map((s) =>
          s.equipmentId === item.id ? { ...s, equipmentId: undefined } : s,
        ),
    });

    render(<EquipmentDetailView equipmentId={item.id} />);
    fireEvent.click(screen.getByRole('tab', { name: /Documents/ }));

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No document on file')).toBeInTheDocument();
  });
});
