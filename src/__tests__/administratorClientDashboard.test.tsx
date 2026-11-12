import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { MasterDocument } from '../types/document';
import { VesselInformation } from '../types/vessel';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import {
  formatMissingRolesSnippet,
  formatStartDateSnippet,
  getAdministratorDashboardConfig,
  getAdministratorClientDashboardConfig,
  getMissingRolesForSet,
} from '../utils/roleDashboardConfigs';

const cAdminSessionUser = {
  id: 'USR-CA',
  name: 'C. Client',
  organization: 'Northwind Shipping',
  roles: ['C Admin' as const],
};

const mockAssuranceSets: AssuranceSet[] = [
  {
    id: 'AS-001',
    title: 'Q4 Survey',
    vesselName: 'MV Borealis',
    vesselId: 'VES-001',
    stage: 'Initiated',
    createdByUserId: 'USR-CA',
    createdByName: 'C. Client',
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
    createdByUserId: 'USR-CA',
    createdByName: 'C. Client',
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
    createdByUserId: 'USR-CA',
    createdByName: 'C. Client',
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
    createdByUserId: 'USR-CA',
    createdByName: 'C. Client',
    assignedSubmitter: 'M. Chen',
    assignedVerifier: 'A. Fontaine',
    assignedInspector: 'B. Vance',
    assignedApprover: 'J. Doe',
    charterWindowStart: '2026-11-01T00:00:00Z',
    requirements: [],
  } as unknown as AssuranceSet,
];

