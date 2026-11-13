import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import type { Project } from '../types/project';
import type { UserProfile } from '../types/user';

const testProject: Project = {
  id: 'PRJ-STORE-TEST',
  name: 'Store Test Project',
  projectType: 'Mixed / Composite',
  requestingOrganization: 'Oil Company',
  operatorOrganization: 'Oil Company',
  clientOperator: 'Oil Company',
  ownerOrganization: 'Oil Company',
  location: 'Test Location',
  description: 'Test project for store requestAssuranceSet',
  status: 'Assurance In Progress',
  contractParties: [
    { organization: 'Oil Company', group: 'Client', chainRole: 'client' },
    { organization: 'Northwind Marine Pty Ltd', group: 'Vendor', chainRole: 'head_contractor' },
  ],
  assetLinks: [],
  charterWindowStart: '2026-01-01',
  charterWindowEnd: '2026-12-31',
};

const senderUser: UserProfile = {
  id: 'USR-STORE-SENDER',
  name: 'Sender Admin',
  email: 'sender@oilco.example',
  roles: ['Administrator'],
  userType: 'Organization',
  organization: 'Oil Company',
  departmentOrScope: 'Marine',
  status: 'Active',
  lastActive: '',
};

const adminRecipient: UserProfile = {
  id: 'USR-STORE-ADMIN-RECIPIENT',
  name: 'Northwind Client Admin',
  email: 'admin@northwind.example',
  roles: ['C Admin'],
  userType: 'Organization',
  organization: 'Northwind Marine Pty Ltd',
  departmentOrScope: 'Operations',
  status: 'Active',
  lastActive: '',
};

const submitterRecipient: UserProfile = {
  id: 'USR-STORE-SUBMITTER-RECIPIENT',
  name: 'Northwind Submitter',
  email: 'submitter@northwind.example',
  roles: ['Submitter'],
  userType: 'Organization',
  organization: 'Northwind Marine Pty Ltd',
  departmentOrScope: 'Operations',
  status: 'Active',
  lastActive: '',
};

describe('requestAssuranceSet store action', () => {
  beforeEach(() => {
    useMapStore.setState({
      projects: [testProject],
      users: [senderUser, adminRecipient, submitterRecipient],
      activePersona: 'Administrator',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: senderUser.id,
      notifications: [],
    });
  });

  it('makes the sender the requesting party when the recipient is a Client Admin', () => {
    const { requestAssuranceSet } = useMapStore.getState();
    const result = requestAssuranceSet({
      projectId: testProject.id,
      recipientUserId: adminRecipient.id,
      senderUserId: senderUser.id,
      senderName: senderUser.name,
      message: 'Please create an assurance set for us.',
    });

    expect(result.success).toBe(true);

    const notifications = useMapStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    const notification = notifications[0];
    expect(notification.requestingParty).toBe('Oil Company');
    expect(notification.respondingParty).toBe('Northwind Marine Pty Ltd');
    expect(notification.partyRoles).toEqual({
      requestingParty: 'Oil Company',
      respondingParty: 'Northwind Marine Pty Ltd',
      'Oil Company': 'Requesting party',
      'Northwind Marine Pty Ltd': 'Responding party',
    });
    expect(notification.request?.requestingParty).toBe('Oil Company');
    expect(notification.request?.respondingParty).toBe('Northwind Marine Pty Ltd');
  });

  it("records today's standard parties when the recipient is a Submitter", () => {
    const { requestAssuranceSet } = useMapStore.getState();
    const result = requestAssuranceSet({
      projectId: testProject.id,
      recipientUserId: submitterRecipient.id,
      senderUserId: senderUser.id,
      senderName: senderUser.name,
      message: 'Please create an assurance set.',
    });

    expect(result.success).toBe(true);

    const notifications = useMapStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    const notification = notifications[0];

    // Standard parties: sender is Requesting party, recipient is Responding party
    expect(notification.requestingParty).toBe('Oil Company');
    expect(notification.respondingParty).toBe('Northwind Marine Pty Ltd');
    expect(notification.partyRoles).toEqual({
      requestingParty: 'Oil Company',
      respondingParty: 'Northwind Marine Pty Ltd',
      'Oil Company': 'Requesting party',
      'Northwind Marine Pty Ltd': 'Responding party',
    });
    expect(notification.request?.requestingParty).toBe('Oil Company');
    expect(notification.request?.respondingParty).toBe('Northwind Marine Pty Ltd');
  });
});
