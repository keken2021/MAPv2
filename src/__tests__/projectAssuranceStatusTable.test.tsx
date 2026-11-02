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

  it('sorts by name and stage, defaulting to worst first', () => {
    const { container } = renderTable();

    fireEvent.click(screen.getByText('Assurance set'));
    expect(rowIds(container)[0]).toBe('AS-RED');
    fireEvent.click(screen.getByText('Assurance set'));
    expect(rowIds(container)[0]).toBe('AS-OWN');

    fireEvent.click(screen.getByText('Stage'));
    expect(rowIds(container)[0]).toBe('AS-RED');
    expect(rowIds(container)[rowIds(container).length - 1]).toBe('AS-GO');
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

  it('omits role filter tabs so role filtering relies on header persona selection', () => {
    renderTable({ organization: 'Own Co' });
    expect(screen.queryByRole('tab', { name: /As client/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /As provider/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Reviewing/ })).toBeNull();
  });

  it('does not display Your role, Next expiry, or Status columns', () => {
    renderTable();
    expect(screen.queryByText('Your role')).toBeNull();
    expect(screen.queryByText('Next expiry')).toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
  });

  it('shows only the title, stage badge, and blocking count', () => {
    const { container } = renderTable();
    const row = container.querySelector('tr[data-set-id="AS-RED-READY"]') as HTMLElement;
    expect(within(row).getByText('Charlie')).toBeInTheDocument();
    expect(within(row).getByText('Approval')).toBeInTheDocument();
    expect(within(row).queryByText('AS-RED-READY')).toBeNull();
    expect(within(row).queryByText(/MV Charlie/)).toBeNull();
    expect(within(row).queryByText('No-go')).toBeNull();
    expect(within(row).getByText('1 blocking')).toBeInTheDocument();
    expect(within(row).queryByText('Expired')).toBeNull();
  });

  it('uses ListToolbar to search across titles, IDs, stages, objects and blocking reasons', () => {
    const { container } = renderTable();
    expect(container.querySelector('.map-list-toolbar')).not.toBeNull();

    const searchInput = screen.getByRole('textbox', { name: /search assurance sets/i });

    fireEvent.change(searchInput, { target: { value: 'Bravo' } });
    expect(rowIds(container)).toEqual(['AS-GO']);

    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    expect(rowIds(container)).toEqual(['AS-RED']);

    fireEvent.change(searchInput, { target: { value: 'Rejected' } });
    expect(rowIds(container)).toEqual(['AS-RED']);

    fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } });
    expect(rowIds(container)).toEqual([]);
    expect(screen.getByText('No assurance sets match these filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(rowIds(container).length).toBe(6);
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

  it('has no pillar filter, shows Objects tab without Asset ID column, and hides removed assurance columns', () => {
    render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />);
    expect(screen.queryByLabelText('Assurance pillar filter')).toBeNull();
    expect(screen.queryByRole('button', { name: 'People' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Process' })).toBeNull();
    expect(screen.queryByText('Your role')).toBeNull();
    expect(screen.queryByText('Next expiry')).toBeNull();

    expect(screen.getByRole('button', { name: 'Objects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asset Roster' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Objects' }));
    expect(screen.queryByText('Asset ID')).toBeNull();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('allows searching in the Objects tab using ListToolbar', () => {
    const { container } = render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />);
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }));

    expect(container.querySelector('.map-list-toolbar')).not.toBeNull();
    const searchInput = screen.getByRole('textbox', { name: /search objects/i });
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'nonexistent-asset-query' } });
    expect(screen.getByText('No objects match these filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.queryByText('No objects match these filters.')).toBeNull();
  });

  it('renders matching filter tabs (CountTabs) and ListToolbar layout on both tabs', () => {
    const { container } = render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />);

    // Assurance sets tab layout
    expect(container.querySelector('.card .map-count-tabs')).not.toBeNull();
    expect(container.querySelector('.card .map-list-toolbar')).not.toBeNull();

    // Switch to Objects tab
    fireEvent.click(screen.getByRole('button', { name: 'Objects' }));

    // Objects tab layout has matching CountTabs and ListToolbar structure
    expect(container.querySelector('.card .map-count-tabs')).not.toBeNull();
    expect(container.querySelector('.card .map-list-toolbar')).not.toBeNull();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /vessel/i })).toBeInTheDocument();
  });

  it('has a Details tab showing project information and contract parties', () => {
    render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />);
    const detailsTab = screen.getByRole('button', { name: 'Details' });
    expect(detailsTab).toBeInTheDocument();

    fireEvent.click(detailsTab);
    expect(screen.getByText('Project Information')).toBeInTheDocument();
    expect(screen.getByText('Contract & Parties')).toBeInTheDocument();
    expect(screen.getByText('Overall Project Readiness')).toBeInTheDocument();
  });
});