const mockCapaItems: CapaItem[] = [
  { id: 'CAPA-1', vesselId: 'VES-001', assuranceSetId: 'AS-001', status: 'Open', title: 'Finding 1' } as unknown as CapaItem,
  { id: 'CAPA-2', vesselId: 'VES-002', assuranceSetId: 'AS-002', status: 'Open', title: 'Finding 2' } as unknown as CapaItem,
  { id: 'CAPA-3', vesselId: 'VES-003', assuranceSetId: 'AS-003', status: 'Verified & Closed', title: 'Finding 3' } as unknown as CapaItem,
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

  it('builds 4 neutral performance KPI tiles and orders action items by soonest start date first', () => {
    const setCurrentHashView = vi.fn();
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: mockAssuranceSets,
      capaItems: mockCapaItems,
      auditEvents: mockAuditEvents,
      sessionUser: cAdminSessionUser,
      activeOrganization: 'Northwind Shipping',
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
    expect(tileLabels).toEqual([
      'On-time completion',
      'Resubmissions',
      'Average review cycle time',
      'Findings',
    ]);

    const findingsTile = config.tiles.find((t) => t.id === 'perf_findings')!;
    expect(findingsTile.value).toBe(2);

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
      sessionUser: cAdminSessionUser,
      activeOrganization: 'Northwind Shipping',
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.actionItems).toHaveLength(1);
    expect(config.actionItems[0].id).toBe('AS-004');
    expect(config.actionItems[0].subtitle).toBe('No verifier · starts 8 Nov');
    expect(config.actionItems[0].buttonLabel).toBe('Assign');
  });

  it('renders a single KPI strip with Client Admin cards in SharedDashboardFrame', () => {
    const setCurrentHashView = vi.fn();
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: mockAssuranceSets,
      capaItems: mockCapaItems,
      auditEvents: mockAuditEvents,
      sessionUser: cAdminSessionUser,
      activeOrganization: 'Northwind Shipping',
      setCurrentHashView,
      now: new Date('2026-11-05T00:00:00Z'),
    });

    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('performance-measures-strip')).toBeNull();
    expect(screen.queryByText('Sets needing people')).toBeNull();

    expect(screen.getByText('On-time completion')).toBeInTheDocument();
    expect(screen.getByText('Resubmissions')).toBeInTheDocument();
    expect(screen.getByText('Average review cycle time')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();

    // Check rows
    expect(screen.getByText('MV Borealis · Q4 Survey')).toBeInTheDocument();
    expect(screen.getByText('No verifier, no inspector · starts 10 Nov')).toBeInTheDocument();

    // Click Assign button
    const assignButtons = screen.getAllByRole('button', { name: 'Assign' });
    expect(assignButtons).toHaveLength(3);
    fireEvent.click(assignButtons[0]);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-001');

    // Click Findings tile
    const findingsTile = screen.getByTestId('kpi-tile-perf_findings');
    fireEvent.click(findingsTile);
    expect(setCurrentHashView).toHaveBeenCalledWith('capa');
  });

  it('renders empty action message when all sets are staffed', () => {
    const config = getAdministratorClientDashboardConfig({
      assuranceSets: [mockAssuranceSets[3]], // Fully staffed set
      capaItems: [],
      auditEvents: [],
      sessionUser: cAdminSessionUser,
      activeOrganization: 'Northwind Shipping',
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    render(<SharedDashboardFrame config={config} />);
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });

  it('computes the 4 performance KPI cards in the main tiles row from seeded pilot sets', () => {
    const seededPilotSets: AssuranceSet[] = [
      {
        id: 'AS-2026-101',
        title: 'LNG Transport Charter',
        vesselName: 'LNGC Northwind Aurora',
        vesselId: 'VESSEL-013',
        stage: 'Verification',
        createdByUserId: 'USR-CA',
        createdByName: 'C. Client',
        assignedSubmitter: 'M. Chen',
        assignedVerifier: 'L. Ferreira',
        assignedInspector: 'H. Blake',
        assignedApprover: 'S. Rahman',
        targetDate: '2026-11-15T00:00:00Z',
        requirements: [
          {
            id: 'REQ-SS01-01',
            category: 'Statutory Certificate',
            title: 'Certificate of Class',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 98,
            documentId: 'DOC-101',
            verifierStatus: 'Verified',
            attemptNumber: 1,
          },
          {
            id: 'REQ-SS01-02',
            category: 'Statutory Certificate',
            title: 'Safety Equipment',
            isMandatory: true,
            isFulfilled: false,
            ocrConfidence: 91,
            documentId: 'DOC-102',
            verifierStatus: 'Correction Requested',
            attemptNumber: 2,
          },
        ],
      } as unknown as AssuranceSet,
      {
        id: 'AS-2026-102',
        title: 'Vessel Purchase (OSV)',
        vesselName: 'OSV Meridian Endeavour',
        vesselId: 'VESSEL-014',
        stage: 'Approved',
        createdByUserId: 'USR-CA',
        createdByName: 'C. Client',
        assignedSubmitter: 'R. Sato',
        assignedVerifier: 'P. Nguyen',
        assignedInspector: 'H. Blake',
        assignedApprover: 'S. Rahman',
        targetDate: '2027-03-01T00:00:00Z',
        sentForReviewAt: '2026-10-01T00:00:00Z',
        lockedAt: '2026-10-09T00:00:00Z',
        requirements: [
          {
            id: 'REQ-SS02-01',
            category: 'Statutory Certificate',
            title: 'Certificate of Class',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 97,
            documentId: 'DOC-101',
            verifierStatus: 'Verified',
            attemptNumber: 1,
          },
        ],
      } as unknown as AssuranceSet,
    ];

    const pilotCapaItems: CapaItem[] = [
      { id: 'CAPA-P1', vesselId: 'VESSEL-013', assuranceSetId: 'AS-2026-101', status: 'Open', title: 'Finding 1' } as unknown as CapaItem,
      { id: 'CAPA-P2', vesselId: 'VESSEL-013', assuranceSetId: 'AS-2026-101', status: 'Open', title: 'Finding 2' } as unknown as CapaItem,
      { id: 'CAPA-P3', vesselId: 'VESSEL-014', assuranceSetId: 'AS-2026-102', status: 'Verified & Closed', title: 'Finding 3' } as unknown as CapaItem,
    ];

    const config = getAdministratorClientDashboardConfig({
      assuranceSets: seededPilotSets,
      capaItems: pilotCapaItems,
      auditEvents: mockAuditEvents,
      sessionUser: cAdminSessionUser,
      activeOrganization: 'Northwind Shipping',
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.tiles).toHaveLength(4);
    for (const tile of config.tiles) {
      expect(tile.tone).toBe('neutral');
    }

    expect(config.tiles.map((t) => t.label)).toEqual([
      'On-time completion',
      'Resubmissions',
      'Average review cycle time',
      'Findings',
    ]);
    expect(config.tiles.find((t) => t.id === 'perf_on_time')?.value).toBe('100%');
    expect(config.tiles.find((t) => t.id === 'perf_resubmissions')?.value).toBe(1);
    expect(config.tiles.find((t) => t.id === 'perf_cycle_time')?.value).toBe('8d');
    expect(config.tiles.find((t) => t.id === 'perf_findings')?.value).toBe(2);

    render(<SharedDashboardFrame config={config} />);

    expect(screen.queryByTestId('performance-measures-strip')).toBeNull();
    expect(screen.getByTestId('kpi-tile-perf_on_time')).toHaveTextContent('100%');
    expect(screen.getByTestId('kpi-tile-perf_resubmissions')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-tile-perf_cycle_time')).toHaveTextContent('8d');
    expect(screen.getByTestId('kpi-tile-perf_findings')).toHaveTextContent('2');
  });

  it('scopes Client Admin KPIs and Needs your action to activeOrganization when provided', () => {
    const sets: AssuranceSet[] = [
      {
        ...mockAssuranceSets[0],
        id: 'AS-CLIENT-A',
        createdByUserId: 'USR-201',
        createdByName: 'S. Basin',
        clientOrg: 'Southern Basin Energy Pty Ltd',
        charterer: 'Southern Basin Energy Pty Ltd',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
      },
      {
        ...mockAssuranceSets[2],
        id: 'AS-CLIENT-B',
        createdByUserId: 'USR-228',
        createdByName: 'A. Okonkwo',
        clientOrg: 'Oil Company',
        charterer: 'Oil Company',
        serviceProviderOrg: 'Meridian Shipyards',
        assignedApprover: 'K. Adeyemi',
      },
    ];
    const capas: CapaItem[] = [
      { id: 'CAPA-A', vesselId: 'VES-001', vesselName: 'MV Borealis', status: 'Open', title: 'Own Finding' } as unknown as CapaItem,
      { id: 'CAPA-B', vesselId: 'VES-003', vesselName: 'MV Aurora', status: 'Open', title: 'Other Org Finding' } as unknown as CapaItem,
    ];

    const config = getAdministratorClientDashboardConfig({
      assuranceSets: sets,
      capaItems: capas,
      auditEvents: mockAuditEvents,
      sessionUser: {
        id: 'USR-201',
        name: 'S. Basin',
        organization: 'Southern Basin Energy Pty Ltd',
        roles: ['C Admin'],
      },
      activeOrganization: 'Southern Basin Energy Pty Ltd',
      setCurrentHashView: vi.fn(),
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.tiles.find((t) => t.id === 'perf_findings')?.value).toBe(1);
    expect(config.actionItems).toHaveLength(1);
    expect(config.actionItems[0].id).toBe('AS-CLIENT-A');
  });
});

describe('Administrator (Vessel Admin) dashboard config', () => {
  it('builds fleet and compliance KPI cards distinct from Client Admin and scopes actions to organization', () => {
    const setCurrentHashView = vi.fn();
    const vessels: VesselInformation[] = [
      {
        id: 'VES-NW-1',
        name: 'MV Northwind One',
        imoNumber: '9000001',
        registeredOwner: 'Northwind Marine Pty Ltd',
        complianceReadinessScore: 70,
      } as unknown as VesselInformation,
      {
        id: 'VES-OTHER-1',
        name: 'MV Meridian Other',
        imoNumber: '9000002',
        registeredOwner: 'Meridian Shipyards',
        complianceReadinessScore: 100,
      } as unknown as VesselInformation,
    ];
    const sets: AssuranceSet[] = [
      {
        id: 'AS-NW-1',
        title: 'Annual Charter',
        vesselId: 'VES-NW-1',
        vesselName: 'MV Northwind One',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        createdByUserId: 'USR-101',
        createdByName: 'K. Osei',
        stage: 'Verification',
        assignedSubmitter: '',
        charterWindowStart: '2026-11-12T00:00:00Z',
        requirements: [
          {
            id: 'REQ-1',
            title: 'Safety Equipment Certificate',
            isMandatory: true,
            isFulfilled: false,
            documentId: 'DOC-NW-RET',
            verifierStatus: 'Correction Requested',
          },
        ],
      } as unknown as AssuranceSet,
      {
        id: 'AS-OTHER-1',
        title: 'Meridian Set',
        vesselId: 'VES-OTHER-1',
        vesselName: 'MV Meridian Other',
        serviceProviderOrg: 'Meridian Shipyards',
        createdByUserId: 'USR-OTHER',
        createdByName: 'M. Other',
        stage: 'Verification',
        assignedSubmitter: '',
        requirements: [],
      } as unknown as AssuranceSet,
    ];
    const documents: MasterDocument[] = [
      {
        id: 'DOC-NW-EXP',
        title: 'Class Certificate',
        vesselId: 'VES-NW-1',
        expiryDate: '2026-12-15T00:00:00Z',
        verificationStatus: 'Verified',
        complianceState: 'Expiring < 6 Mos',
        versions: [],
      } as unknown as MasterDocument,
      {
        id: 'DOC-OTHER-EXP',
        title: 'Other Expiring Certificate',
        vesselId: 'VES-OTHER-1',
        expiryDate: '2026-12-10T00:00:00Z',
        verificationStatus: 'Verified',
        complianceState: 'Expiring < 6 Mos',
        versions: [],
      } as unknown as MasterDocument,
    ];
    const capas: CapaItem[] = [
      {
        id: 'CAPA-NW-1',
        title: 'Calibrate OWS',
        vesselId: 'VES-NW-1',
        vesselName: 'MV Northwind One',
        status: 'Open',
      } as unknown as CapaItem,
      {
        id: 'CAPA-OTHER-1',
        title: 'Other Org Finding',
        vesselId: 'VES-OTHER-1',
        vesselName: 'MV Meridian Other',
        status: 'Open',
      } as unknown as CapaItem,
    ];

    const config = getAdministratorDashboardConfig({
      vessels,
      assuranceSets: sets,
      documents,
      capaItems: capas,
      auditEvents: mockAuditEvents,
      sessionUser: {
        id: 'USR-101',
        name: 'K. Osei',
        organization: 'Northwind Marine Pty Ltd',
        roles: ['Administrator'],
      },
      activeOrganization: 'Northwind Marine Pty Ltd',
      setCurrentHashView,
      now: new Date('2026-11-05T00:00:00Z'),
    });

    expect(config.roleTitle).toBe('Administrator');
    expect(config.tiles.map((t) => t.label)).toEqual([
      'Vessels',
      'Average readiness',
      'Assurance sets',
      'Expiring soon',
    ]);
    expect(config.tiles.find((t) => t.id === 'vessels')?.value).toBe(1);
    expect(config.tiles.find((t) => t.id === 'average_readiness')?.value).toBe('40%');
    expect(config.tiles.find((t) => t.id === 'assurance_sets')?.value).toBe(1);
    expect(config.tiles.find((t) => t.id === 'expiring_soon')?.value).toBe(1);

    expect(config.actionItems.map((item) => item.buttonLabel)).toEqual([
      'Assign',
      'Re-upload',
      'Renew',
      'Respond',
    ]);

    config.tiles.find((t) => t.id === 'expiring_soon')?.onClick?.();
    expect(setCurrentHashView).toHaveBeenCalledWith('documents');

    render(<SharedDashboardFrame config={config} />);
    expect(screen.queryByTestId('performance-measures-strip')).toBeNull();
    expect(screen.getByText('Vessels')).toBeInTheDocument();
  });
});
