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
  user('U2', 'Client Second Admin', 'Client Co', ['C Admin']),
  user('U3', 'Head Submitter', 'Head Co', ['Submitter']),
  user('U4', 'Head Client Admin', 'Head Co', ['C Admin']),
  user('U5', 'Vendor Client Admin', 'Vendor Co', ['C Admin', 'Submitter']),
  user('U6', 'Vendor Inactive Admin', 'Vendor Co', ['C Admin'], 'Inactive'),
  user('U7', 'Outsider Admin', 'Outside Co', ['C Admin']),
  user('U8', 'Head Co Ltd Admin', 'Head Co Ltd', ['C Admin']),
  user('U10', 'Review Co Administrator', 'Review Co', ['Administrator']),
  user('U11', 'Head Administrator', 'Head Co', ['Administrator']),
  user('U12', 'Invited Client Admin', 'Invited Co', ['C Admin']),
  user('U13', 'Invited Submitter', 'Invited Co', ['Submitter']),
];

describe('getAssuranceSetRequestRecipients', () => {
  const projectWithInvited: Pick<Project, 'contractParties' | 'invitedOrganizations'> = {
    contractParties: parties,
    invitedOrganizations: ['Client Co', 'Invited Co', 'Empty Invited Co'],
  };
  const recipientIds = () =>
    getAssuranceSetRequestRecipients(users, projectWithInvited, 'Client Co', 'U1').map((u) => u.id);

  it('lists only active Client Admins of the other organizations, in card order', () => {
    expect(recipientIds()).toEqual(['U4', 'U5', 'U12']);
  });

  it('leaves out Submitters and Administrators', () => {
    const ids = recipientIds();
    for (const id of ['U3', 'U10', 'U11', 'U13']) expect(ids).not.toContain(id);
  });

  it('never lists the sender, the sender organization, outside organizations or inactive users', () => {
    const ids = recipientIds();
    expect(ids).not.toContain('U1'); // sender
    expect(ids).not.toContain('U2'); // sender organization
    expect(ids).not.toContain('U7'); // outside organization
    expect(ids).not.toContain('U8'); // overlapping outside organization
    expect(ids).not.toContain('U6'); // inactive user
  });

  it('returns an empty list when no other organization has an active Client Admin', () => {
    const noAdminParties: ContractParty[] = [
      { organization: 'Client Co', group: 'Client', chainRole: 'client' },
      { organization: 'Review Co', group: 'Third party' },
    ];
    expect(
      getAssuranceSetRequestRecipients(users, { contractParties: noAdminParties }, 'Client Co', 'U1'),
    ).toEqual([]);
    expect(getAssuranceSetRequestRecipients(users, {}, 'Client Co', 'U1')).toEqual([]);
  });
});

describe('getRequestDirection', () => {
  it('makes the sender the requesting party and the recipient the responding party', () => {
    expect(getRequestDirection('Client Co', user('U4', 'Head Client Admin', 'Head Co', ['C Admin']))).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Head Co',
    });
    expect(getRequestDirection(' Client Co ', user('U11', 'Head Administrator', 'Head Co ', ['Administrator']))).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Head Co',
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
