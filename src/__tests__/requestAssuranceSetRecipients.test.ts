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

  it('by default (ask) lists active Submitters only of other parties', () => {
    const recipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
    );
    const ids = recipients.map((u) => u.id);

    // Head Co submitters: U3, U9 (not admins U4, U11)
    expect(ids).toContain('U3');
    expect(ids).toContain('U9');
    expect(ids).not.toContain('U4');
    expect(ids).not.toContain('U11');

    // Vendor Co submitter: U5
    expect(ids).toContain('U5');

    // Invited Co submitter: U13 (not admin U12)
    expect(ids).toContain('U13');
    expect(ids).not.toContain('U12');

    // Review Co has only administrator U10, so not in ask
    expect(ids).not.toContain('U10');
  });

  it('in invite mode lists active Administrators only of other parties', () => {
    const recipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'invite',
    );
    const ids = recipients.map((u) => u.id);

    // Head Co administrators: U4, U11 (not submitters U3, U9)
    expect(ids).toContain('U4');
    expect(ids).toContain('U11');
    expect(ids).not.toContain('U3');
    expect(ids).not.toContain('U9');

    // Review Co administrator: U10
    expect(ids).toContain('U10');

    // Invited Co administrator: U12 (not submitter U13)
    expect(ids).toContain('U12');
    expect(ids).not.toContain('U13');
  });

  it('a dual-role user appears in both ask and invite lists', () => {
    const askRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'ask',
    );
    const inviteRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'invite',
    );

    const vendorAsk = askRecipients.filter((r) => r.id === 'U5');
    const vendorInvite = inviteRecipients.filter((r) => r.id === 'U5');
    expect(vendorAsk).toHaveLength(1);
    expect(vendorInvite).toHaveLength(1);
  });

  it('never lists the sender, the sender organization, or outside organizations', () => {
    for (const dir of ['ask', 'invite'] as const) {
      const recipients = getAssuranceSetRequestRecipients(
        users,
        projectWithInvited,
        'Client Co',
        'U1',
        dir,
      );
      const ids = recipients.map((u) => u.id);
      expect(ids).not.toContain('U1'); // sender
      expect(ids).not.toContain('U2'); // sender organization
      expect(ids).not.toContain('U7'); // outside organization
      expect(ids).not.toContain('U8'); // overlapping outside organization
      expect(ids).not.toContain('U6'); // inactive user
    }
  });

  it('lists an invited organization that is not a contract party', () => {
    const askRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'ask',
    );
    expect(askRecipients.some((r) => r.id === 'U13')).toBe(true);

    const inviteRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'invite',
    );
    expect(inviteRecipients.some((r) => r.id === 'U12')).toBe(true);
  });

  it('does not list an organization with no active Submitter in ask or Administrator in invite', () => {
    // Review Co has no submitters
    const askRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'ask',
    );
    expect(askRecipients.some((r) => r.organization === 'Review Co')).toBe(false);
    expect(askRecipients.some((r) => r.organization === 'No Staff Co')).toBe(false);
    expect(askRecipients.some((r) => r.organization === 'Empty Invited Co')).toBe(false);

    // Empty Co has no users
    const inviteRecipients = getAssuranceSetRequestRecipients(
      users,
      projectWithInvited,
      'Client Co',
      'U1',
      'invite',
    );
    expect(inviteRecipients.some((r) => r.organization === 'No Staff Co')).toBe(false);
    expect(inviteRecipients.some((r) => r.organization === 'Empty Invited Co')).toBe(false);
  });

  it('returns an empty list when no other party has an active member for the direction', () => {
    const emptyPartyList: ContractParty[] = [
      { organization: 'Client Co', group: 'Client', chainRole: 'client' },
      { organization: 'Empty Co', group: 'Vendor' },
    ];
    expect(
      getAssuranceSetRequestRecipients(users, { contractParties: emptyPartyList }, 'Client Co', 'U1', 'ask'),
    ).toEqual([]);
    expect(
      getAssuranceSetRequestRecipients(users, { contractParties: emptyPartyList }, 'Client Co', 'U1', 'invite'),
    ).toEqual([]);
    expect(getAssuranceSetRequestRecipients(users, {}, 'Client Co', 'U1')).toEqual([]);
  });
});

describe('getRequestDirection', () => {
  const adminUser = user('U10', 'Review Co Admin', 'Review Co', ['Administrator']);
  const submitterUser = user('U3', 'Head Submitter', 'Head Co', ['Submitter']);
  const dualUser = user('U5', 'Vendor User', 'Vendor Co', ['Administrator', 'Submitter']);

  it('explicit direction ask makes sender requestingParty and recipient respondingParty regardless of roles', () => {
    // Overrides role guess even when recipient is Administrator
    const dirAdmin = getRequestDirection('Client Co', adminUser, 'ask');
    expect(dirAdmin).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Review Co',
    });

    const dirSubmitter = getRequestDirection('Client Co', submitterUser, 'ask');
    expect(dirSubmitter).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Head Co',
    });

    const dirDual = getRequestDirection('Client Co', dualUser, 'ask');
    expect(dirDual).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Vendor Co',
    });
  });

  it('explicit direction invite makes recipient requestingParty and sender respondingParty regardless of roles', () => {
    // Overrides role guess even when recipient is Submitter
    const dirSubmitter = getRequestDirection('Client Co', submitterUser, 'invite');
    expect(dirSubmitter).toEqual({
      requestingParty: 'Head Co',
      respondingParty: 'Client Co',
    });

    const dirAdmin = getRequestDirection('Client Co', adminUser, 'invite');
    expect(dirAdmin).toEqual({
      requestingParty: 'Review Co',
      respondingParty: 'Client Co',
    });

    const dirDual = getRequestDirection('Client Co', dualUser, 'invite');
    expect(dirDual).toEqual({
      requestingParty: 'Vendor Co',
      respondingParty: 'Client Co',
    });
  });

  it('fallback when no direction is passed guesses from role (Administrator flips, Submitter does not)', () => {
    expect(getRequestDirection('Client Co', adminUser)).toEqual({
      requestingParty: 'Review Co',
      respondingParty: 'Client Co',
    });

    expect(getRequestDirection('Client Co', submitterUser)).toEqual({
      requestingParty: 'Client Co',
      respondingParty: 'Head Co',
    });

    expect(getRequestDirection('Client Co', dualUser)).toEqual({
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
