import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { EditParticipatingOrganizationsModal } from '../components/modals/EditParticipatingOrganizationsModal';
import { RequestAssuranceSetModal } from '../components/modals/RequestAssuranceSetModal';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { OIL_CO_LNG_PROJECT_ID, OIL_CO_ORG } from '../store/oilCoLngPilotMockData';
import type { Project } from '../types/project';

const testProject: Project = {
  id: 'PRJ-TEST-ORGS',
  name: 'Test Platform Project',
  projectType: 'Mixed / Composite',
  status: 'Assurance In Progress',
  ownerOrganization: 'Oil Company',
  requestingOrganization: 'Oil Company',
  operatorOrganization: 'Oil Company',
  clientOperator: 'Oil Company',
  location: 'North West Shelf',
  description: 'Test platform project for participating organizations',
  charterWindowStart: '2026-01-01',
  charterWindowEnd: '2026-12-31',
  contractParties: [
    { organization: 'Oil Company', group: 'Client', chainRole: 'client' },
    { organization: 'Primary Vendor', group: 'Vendor', chainRole: 'vendor' },
    { organization: 'Existing Part Org', group: 'Third party' },
  ],
  invitedOrganizations: ['Oil Company', 'Primary Vendor', 'Existing Part Org'],
  assetLinks: [],
};

const initialState = useMapStore.getState();

describe('EditParticipatingOrganizationsModal', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      projects: [...initialState.projects, testProject],
      activePersona: 'C Admin',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: 'USR-228',
    });
  });

  it('renders existing participating organizations and allows adding and removing', () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <EditParticipatingOrganizationsModal
        isOpen={true}
        onClose={onClose}
        project={testProject}
        onSuccess={onSuccess}
      />,
    );

    // Should see Existing Part Org in table
    expect(screen.getByText('Existing Part Org')).toBeInTheDocument();

    // Add a new organization
    const input = screen.getByLabelText(/Organization name/i);
    fireEvent.change(input, { target: { value: 'New Marine Services' } });

    const addButton = screen.getByTestId('btn-add-org-to-list');
    fireEvent.click(addButton);

    expect(screen.getByText('New Marine Services')).toBeInTheDocument();

    // Save changes
    const saveButton = screen.getByTestId('btn-save-participating-orgs');
    fireEvent.click(saveButton);

    expect(onSuccess).toHaveBeenCalledWith('Organizations updated.');
    expect(onClose).toHaveBeenCalled();

    const updated = useMapStore.getState().projects.find((p) => p.id === testProject.id)!;
    expect(updated.contractParties?.some((p) => p.organization === 'New Marine Services')).toBe(true);
    expect(updated.invitedOrganizations).toContain('New Marine Services');
  });

  it('removes an organization when delete button is clicked', () => {
    const onClose = vi.fn();
    render(
      <EditParticipatingOrganizationsModal
        isOpen={true}
        onClose={onClose}
        project={testProject}
      />,
    );

    expect(screen.getByText('Existing Part Org')).toBeInTheDocument();

    const deleteBtn = screen.getByTestId('btn-remove-org-0');
    fireEvent.click(deleteBtn);

    expect(screen.queryByText('Existing Part Org')).toBeNull();

    const saveButton = screen.getByTestId('btn-save-participating-orgs');
    fireEvent.click(saveButton);

    const updated = useMapStore.getState().projects.find((p) => p.id === testProject.id)!;
    expect(updated.contractParties?.some((p) => p.organization === 'Existing Part Org')).toBe(false);
  });

  it('edit the vendor, and the old vendor shows under participating', () => {
    const onSuccess = vi.fn();
    render(
      <EditParticipatingOrganizationsModal
        isOpen={true}
        onClose={vi.fn()}
        project={testProject}
        onSuccess={onSuccess}
      />,
    );

    const vendorInput = screen.getByTestId('input-vendor');
    expect(vendorInput).toHaveValue('Primary Vendor');

    fireEvent.change(vendorInput, { target: { value: 'New Vendor Co' } });

    const saveButton = screen.getByTestId('btn-save-participating-orgs');
    fireEvent.click(saveButton);

    expect(onSuccess).toHaveBeenCalledWith('Organizations updated.');
    const updated = useMapStore.getState().projects.find((p) => p.id === testProject.id)!;
    expect(updated.contractParties?.find((p) => p.chainRole === 'vendor')?.organization).toBe('New Vendor Co');

    const oldVendorParty = updated.contractParties?.find((p) => p.organization === 'Primary Vendor');
    expect(oldVendorParty).toBeDefined();
    expect(oldVendorParty?.chainRole).toBeUndefined();
    expect(oldVendorParty?.group).toBe('Vendor');
  });

  it('the client is not editable', () => {
    render(
      <EditParticipatingOrganizationsModal
        isOpen={true}
        onClose={vi.fn()}
        project={testProject}
      />,
    );

    const clientDisplay = screen.getByTestId('contract-chain-client-display');
    expect(clientDisplay).toHaveTextContent('Oil Company');
    expect(screen.queryByLabelText(/^Client$/i)?.tagName).not.toBe('INPUT');
  });

});

