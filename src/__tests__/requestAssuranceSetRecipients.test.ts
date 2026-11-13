import { describe, expect, it } from 'vitest';
import {
  getAssuranceSetRequestRecipients,
  getRequestDirection,
} from '../utils/assuranceRequestHelpers';
import { syncInvitedOrganizationsToParties } from '../utils/projectHelpers';
import type { UserProfile } from '../types/user';
import type { ContractParty, Project } from '../types/project';

const user = (
  id: string,
  name: string,
  organization: string,
  roles: string[],
  status: UserProfile['status'] = 'Active',
): UserProfile => ({
  id,
  name,
  email: `${id}@example.com`,
  roles: roles as UserProfile['roles'],
  userType: 'Organization',
  organization,
  departmentOrScope: '',
  status,
  lastActive: '',
});

const parties: ContractParty[] = [
  { organization: 'Client Co', group: 'Client', chainRole: 'client' },
  { organization: 'Head Co', group: 'Vendor', chainRole: 'head_contractor' },
  { organization: 'Vendor Co', group: 'Vendor', chainRole: 'vendor' },
  { organization: 'Review Co', group: 'Third party' },
  { organization: 'No Staff Co', group: 'Vendor' },
];

const users = [
  user('U1', 'Sender', 'Client Co', ['C Admin']),
  user('U2', 'Client Submitter', 'Client Co', ['Submitter']),
  user('U3', 'Head Submitter', 'Head Co', ['Submitter']),
  user('U4', 'Head Admin', 'Head Co', ['C Admin']),
  user('U5', 'Vendor Submitter', 'Vendor Co', ['Administrator', 'Submitter']),
  user('U6', 'Vendor Inactive', 'Vendor Co', ['Submitter'], 'Inactive'),
  user('U7', 'Outsider Submitter', 'Outside Co', ['Submitter']),
  user('U8', 'Head Co Ltd Submitter', 'Head Co Ltd', ['Submitter']),
  user('U9', 'Head Second Submitter', 'Head Co', ['Submitter']),
  user('U10', 'Review Co Admin', 'Review Co', ['Administrator']),
  user('U11', 'Head Admin Actual', 'Head Co', ['Administrator']),
  user('U12', 'Invited Admin', 'Invited Co', ['Administrator']),
  user('U13', 'Invited Submitter', 'Invited Co', ['Submitter']),
];

describe('getAssuranceSetRequestRecipients', () => {
  const projectWithInvited: Pick<Project, 'contractParties' | 'invitedOrganizations'> = {
    contractParties: parties,
    invitedOrganizations: ['Client Co', 'Invited Co', 'Empty Invited Co'],
  };
  const recipients = getAssuranceSetRequestRecipients(
    users,
    projectWithInvited,
    'Client Co',
    'U1',
  );
  const ids = recipients.map((u) => u.id);

  it('lists both active Administrators and Submitters of other parties', () => {
    // Head Co has submitters U3, U9 and administrator U11
    const headRecipients = recipients.filter((r) => r.organization === 'Head Co');
    const headIds = headRecipients.map((u) => u.id);
    expect(headIds).toContain('U3');
    expect(headIds).toContain('U9');
    expect(headIds).toContain('U11');
  });

  it('returns exactly one entry per dual-role user', () => {
    // U5 has both Administrator and Submitter roles
    const vendorRecipients = recipients.filter((r) => r.id === 'U5');
    expect(vendorRecipients).toHaveLength(1);
    expect(vendorRecipients[0].roles).toContain('Administrator');
    expect(vendorRecipients[0].roles).toContain('Submitter');
  });

  it('never lists the sender, the sender organization, or outside organizations', () => {
    expect(ids).not.toContain('U1'); // sender
    expect(ids).not.toContain('U2'); // sender organization
    expect(ids).not.toContain('U7'); // outside organization
    expect(ids).not.toContain('U8'); // overlapping outside organization
  });

  it('lists an invited organization that is not a contract party', () => {
    // Invited Co is in invitedOrganizations but not in contractParties
    const invitedRecipients = recipients.filter((r) => r.organization === 'Invited Co');
    const invitedIds = invitedRecipients.map((u) => u.id);
    expect(invitedIds).toContain('U12');
    expect(invitedIds).toContain('U13');
  });

  it('does not list an organization with no active Submitter or Administrator', () => {
    // No Staff Co has no users; Empty Invited Co has no users
    expect(recipients.some((r) => r.organization === 'No Staff Co')).toBe(false);
    expect(recipients.some((r) => r.organization === 'Empty Invited Co')).toBe(false);
  });

  it('returns an empty list when no other party has an active Submitter or Administrator', () => {
    const emptyPartyList: ContractParty[] = [
      { organization: 'Client Co', group: 'Client', chainRole: 'client' },
      { organization: 'Empty Co', group: 'Vendor' },
    ];
    expect(
      getAssuranceSetRequestRecipients(users, { contractParties: emptyPartyList }, 'Client Co', 'U1'),
    ).toEqual([]);
    expect(getAssuranceSetRequestRecipients(users, {}, 'Client Co', 'U1')).toEqual([]);
  });
});

