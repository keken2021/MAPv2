import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '../store/mockData';
import {
  getOrganizationsFromUsers,
  getOrganizationSwitcherOptions,
  filterOrganizationSwitcherOptions,
  formatOrganizationSwitcherMeta,
  getActiveUsersInOrganization,
  getPersonasForOrganization,
  getPersonaOptionsForOrganization,
  pickSessionUserForOrgPersona,
  hasOtherMembership,
  resolveDefaultPersonaForOrganization,
} from '../utils/demoSessionHelpers';

describe('demoSessionHelpers', () => {
  it('lists active organizations from mock users (pending users excluded)', () => {
    expect(getOrganizationsFromUsers(MOCK_USERS)).toHaveLength(18);
  });

  it('builds one switcher option per organization, in the same order, with its initials and counts', () => {
    const options = getOrganizationSwitcherOptions(MOCK_USERS);
    expect(options.map((o) => o.organization)).toEqual(getOrganizationsFromUsers(MOCK_USERS));
    options.forEach((option) => {
      expect(option.initials, option.organization).toMatch(/^[A-Z0-9]{2}$/);
      expect(option.userCount, option.organization).toBe(
        getActiveUsersInOrganization(MOCK_USERS, option.organization).length,
      );
      expect(option.userCount, option.organization).toBeGreaterThan(0);
      expect(option.roleCount, option.organization).toBe(
        getPersonasForOrganization(MOCK_USERS, option.organization).length,
      );
    });

    const gulf = options.find((o) => o.organization === 'Gulf Security Services Pty Ltd');
    expect(gulf?.initials).toBe('GS');
    expect(gulf?.roleCount).toBe(2);
  });

  it('filters switcher options by name without regard to case', () => {
    const options = getOrganizationSwitcherOptions(MOCK_USERS);
    expect(filterOrganizationSwitcherOptions(options, '')).toEqual(options);
    expect(filterOrganizationSwitcherOptions(options, '   ')).toEqual(options);
    expect(filterOrganizationSwitcherOptions(options, 'CHEVRON').map((o) => o.organization)).toEqual([
      'Chevron Australia Pty Ltd',
    ]);
    const meridian = filterOrganizationSwitcherOptions(options, ' meridian ');
    expect(meridian.map((o) => o.organization)).toEqual([
      'Meridian Marine Services Pty Ltd',
      'Meridian Shipyards',
    ]);
    expect(filterOrganizationSwitcherOptions(options, 'no such organization')).toEqual([]);
  });

  it('describes a switcher option by its user and role counts', () => {
    expect(formatOrganizationSwitcherMeta({ userCount: 7, roleCount: 2 })).toBe('7 users · 2 roles');
    expect(formatOrganizationSwitcherMeta({ userCount: 1, roleCount: 1 })).toBe('1 user · 1 role');
    expect(formatOrganizationSwitcherMeta({ userCount: 3, roleCount: 0 })).toBe('No roles available');
  });

  it('offers only administrator and submitter for Gulf Security Services', () => {
    const org = 'Gulf Security Services Pty Ltd';
    expect(getPersonasForOrganization(MOCK_USERS, org)).toEqual(['Administrator', 'Submitter']);
    expect(getPersonaOptionsForOrganization(MOCK_USERS, org)).toEqual([
      { role: 'Administrator', label: 'Vessel Admin' },
      { role: 'Submitter', label: 'Submitter' },
    ]);
  });

  it('offers c admin, verifier, and approver for Chevron Australia', () => {
    const org = 'Chevron Australia Pty Ltd';
    expect(getPersonasForOrganization(MOCK_USERS, org)).toEqual([
      'C Admin',
      'Verifier',
      'Approver',
    ]);
  });

  it('picks D. Rahimi as Gulf Security submitter', () => {
    const user = pickSessionUserForOrgPersona(
      MOCK_USERS,
      'Gulf Security Services Pty Ltd',
      'Submitter',
    );
    /* USR-220 was also F. Abernathy's id; D. Rahimi has her own id now */
    expect(user?.id).toBe('USR-249');
    expect(user?.name).toBe('D. Rahimi');
  });

  it('keeps preferred persona when switching org if that role exists', () => {
    const org = 'Chevron Australia Pty Ltd';
    expect(resolveDefaultPersonaForOrganization(MOCK_USERS, org, 'Approver')).toBe('Approver');
  });

  it('falls back to first persona when preferred role is missing in org', () => {
    const org = 'Gulf Security Services Pty Ltd';
    expect(resolveDefaultPersonaForOrganization(MOCK_USERS, org, 'Verifier')).toBe(
      'Administrator',
    );
  });

  /* ADR 0037: no special case for S. Girard; M. Chen holds Verifier in Northwind himself */
  it('resolves Northwind Submitter and Verifier to M. Chen, a Northwind record', () => {
    const submitter = pickSessionUserForOrgPersona(MOCK_USERS, 'Northwind Marine Pty Ltd', 'Submitter');
    const verifier = pickSessionUserForOrgPersona(MOCK_USERS, 'Northwind Marine Pty Ltd', 'Verifier');
    expect(submitter?.id).toBe('USR-102');
    expect(verifier?.id).toBe('USR-102');
    expect(verifier?.organization).toBe('Northwind Marine Pty Ltd');
  });

  it('prefers the person in two organizations: S. Girard for Bureau Veritas Verifier and Northwind Inspector', () => {
    const bvVerifier = pickSessionUserForOrgPersona(MOCK_USERS, 'Bureau Veritas Inspectorate', 'Verifier');
    const nwInspector = pickSessionUserForOrgPersona(MOCK_USERS, 'Northwind Marine Pty Ltd', 'Inspector');
    expect(bvVerifier?.id).toBe('USR-244');
    expect(nwInspector?.id).toBe('USR-250');
    expect(nwInspector?.personId).toBe(bvVerifier?.personId);
    expect(getPersonasForOrganization(MOCK_USERS, 'Northwind Marine Pty Ltd')).toContain('Inspector');
  });

  it("keeps the same person when a personId is given and they have a record in the organization", () => {
    const user = pickSessionUserForOrgPersona(MOCK_USERS, 'Bureau Veritas Inspectorate', 'Verifier', 'PER-S-GIRARD');
    expect(user?.id).toBe('USR-244');
    const other = pickSessionUserForOrgPersona(MOCK_USERS, 'Gulf Security Services Pty Ltd', 'Submitter', 'PER-S-GIRARD');
    expect(other?.name).toBe('D. Rahimi');
  });

  it('reports a second membership only for a linked record in another organization', () => {
    const girard = MOCK_USERS.find((u) => u.id === 'USR-244')!;
    const chen = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    expect(hasOtherMembership(MOCK_USERS, girard)).toBe(true);
    expect(hasOtherMembership(MOCK_USERS, chen)).toBe(false);
  });
});
