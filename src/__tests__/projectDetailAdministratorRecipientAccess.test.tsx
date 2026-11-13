import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';
import type { Project } from '../types/project';
import type { UserProfile } from '../types/user';
import type { AppNotification } from '../types/notification';

const vendorProject: Project = {
  id: 'PRJ-VENDOR-OWNED',
  name: 'Sentinel Marine Offshore Project',
  projectType: 'Mixed / Composite',
  ownerOrganization: 'Sentinel Marine Ltd',
  requestingOrganization: 'Sentinel Marine Ltd',
  operatorOrganization: 'Sentinel Marine Ltd',
  clientOperator: 'Sentinel Marine Ltd',
  location: 'North Sea',
  description: 'Vendor owned project where client administrator is invited',
  status: 'Assurance In Progress',
  contractParties: [
    { organization: 'Sentinel Marine Ltd', group: 'Vendor', chainRole: 'head_contractor' },
    { organization: 'Oil Company', group: 'Client', chainRole: 'client' },
  ],
  invitedOrganizations: ['Sentinel Marine Ltd', 'Oil Company', 'Invited Provider Corp'],
  assetLinks: [],
  charterWindowStart: '2026-01-01',
  charterWindowEnd: '2026-12-31',
};

const adminRecipient: UserProfile = {
  id: 'USR-OILCO-ADMIN',
  name: 'OilCo Administrator',
  email: 'admin@oilco.example',
  roles: ['Administrator'],
  userType: 'Organization',
  organization: 'Oil Company',
  departmentOrScope: 'Assurance',
  status: 'Active',
  lastActive: '',
};

const requestNotification: AppNotification = {
  id: 'NOTIF-REQ-001',
  type: 'assurance_set_request',
  status: 'unread',
  createdAt: new Date().toISOString(),
  recipientUserId: adminRecipient.id,
  senderUserId: 'USR-SENTINEL-SENDER',
  senderName: 'Sentinel Sender',
  projectId: vendorProject.id,
  projectName: vendorProject.name,
  subject: 'Request: Create assurance set',
  message: 'Please create assurance set as requesting party',
  requestingParty: 'Oil Company',
  respondingParty: 'Sentinel Marine Ltd',
  partyRoles: {
    requestingParty: 'Oil Company',
    respondingParty: 'Sentinel Marine Ltd',
    'Oil Company': 'Requesting party',
    'Sentinel Marine Ltd': 'Responding party',
  },
  request: {
    assigneeUserId: adminRecipient.id,
    assigneeName: adminRecipient.name,
    clientOrganization: 'Sentinel Marine Ltd',
    requestingParty: 'Oil Company',
    respondingParty: 'Sentinel Marine Ltd',
    partyRoles: {
      requestingParty: 'Oil Company',
      respondingParty: 'Sentinel Marine Ltd',
      'Oil Company': 'Requesting party',
      'Sentinel Marine Ltd': 'Responding party',
    },
  },
};

describe('ProjectDetailView recipient access for Administrator', () => {
  beforeEach(() => {
    useMapStore.setState({
      projects: [vendorProject],
      users: [adminRecipient],
      notifications: [requestNotification],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: adminRecipient.id,
      pendingAssuranceRequestNotificationId: undefined,
      lockedProjectId: undefined,
      returnToProjectId: undefined,
      currentHashView: 'projects',
    });
  });

  it('allows an Administrator recipient whose organization is the requestingParty to see Create Assurance Set from request', () => {
    render(<ProjectDetailView projectId={vendorProject.id} />);

    // Oil Company does not own Sentinel Marine's project, so normal management is disabled,
    // but the open request allows creating from request
    const createBtn = screen.getByTestId('create-set-from-request');
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveTextContent('Create Assurance Set');

    fireEvent.click(createBtn);

    const state = useMapStore.getState();
    expect(state.pendingAssuranceRequestNotificationId).toBe(requestNotification.id);
    expect(state.lockedProjectId).toBe(vendorProject.id);
    expect(state.returnToProjectId).toBe(vendorProject.id);
    expect(state.currentHashView).toBe('create-assurance-set');
  });

  it('shows an invited organization on the Organizations card with no edit', () => {
    render(<ProjectDetailView projectId={vendorProject.id} />);

    // Switch to Details tab
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

    // Invited organization is derived on read and shown on Organizations card
    expect(screen.getByText('Invited Provider Corp')).toBeInTheDocument();
  });
});
