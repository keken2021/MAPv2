import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '../store/mockData';
import {
  getOrganizationsFromUsers,
  getPersonasForOrganization,
  getPersonaOptionsForOrganization,
  pickSessionUserForOrgPersona,
  resolveDefaultPersonaForOrganization,
} from '../utils/demoSessionHelpers';

describe('demoSessionHelpers', () => {
  it('lists active organizations from mock users (pending users excluded)', () => {
    expect(getOrganizationsFromUsers(MOCK_USERS)).toHaveLength(18);
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
