import { describe, expect, it } from 'vitest';
import {
  assigneeMatchesUser,
  findAssuranceSetCreatorUser,
  isAssuranceSetAssignedToPersona,
  sameOrganization,
} from '../utils/rbacHelpers';
import { findUserByAssigneeLabel } from '../utils/userRoleHelpers';
import { isOwnUpload } from '../utils/uploadOwnership';
import { MOCK_USERS } from '../store/mockData';
import type { AssuranceSet } from '../types/assurance';
import type { UserProfile } from '../types/user';

const BV = 'Bureau Veritas Inspectorate';
const NW = 'Northwind Marine Pty Ltd';
const girardBv = MOCK_USERS.find((u) => u.id === 'USR-244')!;
const girardNw = MOCK_USERS.find((u) => u.id === 'USR-250')!;

describe('sameOrganization', () => {
  it('matches the same name ignoring case and spaces only', () => {
    expect(sameOrganization(' Northwind Marine Pty Ltd ', 'northwind marine pty ltd')).toBe(true);
    expect(sameOrganization('Northwind Marine', NW)).toBe(false);
    expect(sameOrganization('', '')).toBe(false);
    expect(sameOrganization(undefined, NW)).toBe(false);
  });
});

describe('seed memberships', () => {
  it('gives every user record its own id', () => {
    const ids = MOCK_USERS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links S. Girard as Verifier in Bureau Veritas and Inspector in Northwind', () => {
    expect(girardBv).toMatchObject({ organization: BV, roles: ['Verifier'] });
    expect(girardNw).toMatchObject({ organization: NW, roles: ['Inspector'] });
    expect(girardNw.personId).toBe(girardBv.personId);
    expect(girardNw.email).toBe(girardBv.email);
  });
});

describe('assigneeMatchesUser (ADR 0037)', () => {
  it('matches a label only for the membership in the organization it names', () => {
    expect(assigneeMatchesUser(`S. Girard (${BV})`, girardBv)).toBe(true);
    expect(assigneeMatchesUser(`S. Girard (${BV})`, girardNw)).toBe(false);
    expect(assigneeMatchesUser(`S. Girard (${NW})`, girardNw)).toBe(true);
  });

  it('uses the organization field when the label has none', () => {
    expect(assigneeMatchesUser('S. Girard', girardNw, NW)).toBe(true);
    expect(assigneeMatchesUser('S. Girard', girardNw, BV)).toBe(false);
  });

  it('matches a bare name only for a person with one membership', () => {
    const chen = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    expect(assigneeMatchesUser('M. Chen', chen)).toBe(true);
    expect(assigneeMatchesUser('S. Girard', girardBv)).toBe(false);
  });

  it('always matches by id and never matches a placeholder', () => {
    expect(assigneeMatchesUser('USR-250', girardNw)).toBe(true);
    expect(assigneeMatchesUser('Pending Assignment', girardNw)).toBe(false);
  });
});

describe('findUserByAssigneeLabel', () => {
  it('finds the record of the named organization only', () => {
    expect(findUserByAssigneeLabel(MOCK_USERS, `S. Girard (${NW})`)?.id).toBe('USR-250');
    expect(findUserByAssigneeLabel(MOCK_USERS, `S. Girard (${BV})`)?.id).toBe('USR-244');
    expect(findUserByAssigneeLabel(MOCK_USERS, 'S. Girard (Somewhere Else)')).toBeUndefined();
  });

  it('does not guess between memberships for a bare name', () => {
    expect(findUserByAssigneeLabel(MOCK_USERS, 'S. Girard')).toBeUndefined();
    expect(findUserByAssigneeLabel(MOCK_USERS, 'M. Chen')?.id).toBe('USR-102');
  });
});

const baseSet = (overrides: Partial<AssuranceSet>): AssuranceSet =>
  ({ id: 'AS-T', title: 'T', stage: 'Verification', requirements: [], approverDecision: 'Pending', ...overrides }) as AssuranceSet;

describe('set roles follow the organization the set names', () => {
  it('reads SetSubmitter.organization', () => {
    const user = { id: 'X1', name: 'J. Doe', organization: 'Vendor Co', roles: ['Submitter'], personId: 'P1' } as UserProfile;
    const set = baseSet({ submitters: [{ organization: 'Other Co', assignee: 'J. Doe' }] });
    expect(isAssuranceSetAssignedToPersona(set, 'Submitter', 'Vendor Co', user, [user])).toBe(false);
    const own = baseSet({ submitters: [{ organization: 'Vendor Co', assignee: 'J. Doe' }] });
    expect(isAssuranceSetAssignedToPersona(own, 'Submitter', 'Vendor Co', user, [user])).toBe(true);
  });

  it('reads a stakeholder mapping organization', () => {
    const set = baseSet({ stakeholders: { verifierName: 'S. Girard', verifierOrg: BV } });
    expect(isAssuranceSetAssignedToPersona(set, 'Verifier', BV, girardBv, MOCK_USERS)).toBe(true);
    expect(isAssuranceSetAssignedToPersona(set, 'Inspector', NW, girardNw, MOCK_USERS)).toBe(false);
  });
});

describe('findAssuranceSetCreatorUser', () => {
  it('finds the creator by id, else by name and organization', () => {
    const creatorOf = (fields: Partial<AssuranceSet>) => findAssuranceSetCreatorUser(fields as AssuranceSet, MOCK_USERS);
    expect(creatorOf({ createdByUserId: 'USR-250' })?.id).toBe('USR-250');
    expect(creatorOf({ createdByName: 'S. Girard', initiatorOrg: NW })?.id).toBe('USR-250');
    expect(creatorOf({ createdByName: 'S. Girard', initiatorOrg: BV })?.id).toBe('USR-244');
    expect(creatorOf({ createdByName: 'S. Girard' })).toBeUndefined();
  });
});

describe('isOwnUpload', () => {
  it('compares the stored user id when there is one', () => {
    expect(isOwnUpload({ uploadedBy: 'S. Girard', uploadedByUserId: 'USR-244' }, girardBv)).toBe(true);
    expect(isOwnUpload({ uploadedBy: 'S. Girard', uploadedByUserId: 'USR-244' }, girardNw)).toBe(false);
  });

  it('accepts an older name-only upload only for a person with one membership', () => {
    const chen = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    expect(isOwnUpload({ uploadedBy: 'M. Chen' }, chen)).toBe(true);
    expect(isOwnUpload({ uploadedBy: 'S. Girard' }, girardNw)).toBe(false);
    expect(isOwnUpload({ uploadedBy: 'USR-250' }, girardNw)).toBe(true);
  });
});
