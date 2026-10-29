import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';
import { CrewDetailView } from '../views/CrewDetailView';
import { EquipmentDetailView } from '../views/EquipmentDetailView';

const headerBadges = (container: HTMLElement) =>
  container.querySelectorAll('.map-detail-header .map-status-badge');

describe('asset detail headers', () => {
  beforeEach(() => {
    useMapStore.setState({ activePersona: 'Administrator', isAuthenticated: true });
  });

  it('gives a vessel one header status and drops the toast-only status tile', () => {
    const vessel = useMapStore.getState().vessels[0];
    const { container } = render(<VesselDetailView vesselId={vessel.id} />);
    const header = container.querySelector('.map-detail-header') as HTMLElement;
    expect(headerBadges(container)).toHaveLength(1);
    expect(header.querySelector('.detail-header-action-main')).toBeTruthy();
    expect(header.querySelector('.detail-header-action-export')).toBeTruthy();
    expect(header.querySelector('.detail-header-action-close')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /operating status/i })).toBeNull();
    expect(screen.queryByText('Operating Status')).toBeNull();
  });

  it('gives a crew member one header status and renames Save', () => {
    const crew = useMapStore.getState().crew[0];
    const { container } = render(<CrewDetailView crewId={crew.id} />);
    expect(headerBadges(container)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save assignment' })).toBeNull();
    expect(screen.queryByText('Permissions')).toBeNull();
    expect(screen.queryByText(/Admin \/ Submitter|Read-Only Mode/)).toBeNull();
  });

  it('gives equipment one header status, readiness, and one certificate opener', () => {
    const item = useMapStore.getState().equipment[0];
    const { container } = render(<EquipmentDetailView equipmentId={item.id} />);
    const header = container.querySelector('.map-detail-header') as HTMLElement;
    expect(headerBadges(container)).toHaveLength(1);
    expect(header.textContent).toMatch(/Readiness:/);
    expect(screen.queryByText(/^Score:/)).toBeNull();
    expect(screen.queryByRole('button', { name: /certificate \(pdf\)/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fullscreen PDF' })).toBeInTheDocument();
    expect(header.querySelector('.detail-header-action-close')).toBeTruthy();
  });
});
