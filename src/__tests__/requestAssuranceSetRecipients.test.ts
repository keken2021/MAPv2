import { describe, expect, it } from 'vitest';
import { getAssuranceSetRequestRecipients } from '../utils/assuranceRequestHelpers';
import { syncInvitedOrganizationsToParties } from '../utils/projectHelpers';
import type { UserProfile } from '../types/user';
import type { ContractParty, Project } from '../types/project';

const user = (id: string, name: string, organization: string, roles: string[], status: UserProfile['status'] = 'Active'): UserProfile => ({
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
];

describe('getAssuranceSetRequestRecipients', () => {
  const recipients = getAssuranceSetRequestRecipients(users, { contractParties: parties }, 'Client Co', 'U1');
  const ids = recipients.map((u) => u.id);

  it('lists active Submitters of the other contract parties, in party order', () => {
    expect(ids).toContain('U3');
    expect(ids).toContain('U9');
    expect(ids).toContain('U5');
  });

  it('lists all active submitters when an organization has multiple submitters', () => {
    const headSubmitters = recipients.filter((r) => r.organization === 'Head Co');
    expect(headSubmitters.map((u) => u.id)).toEqual(['U3', 'U9']);
  });

  it('falls back to active Administrator if an organization has no submitter', () => {
    const reviewRecipients = recipients.filter((r) => r.organization === 'Review Co');
    expect(reviewRecipients.map((u) => u.id)).toEqual(['U10']);
  });

  it('never lists a C Admin, the sender, or anyone in the sender organization', () => {
    expect(ids).not.toContain('U4');
    expect(ids).not.toContain('U1');
    expect(ids).not.toContain('U2');
  });

  it('never lists an organization that is not a party, even one whose name overlaps', () => {
    expect(ids).not.toContain('U7');
    expect(ids).not.toContain('U8');
  });

  it('returns an empty list when no other party has a Submitter or Administrator', () => {
    const emptyPartyList: ContractParty[] = [
      { organization: 'Client Co', group: 'Client', chainRole: 'client' },
      { organization: 'Empty Co', group: 'Vendor' },
    ];
    expect(getAssuranceSetRequestRecipients(users, { contractParties: emptyPartyList }, 'Client Co', 'U1')).toEqual([]);
    expect(getAssuranceSetRequestRecipients(users, {}, 'Client Co', 'U1')).toEqual([]);
  });
});

describe('syncInvitedOrganizationsToParties', () => {
  it('automatically adds invited organizations not in contractParties as Vendor parties', () => {
    const initialProject: Project = {
      id: 'P-TEST',
      name: 'Test Project',
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
