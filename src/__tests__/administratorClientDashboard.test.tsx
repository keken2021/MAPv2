import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import {
  formatMissingRolesSnippet,
  formatStartDateSnippet,
  getAdministratorClientDashboardConfig,
  getMissingRolesForSet,
} from '../utils/roleDashboardConfigs';

const mockAssuranceSets: AssuranceSet[] = [
  {
    id: 'AS-001',
    title: 'Q4 Survey',
    vesselName: 'MV Borealis',
    vesselId: 'VES-001',
    stage: 'Initiated',
    assignedSubmitter: 'M. Chen',
    assignedVerifier: '',
    assignedInspector: '',
    assignedApprover: 'J. Doe',
    charterWindowStart: '2026-11-10T00:00:00Z',
    requirements: [],
  } as unknown as AssuranceSet,
  {
    id: 'AS-002',
    title: 'Annual Inspection',
    vesselName: 'MV Celeste',
    vesselId: 'VES-002',
    stage: 'Initiated',
    assignedSubmitter: 'M. Chen',
    assignedVerifier: 'A. Fontaine',
    assignedInspector: 'B. Vance',
    assignedApprover: '',
    charterWindowStart: '2026-11-14T00:00:00Z',
    requirements: [],
  } as unknown as AssuranceSet,
  {
    id: 'AS-003',
    title: 'Crew Certificates',
    vesselName: 'MV Aurora',
    vesselId: 'VES-003',
    stage: 'Initiated',
    assignedSubmitter: '',
    assignedVerifier: 'A. Fontaine',
    assignedInspector: 'B. Vance',
    assignedApprover: 'J. Doe',
    charterWindowStart: '2026-11-21T00:00:00Z',
    requirements: [],
  } as unknown as AssuranceSet,
  {
    id: 'AS-004',
    title: 'Fully Staffed Set',
    vesselName: 'MV Stellar',
    vesselId: 'VES-004',
    stage: 'Verification',
    assignedSubmitter: 'M. Chen',
    assignedVerifier: 'A. Fontaine',
    assignedInspector: 'B. Vance',
    assignedApprover: 'J. Doe',
    charterWindowStart: '2026-11-01T00:00:00Z',
    requirements: [],
  } as unknown as AssuranceSet,
];

const mockCapaItems: CapaItem[] = [
  { id: 'CAPA-1', status: 'Open', title: 'Finding 1' } as unknown as CapaItem,
  { id: 'CAPA-2', status: 'Open', title: 'Finding 2' } as unknown as CapaItem,
  { id: 'CAPA-3', status: 'Verified & Closed', title: 'Finding 3' } as unknown as CapaItem,
];

const mockAuditEvents: AuditTrailEvent[] = [
  {
    id: 'AUD-1',
    timestampUtc: '2026-11-05T08:00:00Z',
    userId: 'USR-1',
    userRole: 'Verifier',
    organization: 'Bureau Veritas',
    action: 'Verified Certificate',
    targetAsset: 'Certificate of Class',
    target: { kind: 'document', setId: 'AS-001', documentId: 'DOC-1' },
  },
];