describe('RequestAssuranceSetModal edit organizations integration', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
  });

  it('shows Edit participating organizations button for C Admin', () => {
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={project}
        onSuccess={vi.fn()}
      />,
    );

    const editBtn = screen.getByTestId('btn-edit-participating-orgs-from-modal');
    expect(editBtn).toBeInTheDocument();

    // Clicking it opens the EditParticipatingOrganizationsModal
    fireEvent.click(editBtn);
    expect(screen.getByTestId('btn-save-participating-orgs')).toBeInTheDocument();
  });

  it('a vendor Administrator sees no edit option in the Request Assurance Set modal', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={project}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('btn-edit-participating-orgs-from-modal')).toBeNull();
  });

});

describe('ProjectDetailView participating organizations auto-sync and edit', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
  });

  it('derives invited organizations on read in the Organizations card without saving until edited', () => {
    const projectWithMissingParties: Project = {
      ...testProject,
      id: 'PRJ-AUTO-SYNC-TEST',
      contractParties: [{ organization: 'Oil Company', group: 'Client', chainRole: 'client' }],
      invitedOrganizations: ['Oil Company', 'Auto Invited Vendor'],
    };

    useMapStore.setState({
      projects: [...useMapStore.getState().projects, projectWithMissingParties],
    });

    render(<ProjectDetailView projectId="PRJ-AUTO-SYNC-TEST" />);

    // 1. Not saved to store project on mount
    const initialStoreProject = useMapStore.getState().projects.find((p) => p.id === 'PRJ-AUTO-SYNC-TEST')!;
    expect(initialStoreProject.contractParties?.some((p) => p.organization === 'Auto Invited Vendor')).toBe(false);

    // 2. Organizations card shows the invited organization with no edit
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(screen.getByText('Auto Invited Vendor')).toBeInTheDocument();

    // 3. Saved to project only when client saves in Edit organizations
    const editBtn = screen.getByTestId('btn-edit-participating-orgs');
    fireEvent.click(editBtn);
    const saveButton = screen.getByTestId('btn-save-participating-orgs');
    fireEvent.click(saveButton);

    const savedStoreProject = useMapStore.getState().projects.find((p) => p.id === 'PRJ-AUTO-SYNC-TEST')!;
    expect(savedStoreProject.contractParties?.some((p) => p.organization === 'Auto Invited Vendor')).toBe(true);
  });

  it('shows Edit button on Organizations & Contract Chain card for manager', () => {
    render(<ProjectDetailView projectId={OIL_CO_LNG_PROJECT_ID} />);

    // Switch to Details tab
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

    const editBtn = screen.getByTestId('btn-edit-participating-orgs');
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(screen.getByTestId('btn-save-participating-orgs')).toBeInTheDocument();
  });

  it('a vendor Administrator sees no Edit button on Organizations & Contract Chain card', () => {
    const vendorAdminProject: Project = {
      ...testProject,
      id: 'PRJ-VENDOR-VIEW-TEST',
      stakeholderUserIds: ['USR-101'],
    };

    useMapStore.setState({
      projects: [...useMapStore.getState().projects, vendorAdminProject],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });

    render(<ProjectDetailView projectId="PRJ-VENDOR-VIEW-TEST" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

    expect(screen.getByText('Organizations & Contract Chain')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-edit-participating-orgs')).toBeNull();
  });
});
