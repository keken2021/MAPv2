/*
  file summary: unit tests for organization role roster builder, admin roles, and store persona resolution.
  responsibilities: asserts one admin per organization of the correct role, role coverage by organization kind, unique IDs, and persona stability.
  role in system: verifies orgRosterMockData builder and useMapStore roster integration.
*/

import { describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_USERS, MOCK_PERSONA_SESSION_USER_IDS } from '../store/mockData';
import {
  ORGANIZATIONS,
  ROLES_BY_KIND,
  adminRoleFor,
  buildOrgRoster,
} from '../store/orgRosterMockData';
import { orgFieldMatches } from '../utils/rbacHelpers';
import { getEligibleVerifiers, getSessionUserForPersona, usersWithRole } from '../utils/userRoleHelpers';
import { UserRolePersona } from '../types/user';

describe('Organization Role Roster (Task 5483)', () => {
  it('checks every organization has exactly one admin of the right role and Northwind and S. Basin are not duplicated', () => {
    const storeUsers = useMapStore.getState().users;

    for (const org of ORGANIZATIONS) {
      const expectedAdminRole = adminRoleFor(org.kind);
      const admins = storeUsers.filter(
        (u) =>
          u.status === 'Active' &&
          Boolean(u.organization) &&
          orgFieldMatches(org.name, u.organization) &&
          u.roles.includes(expectedAdminRole),
      );

      expect(
        admins.length,
        `Expected exactly 1 active ${expectedAdminRole} for organization "${org.name}", but found ${admins.length}`,
      ).toBe(1);
    }

    // Explicit check: Northwind Administrator is K. Osei and S. Basin is Southern Basin C Admin, neither duplicated
    const northwindAdmins = storeUsers.filter(
      (u) =>
        u.status === 'Active' &&
        u.organization &&
        orgFieldMatches('Northwind Marine Pty Ltd', u.organization) &&
        u.roles.includes('Administrator'),
    );
    expect(northwindAdmins).toHaveLength(1);
    expect(northwindAdmins[0].name).toBe('K. Osei');
    expect(northwindAdmins[0].id).toBe('USR-101');

    const southernBasinAdmins = storeUsers.filter(
      (u) =>
        u.status === 'Active' &&
        u.organization &&
        orgFieldMatches('Southern Basin Energy Pty Ltd', u.organization) &&
        u.roles.includes('C Admin'),
    );
    expect(southernBasinAdmins).toHaveLength(1);
    expect(southernBasinAdmins[0].name).toBe('S. Basin');
    expect(southernBasinAdmins[0].id).toBe('USR-201');
  });

  it('checks each organization has a person for each role of its kind', () => {
    const storeUsers = useMapStore.getState().users;

    for (const org of ORGANIZATIONS) {
      const expectedAdminRole = adminRoleFor(org.kind);
      const rolesToCheck: UserRolePersona[] = [expectedAdminRole, ...ROLES_BY_KIND[org.kind]];

      for (const role of rolesToCheck) {
        const matchingUsers = storeUsers.filter(
          (u) =>
            u.status === 'Active' &&
            Boolean(u.organization) &&
            orgFieldMatches(org.name, u.organization) &&
            u.roles.includes(role),
        );

        expect(
          matchingUsers.length,
          `Expected at least 1 user with role "${role}" for organization "${org.name}", but found 0`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('checks that all user IDs in the combined roster are unique and follow conventions', () => {
    const storeUsers = useMapStore.getState().users;
    const ids = storeUsers.map((u) => u.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);

    // Generated IDs in buildOrgRoster follow USR-<ORG>-<ROLE>
    const generated = buildOrgRoster(MOCK_USERS);
    for (const user of generated) {
      expect(user.id).toMatch(/^USR-[A-Z]{3}-[A-Z]{3}$/);
      expect(user.status).toBe('Active');
      if (user.roles.includes('Administrator') || user.roles.includes('C Admin')) {
        expect(user.createdBy).toBeUndefined();
      } else {
        const org = ORGANIZATIONS.find((o) => orgFieldMatches(o.name, user.organization));
        expect(org).toBeDefined();
        const adminRole = adminRoleFor(org!.kind);
        expect(user.createdBy).toBe(adminRole);
        expect(user.invitedBy).toBe(adminRole);
      }
    }
  });

  it('checks the first 12 users equal MOCK_USERS and each persona resolves to the same user ID as before', () => {
    const storeUsers = useMapStore.getState().users;

    // First 12 users match MOCK_USERS slice exactly
    expect(storeUsers.slice(0, 12)).toEqual(MOCK_USERS.slice(0, 12));
    // Full MOCK_USERS prefix is preserved
    expect(storeUsers.slice(0, MOCK_USERS.length)).toEqual(MOCK_USERS);

    // Each Viewing as persona resolves to the exact same person ID as before
    const personas: UserRolePersona[] = [
      'Administrator',
      'C Admin',
      'Submitter',
      'Verifier',
      'Inspector',
      'Approver',
    ];

    for (const persona of personas) {
      const resolved = getSessionUserForPersona(persona, storeUsers);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(MOCK_PERSONA_SESSION_USER_IDS[persona]);
    }
  });

  it('confirms Create assurance set pickers list people from Woodside, DNV and other organizations', () => {
    const storeUsers = useMapStore.getState().users;

    // Verifiers picker uses getEligibleVerifiers(users)
    const eligibleVerifiers = getEligibleVerifiers(storeUsers);
    const verifierOrgs = eligibleVerifiers.map((u) => u.organization);
    expect(verifierOrgs.some((org) => orgFieldMatches('Woodside Energy Ltd', org))).toBe(true);
    expect(verifierOrgs.some((org) => orgFieldMatches('DNV', org))).toBe(true);
    expect(verifierOrgs.some((org) => orgFieldMatches('Chevron Australia Pty Ltd', org))).toBe(true);

    // Inspector picker uses usersWithRole(users, 'Inspector')
    const inspectors = usersWithRole(storeUsers, 'Inspector');
    const inspectorOrgs = inspectors.map((u) => u.organization);
    expect(inspectorOrgs.some((org) => orgFieldMatches('Woodside Energy Ltd', org))).toBe(true);
    expect(inspectorOrgs.some((org) => orgFieldMatches('DNV', org))).toBe(true);

    // Approver picker uses usersWithRole(users, 'Approver')
    const approvers = usersWithRole(storeUsers, 'Approver');
    const approverOrgs = approvers.map((u) => u.organization);
    expect(approverOrgs.some((org) => orgFieldMatches('Woodside Energy Ltd', org))).toBe(true);
    expect(approverOrgs.some((org) => orgFieldMatches('DNV', org))).toBe(true);
  });
});