describe('Administrator as client dashboard config', () => {
  it('identifies missing roles correctly', () => {
    expect(getMissingRolesForSet(mockAssuranceSets[0])).toEqual(['verifier', 'inspector']);
    expect(getMissingRolesForSet(mockAssuranceSets[1])).toEqual(['approver']);
    expect(getMissingRolesForSet(mockAssuranceSets[2])).toEqual(['submitter']);
    expect(getMissingRolesForSet(mockAssuranceSets[3])).toEqual([]);
  });

  it('formats missing role snippets correctly', () => {
    expect(formatMissingRolesSnippet(['verifier', 'inspector'])).toBe('No verifier, no inspector');
    expect(formatMissingRolesSnippet(['approver'])).toBe('No approver');
    expect(formatMissingRolesSnippet(['submitter'])).toBe('No submitter');
    expect(formatMissingRolesSnippet([])).toBe('');
  });

  it('formats start date snippets correctly', () => {
    expect(formatStartDateSnippet('2026-11-10T00:00:00Z')).toBe('starts 10 Nov');
    expect(formatStartDateSnippet('2026-11-14T00:00:00Z')).toBe('starts 14 Nov');
    expect(formatStartDateSnippet('')).toBe('');
  });

  it('builds 4 neutral KPI tiles and orders action items by soonest start date first', () => {
    const setCurrentHashView = vi.fn();
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: mockAssuranceSets,
      capaItems: mockCapaItems,
      auditEvents: mockAuditEvents,
      setCurrentHashView,
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.roleTitle).toBe('Administrator as client');
    expect(config.tiles).toHaveLength(4);

    // Check all tiles are neutral tone
    for (const tile of config.tiles) {
      expect(tile.tone).toBe('neutral');
    }

    const tileLabels = config.tiles.map((t) => t.label);
    expect(tileLabels).toEqual(['Sets needing people', 'Overdue', 'Due this week', 'Open findings']);

    // Check tile values
    const needingPeopleTile = config.tiles.find((t) => t.id === 'needing_people')!;
    expect(needingPeopleTile.value).toBe(3);

    const openFindingsTile = config.tiles.find((t) => t.id === 'open_findings')!;
    expect(openFindingsTile.value).toBe(2);

    // Check action items (soonest start first: Nov 10, then Nov 14, then Nov 21)
    expect(config.actionItems).toHaveLength(3);
    expect(config.actionItems[0].id).toBe('AS-001');
    expect(config.actionItems[0].title).toBe('MV Borealis · Q4 Survey');
    expect(config.actionItems[0].subtitle).toBe('No verifier, no inspector · starts 10 Nov');
    expect(config.actionItems[0].buttonLabel).toBe('Assign');

    expect(config.actionItems[1].id).toBe('AS-002');
    expect(config.actionItems[1].title).toBe('MV Celeste · Annual Inspection');
    expect(config.actionItems[1].subtitle).toBe('No approver · starts 14 Nov');

    expect(config.actionItems[2].id).toBe('AS-003');
    expect(config.actionItems[2].title).toBe('MV Aurora · Crew Certificates');
    expect(config.actionItems[2].subtitle).toBe('No submitter · starts 21 Nov');

    // Trigger Assign button action
    config.actionItems[0].onAction?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-001');
  });

  it('shows an updated set when a role is cleared on a mock set', () => {
    const modifiedSets = [
      {
        ...mockAssuranceSets[3],
        assignedVerifier: '', // Clear verifier on a previously staffed set
        charterWindowStart: '2026-11-08T00:00:00Z',
      },
    ];

    const config = getAdministratorClientDashboardConfig({
      assuranceSets: modifiedSets,
      capaItems: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.actionItems).toHaveLength(1);
    expect(config.actionItems[0].id).toBe('AS-004');
    expect(config.actionItems[0].subtitle).toBe('No verifier · starts 8 Nov');
    expect(config.actionItems[0].buttonLabel).toBe('Assign');
  });

  it('renders SharedDashboardFrame correctly with Administrator as client config', () => {
    const setCurrentHashView = vi.fn();
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: mockAssuranceSets,
      capaItems: mockCapaItems,
      auditEvents: mockAuditEvents,
      setCurrentHashView,
      now: new Date('2026-11-05T00:00:00Z'),
    });

    render(<SharedDashboardFrame config={config} />);

    // Check title and subtitle
    expect(screen.getByText('Administrator as client')).toBeInTheDocument();
    expect(screen.getByText('Sets needing people')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Due this week')).toBeInTheDocument();
    expect(screen.getByText('Open findings')).toBeInTheDocument();

    // Check rows
    expect(screen.getByText('MV Borealis · Q4 Survey')).toBeInTheDocument();
    expect(screen.getByText('No verifier, no inspector · starts 10 Nov')).toBeInTheDocument();

    // Click Assign button
    const assignButtons = screen.getAllByRole('button', { name: 'Assign' });
    expect(assignButtons).toHaveLength(3);
    fireEvent.click(assignButtons[0]);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-001');

    // Click a KPI tile
    const needingPeopleTile = screen.getByTestId('kpi-tile-needing_people');
    fireEvent.click(needingPeopleTile);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets');
  });

  it('renders empty action message when all sets are staffed', () => {
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: [mockAssuranceSets[3]], // Fully staffed set
      capaItems: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    render(<SharedDashboardFrame config={config} />);
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });
});
