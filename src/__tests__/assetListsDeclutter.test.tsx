import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FleetRegistryView } from '../views/FleetRegistryView';
import { CrewView } from '../views/CrewView';
import { EquipmentView } from '../views/EquipmentView';
import { useMapStore } from '../store/useMapStore';
import { exportToCsv } from '../utils/exportHelpers';
import { VesselInformation } from '../types/vessel';
import { CrewMember } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';

vi.mock('../utils/exportHelpers', () => ({
  exportToCsv: vi.fn(),
  exportToPdf: vi.fn(),
}));

const vessel = (id: string): VesselInformation =>
  ({
    id,
    name: `${id} vessel`,
    imoNumber: '9123453',
    officialRegNumber: 'REG-1',
    mmsiNumber: '503728940',
    callSign: 'VJQ4821',
    flagState: 'Australia',
    portOfRegistry: 'Fremantle',
    status: 'In Operations',
    complianceReadinessScore: 80,
    vesselType: 'OSV',
    vesselSubtype: 'AHTS',
    intendedUse: 'Supply',
    tradingArea: 'International',
    classificationSociety: 'DNV',
    classNotation: '100A1',
    hullType: 'Steel',
    ispsSolasStatus: 'Fully Compliant',
    registeredOwner: 'Northwind Marine Pty Ltd',
    yearBuilt: 2019,
    shipyardBuilder: 'Damen',
    lengthOverallMeters: 80,
    beamMeters: 18,
  }) as VesselInformation;

const crewMember = (
  overrides: Partial<CrewMember> & Pick<CrewMember, 'id' | 'complianceStatus'>,
): CrewMember =>
  ({
    fullName: `${overrides.id} seafarer`,
    rank: 'Master',
    nationality: 'Australian',
    seamansBookNo: 'SB-100',
    currentVesselName: 'MV Pacific Endeavour',
    overallComplianceScore: 90,
    ...overrides,
  }) as CrewMember;

const equipment = (
  overrides: Partial<EquipmentAsset> & Pick<EquipmentAsset, 'id' | 'complianceStatus'>,
): EquipmentAsset =>
  ({
    name: `${overrides.id} unit`,
    equipmentIdentifier: overrides.id,
    category: 'Other',
    owningOrganization: 'Northwind Marine Pty Ltd',
    complianceReadinessScore: null,
    availabilityStatus: 'Available',
    availabilityUpdatedAt: '2026-10-01',
    registrationStatus: 'Registered',
    registrationUpdatedAt: '2026-10-01',
    classStatus: 'In Class',
    classStatusUpdatedAt: '2026-10-01',
    complianceUpdatedAt: '2026-10-01',
    ...overrides,
  }) as EquipmentAsset;

describe('Vessel, crew and equipment list declutter', () => {
  beforeEach(() => {
    vi.mocked(exportToCsv).mockClear();
    useMapStore.setState({
      activePersona: 'Administrator',
      isAuthenticated: true,
      activeSessionUserId: 'USR-101',
      vessels: [vessel('VESSEL-A'), vessel('VESSEL-B')],
      assuranceSets: [],
      crew: [
        crewMember({ id: 'CREW-OK', complianceStatus: 'Fully Compliant' }),
        crewMember({ id: 'CREW-SOON', complianceStatus: 'Expiring < 60 Days' }),
        crewMember({ id: 'CREW-BAD', complianceStatus: 'Document Deficient' }),
      ],
      equipment: [
        equipment({ id: 'EQ-OK', complianceStatus: 'Compliant' }),
        equipment({ id: 'EQ-BAD', complianceStatus: 'Non-Compliant' }),
        equipment({ id: 'EQ-SOON', complianceStatus: 'Expiring Soon' }),
      ],
    });
  });

  it('renders one status badge on each vessel row', () => {
    const { container } = render(<FleetRegistryView />);
    expect(screen.queryByRole('heading', { name: /^chartered$/i })).toBeNull();

    const tabs = screen.getByRole('tablist', { name: /vessel tabs/i });
    expect(within(tabs).getByRole('tab', { name: /own/i })).toHaveTextContent('(2)');

    fireEvent.click(screen.getByRole('button', { name: 'View mode' }));
    fireEvent.click(screen.getByRole('button', { name: /^table$/i }));

    const rows = within(container.querySelector('tbody') as HTMLElement).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const badges = row.querySelectorAll('.badge, .map-status-badge');
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent('In Operations');
    });
    expect(screen.getAllByText('9123453').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Australia · Fremantle/)).toHaveLength(2);
  });

  it('replaces crew count cards with tabs whose counts match the list', () => {
    const { container } = render(<CrewView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();
    const tabs = screen.getByRole('tablist', { name: /crew tabs/i });
    fireEvent.click(within(tabs).getByRole('tab', { name: /non-compliant/i }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(screen.getByText('CREW-BAD seafarer')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('Unassigned')).toBeNull();
    expect(within(rows[0]).getAllByText(/non-compliant/i).length).toBeGreaterThan(0);
  });

  it('exports the filtered equipment rows', () => {
    render(<EquipmentView />);
    const tabs = screen.getByRole('tablist', { name: /equipment tabs/i });
    fireEvent.click(within(tabs).getByRole('tab', { name: /^non-compliant/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).queryAllByText('Available')).toHaveLength(1);
    expect(rows[0].querySelectorAll('.badge, .map-status-badge')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /export options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /csv/i }));

    expect(exportToCsv).toHaveBeenCalledTimes(1);
    const exported = vi.mocked(exportToCsv).mock.calls[0][1];
    expect(exported).toHaveLength(rows.length);
    expect(exported[0].EquipmentId).toBe('EQ-BAD');
  });
});
