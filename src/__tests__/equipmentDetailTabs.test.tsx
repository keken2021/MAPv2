/*
  file summary: tests equipment detail tabs, store certificates, and equipmentId-scoped assurance sets.
  responsibilities: covers EquipmentDetailView Overview/Documents/Assurance and removes invented certificate UI.
  role in system: automated coverage for Task 5323.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { EquipmentDetailView } from '../views/EquipmentDetailView';

const initialState = useMapStore.getState();

describe('equipment detail tabs', () => {
  beforeEach(() => {
    useMapStore.setState({ ...initialState, activePersona: 'Administrator', isAuthenticated: true }, true);
  });
  afterEach(cleanup);

  it('shows Overview, Documents, Assurance in order and lists store certificates for EQ-001', () => {
    render(<EquipmentDetailView equipmentId="EQ-001" />);

    const tablist = screen.getByRole('tablist', { name: 'Equipment detail tabs' });
    const labels = Array.from(tablist.querySelectorAll('[role="tab"]')).map((el) => el.textContent || '');
    expect(labels[0]).toBe('Overview');
    expect(labels.some((l) => l.startsWith('Documents'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Assurance'))).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: /Documents/ }));
    expect(screen.getByText('FFE-CO2-2026-01')).toBeInTheDocument();
    expect(screen.getByText(/Fixed CO2 Fire Suppression System Proof Test Certificate/)).toBeInTheDocument();
    expect(screen.queryByText(/Safety & Proof Test Certificate/)).toBeNull();
  });

  it('lists only assurance sets whose equipmentId matches', () => {
    render(<EquipmentDetailView equipmentId="EQ-007" />);
    fireEvent.click(screen.getByRole('tab', { name: /Assurance/ }));

    expect(screen.getByText('AS-2026-008')).toBeInTheDocument();
    expect(screen.getByText('AS-EQP-007-01')).toBeInTheDocument();
    expect(screen.getAllByText('Schilling ROV System Mobilization Assurance').length).toBeGreaterThan(0);
    expect(screen.queryByText('AS-EQP-005-01')).toBeNull();
  });

  it('does not invent a Class Status row or fullscreen invented certificate', () => {
    render(<EquipmentDetailView equipmentId="EQ-001" />);
    expect(screen.queryByText('Class Status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fullscreen PDF' })).toBeNull();
  });
});
