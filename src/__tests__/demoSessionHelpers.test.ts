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

    const pacific = options.find((o) => o.organization === 'Pacific Ocean Logistics Pty Ltd');
    expect(pacific?.initials).toBe('PO');
    expect(pacific?.roleCount).toBe(2);
  });

  it('filters switcher options by name without regard to case', () => {
    const options = getOrganizationSwitcherOptions(MOCK_USERS);
    expect(filterOrganizationSwitcherOptions(options, '')).toEqual(options);
    expect(filterOrganizationSwitcherOptions(options, '   ')).toEqual(options);
    expect(filterOrganizationSwitcherOptions(options, 'CHEVRON').map((o) => o.organization)).toEqual([
      'Chevron Australia Pty Ltd',
    ]);
    const meridian = filterOrganizationSwitcherOptions(options, ' meridian ');
    expect(meridian.length).toBeGreaterThan(1);
    expect(meridian.every((o) => o.organization.includes('Meridian'))).toBe(true);
    expect(filterOrganizationSwitcherOptions(options, 'no such organization')).toEqual([]);
  });

  it('describes a switcher option by its user and role counts', () => {
    expect(formatOrganizationSwitcherMeta({ userCount: 7, roleCount: 2 })).toBe('7 users · 2 roles');
    expect(formatOrganizationSwitcherMeta({ userCount: 1, roleCount: 1 })).toBe('1 user · 1 role');
    expect(formatOrganizationSwitcherMeta({ userCount: 3, roleCount: 0 })).toBe('No roles available');
  });

  it('offers only administrator and submitter for Pacific Ocean Logistics', () => {
    const org = 'Pacific Ocean Logistics Pty Ltd';
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

  it('picks M. Thorne as Pacific Ocean submitter', () => {
    const user = pickSessionUserForOrgPersona(
      MOCK_USERS,
      'Pacific Ocean Logistics Pty Ltd',
      'Submitter',
    );
    expect(user?.id).toBe('USR-110');
    expect(user?.name).toBe('M. Thorne');
  });

  it('keeps preferred persona when switching org if that role exists', () => {
    const org = 'Chevron Australia Pty Ltd';
    expect(resolveDefaultPersonaForOrganization(MOCK_USERS, org, 'Approver')).toBe('Approver');
  });

  it('falls back to first persona when preferred role is missing in org', () => {
    const org = 'Pacific Ocean Logistics Pty Ltd';
    expect(resolveDefaultPersonaForOrganization(MOCK_USERS, org, 'Verifier')).toBe(
      'Administrator',
    );
  });
});