describe('getRequestDirection', () => {
  it('returns recipient organization as requestingParty and sender as respondingParty for Administrator', () => {
    const adminUser = user('U10', 'Review Co Admin', 'Review Co', ['Administrator']);
    const direction = getRequestDirection('Client Co', adminUser);
    expect(direction).toEqual({
      requestingParty: 'Review Co',
      respondingParty: 'Client Co',
    });
  });

  it('returns sender organization as requestingParty and recipient as respondingParty for Submitter', () => {
    const submitterUser = user('U3', 'Head Submitter', 'Head Co', ['Submitter']);
    const direction = getRequestDirection('Client Co', submitterUser);
    expect(direction).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Head Co',
    });
  });

  it('treats a dual-role user as Administrator with flipped direction', () => {
    const dualUser = user('U5', 'Vendor User', 'Vendor Co', ['Administrator', 'Submitter']);
    const direction = getRequestDirection('Client Co', dualUser);
    expect(direction).toEqual({
      requestingParty: 'Vendor Co',
      respondingParty: 'Client Co',
    });
  });
});

describe('syncInvitedOrganizationsToParties', () => {
  it('automatically adds invited organizations not in contractParties as Vendor parties', () => {
    const initialProject: Project = {
      id: 'P-TEST',
      name: 'Test Project',
      projectType: 'Mixed / Composite',
      requestingOrganization: 'Client Co',
      operatorOrganization: 'Client Co',
      clientOperator: 'Client Co',
      location: 'Test Location',
      description: 'Test Description',
      status: 'Assurance In Progress',
      contractParties: [{ organization: 'Client Co', group: 'Client', chainRole: 'client' }],
      invitedOrganizations: ['Client Co', 'Invited Vendor Co', 'Another Invited Co'],
      assetLinks: [],
      charterWindowStart: '2026-01-01',
      charterWindowEnd: '2026-12-31',
    };

    const synced = syncInvitedOrganizationsToParties(initialProject);
    expect(synced.contractParties).toHaveLength(3);
    expect(synced.contractParties).toEqual([
      { organization: 'Client Co', group: 'Client', chainRole: 'client' },
      { organization: 'Invited Vendor Co', group: 'Vendor' },
      { organization: 'Another Invited Co', group: 'Vendor' },
    ]);
  });

  it('returns same project reference if all invited organizations are already listed', () => {
    const initialProject: Project = {
      id: 'P-TEST',
      name: 'Test Project',
      projectType: 'Mixed / Composite',
      requestingOrganization: 'Client Co',
      operatorOrganization: 'Client Co',
      clientOperator: 'Client Co',
      location: 'Test Location',
      description: 'Test Description',
      status: 'Assurance In Progress',
      contractParties: [
        { organization: 'Client Co', group: 'Client', chainRole: 'client' },
        { organization: 'Vendor Co', group: 'Vendor' },
      ],
      invitedOrganizations: ['Client Co', 'Vendor Co'],
      assetLinks: [],
      charterWindowStart: '2026-01-01',
      charterWindowEnd: '2026-12-31',
    };

    const synced = syncInvitedOrganizationsToParties(initialProject);
    expect(synced).toBe(initialProject);
  });
});
