import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetailHeader } from '../components/common/DetailHeader';
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
    expect(header.querySelector('.detail-header-action-close')).toBeNull();
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

  it('keeps title attribute, clamp class, and action buttons when rendered with a long 120-character title', () => {
    const longTitle = 'Oceanic Heavy Transport & Subsea Construction Vessel Alpha-Omega 2026 Polar Endurance Specialized Fleet Edition Long Name';
    expect(longTitle.length).toBeGreaterThanOrEqual(120);

    const handleClose = vi.fn();
    const handleExport = vi.fn();

    const { container } = render(
      <DetailHeader
        title={longTitle}
        status="Compliant"
        metaItems={['IMO: 9988776', 'Type: Specialized Heavy Lift', 'Port: Fremantle, WA']}
        mainAction={<button type="button">Primary Action</button>}
        onExportCsv={handleExport}
        onClose={handleClose}
      />
    );

    const header = container.querySelector('.map-detail-header') as HTMLElement;
    expect(header).toBeInTheDocument();

    const heading = screen.getByRole('heading', { level: 1, name: longTitle });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute('title', longTitle);
    expect(heading).toHaveClass('map-detail-header-title');
    expect(heading).toHaveClass('line-clamp-2');

    const titleCol = heading.parentElement as HTMLElement;
    expect(titleCol.style.flex).toContain('1 1 0');
    expect(titleCol.style.minWidth).toBe('0');

    const actionsBlock = header.querySelector('.detail-header-action-main')?.parentElement as HTMLElement;
    expect(actionsBlock.style.flexShrink).toBe('0');
    expect(screen.getByRole('button', { name: 'Primary Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export record/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();

    const metaSpans = container.querySelectorAll('.map-detail-header-meta span.text-break');
    expect(metaSpans.length).toBe(3);
  });

  it('renders a vessel with a 120-character title preserving title attribute and clamp class', () => {
    const longName = 'MV Oceanic Discovery & Deepwater Subsea Pioneer 2026 Commercial Maritime Vessel Extended Designation Fleet Alpha Omega';
    const vessels = useMapStore.getState().vessels;
    useMapStore.setState({
      vessels: vessels.map((v, i) => (i === 0 ? { ...v, name: longName } : v)),
    });

    const vessel = useMapStore.getState().vessels[0];
    render(<VesselDetailView vesselId={vessel.id} />);
    const heading = screen.getByRole('heading', { level: 1, name: longName });
    expect(heading).toHaveAttribute('title', longName);
    expect(heading).toHaveClass('map-detail-header-title');
    expect(heading).toHaveClass('line-clamp-2');
  });
});
