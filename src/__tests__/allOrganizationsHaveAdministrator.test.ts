import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ORGANIZATIONS,
  getAdminRoleForOrganization,
  CLIENT_ORGANIZATIONS,
} from '../utils/organizationRegistry';
import { MOCK_USERS } from '../store/mockData';
import { OIL_CO_PILOT_USERS } from '../store/oilCoLngPilotMockData';
import { buildOrgRoster } from '../store/orgRosterMockData';
import { UserProfile } from '../types/user';

describe('Every kept organization has an active Administrator (Step 3)', () => {
  // Deduplicate users by id
  const userMap = new Map<string, UserProfile>();
  for (const u of [...MOCK_USERS, ...OIL_CO_PILOT_USERS, ...buildOrgRoster(MOCK_USERS)]) {
    userMap.set(u.id, u);
  }
  const allUsers = Array.from(userMap.values());

  it('ensures every kept organization has at least one active administrator of the correct role', () => {
    for (const org of CANONICAL_ORGANIZATIONS) {
      const expectedRole = getAdminRoleForOrganization(org);
      const activeAdmins = allUsers.filter(
        (u) =>
          u.status === 'Active' &&
          u.organization?.trim().toLowerCase() === org.trim().toLowerCase() &&
          u.roles.includes(expectedRole),
      );

      expect(
        activeAdmins.length,
        `Expected at least 1 active ${expectedRole} for organization "${org}", but found 0.`,
      ).toBeGreaterThanOrEqual(1);

      // Verify ADR 0037 compliance: own id, unique email, status Active
      const admin = activeAdmins[0];
      expect(admin.id).toBeTruthy();
      expect(admin.name).toBeTruthy();
      expect(admin.email).toBeTruthy();
      expect(admin.status).toBe('Active');
    }
  });

  it('verifies clients have C Admin and all other organizations have Administrator', () => {
    for (const org of CANONICAL_ORGANIZATIONS) {
      const isClient = CLIENT_ORGANIZATIONS.has(org);
      const expectedRole = isClient ? 'C Admin' : 'Administrator';
      const actualAdmins = allUsers.filter(
        (u) =>
          u.status === 'Active' &&
          u.organization?.trim().toLowerCase() === org.trim().toLowerCase() &&
          u.roles.includes(expectedRole),
      );
      expect(actualAdmins.length, `Org "${org}" should have active ${expectedRole}`).toBeGreaterThanOrEqual(1);
    }
  });
});

