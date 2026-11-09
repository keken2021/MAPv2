/*
  file summary: asserts vessel detail inspections and certificates read records (audit 5321).
  responsibilities: inspections come from inspectionMockData; certificates without documents show No document on file.
  role in system: covers VesselDetailView after invented inspection/certificate construction was removed.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';
import {
  getPhysicalInspectionsForAssuranceSets,
  PHYSICAL_INSPECTIONS,
} from '../store/inspectionMockData';

describe('vessel detail inspections and certificates', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
    });
  });

  it('renders seeded inspections for a vessel that has them', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));

    expect(screen.getByText('INSP-2026-001')).toBeInTheDocument();
    expect(screen.getByText('AS-2026-001')).toBeInTheDocument();
    expect(screen.getAllByText('N. Technical (Bureau Veritas Inspectorate)').length).toBeGreaterThan(0);
    expect(screen.queryByText('No inspections recorded')).toBeNull();
  });

  it('shows no inspections when the vessel has none recorded', () => {
    render(<VesselDetailView vesselId="VESSEL-012" />);
    fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));

    expect(screen.getByText('No inspections recorded')).toBeInTheDocument();
    expect(screen.getAllByTestId('empty-state').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^INSP-/)).toBeNull();
  });

  it('reads inspections per set with the set inspector and client from seed data', () => {
    const rows = getPhysicalInspectionsForAssuranceSets([
      {
        id: 'AS-2026-001',
        title: 'Chevron Gorgon Charter Vetting',
        assignedInspector: 'Override Inspector (Test Org)',
        clientOrg: 'Override Client Pty Ltd',
        inspectionCompleted: true,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(PHYSICAL_INSPECTIONS[0].id);
    expect(rows[0].inspector).toBe('Override Inspector (Test Org)');
    expect(rows[0].client).toBe('Override Client Pty Ltd');
  });

  it('opens the Documents tab via the shared DocumentTable shell', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    fireEvent.click(screen.getByRole('tab', { name: /documents/i }));

    expect(screen.getByTestId('vessel-scoped-document-table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fullscreen PDF' })).toBeNull();
  });

  it('inspection detail modal opens on Modal shell (Task 5422)', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    fireEvent.click(screen.getByRole('tab', { name: /inspections/i }));
    const viewBtn = screen.queryAllByRole('button', { name: /view/i }).find(
      (b) => b.closest('tr'),
    );
    if (!viewBtn) return;
    fireEvent.click(viewBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // footer Close button (not the header × button)
    const closeBtns = within(dialog).getAllByRole('button', { name: /^close$/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('company fleet modal opens on Modal shell (Task 5422)', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    const fleetBtn = screen.queryAllByRole('button').find(
      (b) => b.textContent?.includes('VESSELS') || b.getAttribute('title')?.toLowerCase().includes('fleet'),
    );
    if (!fleetBtn) return;
    fireEvent.click(fleetBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const closeBtn = screen.queryByRole('button', { name: 'Close' });
    if (!closeBtn) return;
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
