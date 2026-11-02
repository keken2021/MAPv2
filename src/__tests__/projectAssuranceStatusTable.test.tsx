import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppSidebar } from '../components/layout/AppSidebar';
import { ProjectAssuranceStatusTable } from '../components/tables/ProjectAssuranceStatusTable';
import { AssuranceSetsView } from '../views/AssuranceSetsView';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import type { MasterDocument } from '../types/document';

const TODAY = new Date('2026-11-02T12:00:00');

function task(overrides: Partial<AssuranceRequirement> = {}): AssuranceRequirement {
  return {
    id: 'R1',
    category: 'Statutory Certificate',
    title: 'Safety Certificate',
    isMandatory: true,
    isFulfilled: true,
    ocrConfidence: 100,
    verifierStatus: 'Verified',
    documentId: 'DOC-FAR',
    ...overrides,
  } as AssuranceRequirement;
}

function set(id: string, title: string, overrides: Partial<AssuranceSet> = {}): AssuranceSet {
  return {
    id,
    title,
    vesselId: `V-${id}`,
    vesselName: `MV ${title}`,
    imoNumber: '1',
    initiatorOrg: 'Client Co',
    initiatorRole: 'Client Admin',
    clientOrg: 'Client Co',
    serviceProviderOrg: 'Vendor Co',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-01',
    complianceDeadline: '2026-12-01',
    stage: 'Verification',
    readinessScore: 50,
    requirements: [task()],
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    ...overrides,
  } as AssuranceSet;
}

const documents = [
  { id: 'DOC-FAR', expiryDate: '2028-01-01' },
  { id: 'DOC-NEAR', expiryDate: '2026-11-20' },
  { id: 'DOC-EXPIRED', expiryDate: '2026-10-01' },
] as MasterDocument[];

/* go: closed and clean; awaiting: open with nothing wrong; expiring: amber; two no-go sets, the less ready one first */
const SETS = [
  set('AS-GO', 'Bravo', { stage: 'Approved', approverDecision: 'Approved' }),
  set('AS-WAIT', 'Echo', { stage: 'Approval', requirements: [task()] }),
  set('AS-SOON', 'Delta', { stage: 'Verification', requirements: [task({ documentId: 'DOC-NEAR' })] }),
  set('AS-RED-READY', 'Charlie', { stage: 'Approval', requirements: [task({ documentId: 'DOC-EXPIRED' })] }),
  set('AS-RED', 'Alpha', {
    stage: 'Initiated',
    requirements: [task({ documentId: undefined, isFulfilled: false, verifierStatus: 'Rejected' })],
  }),
  set('AS-OWN', 'Foxtrot', { stage: 'Validation', clientOrg: 'Own Co', serviceProviderOrg: 'Own Co' }),
];

const renderTable = (viewer = { organization: 'Client Co' }) =>
  render(
    <ProjectAssuranceStatusTable
      sets={SETS}
      allSets={SETS}
      documents={documents}
      capaItems={[]}
      viewer={viewer}
      canOpenSet={() => true}
      onOpenSet={vi.fn()}
      today={TODAY}
    />,
  );

const rowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr[data-set-id]')).map((row) => row.getAttribute('data-set-id'));

const clickTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

describe('ProjectAssuranceStatusTable', () => {
  it('lists worst first, least ready first within a group', () => {
    const { container } = renderTable();
    const ids = rowIds(container);
    expect(ids.slice(0, 2)).toEqual(['AS-RED', 'AS-RED-READY']);
    expect(ids[ids.length - 1]).toBe('AS-GO');
    expect(ids.indexOf('AS-SOON')).toBeGreaterThan(1);
  });

  it('sorts by name, stage and next expiry, and the Status header returns to worst first', () => {
    const { container } = renderTable();
    const worstFirst = rowIds(container);

    fireEvent.click(screen.getByText('Assurance set'));
    expect(rowIds(container)[0]).toBe('AS-RED');
    fireEvent.click(screen.getByText('Assurance set'));
    expect(rowIds(container)[0]).toBe('AS-OWN');

    fireEvent.click(screen.getByText('Readiness'));
    expect(rowIds(container)[0]).toBe('AS-RED');
    expect(rowIds(container)[rowIds(container).length - 1]).toBe('AS-GO');

    fireEvent.click(screen.getByText('Next expiry'));
    expect(rowIds(container)[0]).toBe('AS-RED-READY');
    expect(rowIds(container)[1]).toBe('AS-SOON');
    /* the set with no expiry stays last */
    expect(rowIds(container)[rowIds(container).length - 1]).toBe('AS-RED');

    fireEvent.click(screen.getByText('Status'));
    expect(rowIds(container)).toEqual(worstFirst);
  });

  it('filters by each status tab, with counts', () => {
    const { container } = renderTable();

    expect(screen.getByRole('tab', { name: /^All \(6\)/ })).toBeInTheDocument();
    clickTab(/Needs attention \(3\)/);
    expect(rowIds(container).sort()).toEqual(['AS-RED', 'AS-RED-READY', 'AS-SOON']);

    clickTab(/On track \(2\)/);
    expect(rowIds(container).sort()).toEqual(['AS-OWN', 'AS-WAIT']);

    clickTab(/Done \(1\)/);
    expect(rowIds(container)).toEqual(['AS-GO']);
  });

  it('filters by each role tab, and each row counts within the other', () => {
    const { container } = renderTable({ organization: 'Own Co' });

    clickTab(/As client \(1\)/);
    expect(rowIds(container)).toEqual(['AS-OWN']);
    expect(screen.getByRole('tab', { name: /On track \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Done \(0\)/ })).toBeInTheDocument();

    clickTab(/As provider \(1\)/);
    expect(rowIds(container)).toEqual(['AS-OWN']);

    clickTab(/Reviewing \(0\)/);
    expect(rowIds(container)).toEqual([]);
    expect(screen.getByText('No assurance sets match these filters.')).toBeInTheDocument();
  });

  it('shows both roles and the other parties for a client who is also the provider', () => {
    const { container } = renderTable({ organization: 'Own Co' });
    const row = container.querySelector('tr[data-set-id="AS-OWN"]') as HTMLElement;
    expect(within(row).getByText('As client')).toBeInTheDocument();
    expect(within(row).getByText('As provider')).toBeInTheDocument();
  });

  it('shows the status, the blocking count and an expired date', () => {
    const { container } = renderTable();
    const row = container.querySelector('tr[data-set-id="AS-RED-READY"]') as HTMLElement;
    expect(within(row).getByText('No-go')).toBeInTheDocument();
    expect(within(row).getByText('1 blocking')).toBeInTheDocument();
    expect(within(row).getByText('Expired')).toBeInTheDocument();
  });
});

describe('client Assurance Sets link', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      isAuthenticated: true,
      currentHashView: 'dashboard',
    });
  });

  it('shows the link in the side panel and opens the same list screen as the Administrator', () => {
    render(<AppSidebar />);
    expect(screen.getByText('Assurance Sets')).toBeInTheDocument();
    cleanup();

    render(<AssuranceSetsView />);
    ['Public', 'Organization', 'Drafts'].forEach((label) => {
      expect(screen.getByRole('tab', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    });
  });
});

describe('ProjectDetailView assurance tab', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('has no pillar filter and shows the status columns', () => {
    render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />);
    expect(screen.queryByLabelText('Assurance pillar filter')).toBeNull();
    expect(screen.queryByRole('button', { name: 'People' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Process' })).toBeNull();
    expect(screen.getByText('Your role')).toBeInTheDocument();
    expect(screen.getByText('Next expiry')).toBeInTheDocument();
  });
});
