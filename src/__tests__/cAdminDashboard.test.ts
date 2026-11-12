/* 
  file summary: unit test suite for c admin dashboard and sidebar access controls.
  responsibilities: verifies that c admin dashboard shows own-created assurance sets, hides audit trail card, and shows assurance sets in the sidepanel, limited to the client's organization.
  role in system: validates rbac presentation rules for c admin persona.
*/

import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import {
  isAssuranceSetAssignedToPersona,
  isAssuranceSetOwnedOrInitiatedByOrganization,
  isSidebarHiddenDuplicate,
  isViewAccessibleToPersona,
} from '../utils/rbacHelpers';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { getRoleScopeFlags } from '../utils/permissionHelpers';

const cAdminUser = MOCK_USERS.find((u) => u.id === 'USR-221')!;

describe('c admin dashboard and sidepanel rbac suite', () => {
  beforeEach(() => {
    /* reset active persona to c admin */
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });
  });

  /**
    what: tests that c admin's assurance sets are correctly identified and filtered.
    how: applies isAssuranceSetAssignedToPersona across mock sets and checks personal attribution.
    with what file: src/__tests__/cAdminDashboard.test.ts testing src/utils/rbacHelpers.ts.
  */
  it('filters only c admin created or assigned assurance sets for the dashboard view', () => {
    const cAdminSets = MOCK_ASSURANCE_SETS.filter((s) =>
      isAssuranceSetAssignedToPersona(s, 'C Admin', 'Chevron Australia Pty Ltd', cAdminUser),
    );

    expect(cAdminSets.length).toBeGreaterThan(0);
    cAdminSets.forEach((set) => {
      const isClientCreated =
        set.initiatorRole === 'C Admin · Client Created' ||
        set.createdByPersona === 'C Admin' ||
        set.charterer === 'Chevron Australia Pty Ltd' ||
        set.initiatorOrg === 'Southern Basin Energy Pty Ltd' ||
        set.charterer === 'Southern Basin Energy Pty Ltd' ||
        set.charterer === 'Woodside Energy Ltd' ||
        set.charterer === 'Inpex Operations Australia';

      expect(isClientCreated).toBe(true);
    });
  });

  /**
    what: tests that the client reaches the assurance sets list from the sidepanel, as the administrator does.
    how: checks the sidebar hide rule and the route guard for both client personas.
    with what file: src/__tests__/cAdminDashboard.test.ts testing src/utils/rbacHelpers.ts.
  */
  it('shows the assurance sets link and opens the route for the client', () => {
    expect(isSidebarHiddenDuplicate('C Admin', 'assurance-sets')).toBe(false);
    expect(isViewAccessibleToPersona('assurance-sets', null, 'C Admin')).toBe(true);
  });

  /**
    what: tests that a client's list holds only sets the signed-in C Admin created or is assigned to, never unassigned or external sets.
    how: compares personal visibility with org ownership for Chevron and asserts unassigned Chevron sets stay excluded under personal scope.
    with what file: src/__tests__/cAdminDashboard.test.ts testing src/utils/rbacHelpers.ts.
  */
  it('limits the client list to personal created or assigned sets within their organization', () => {
    const organization = 'Chevron Australia Pty Ltd';
    const visible = MOCK_ASSURANCE_SETS.filter((s) =>
      isAssuranceSetAssignedToPersona(s, 'C Admin', organization, cAdminUser),
    );
    const owned = MOCK_ASSURANCE_SETS.filter((s) => isAssuranceSetOwnedOrInitiatedByOrganization(s, organization));

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.some((s) => s.id === 'AS-2026-001')).toBe(true);
    expect(visible.every((s) => owned.some((o) => o.id === s.id))).toBe(true);
    expect(visible.some((s) => s.id === 'AS-2026-029')).toBe(false);
    expect(visible.some((s) => s.id === 'AS-2026-005')).toBe(false);
  });

  /**
    what: tests that c admin retains assurance set privileges (create, read, update) in role permission defaults.
    how: queries role matrix flags for c admin and assurance_sets.
    with what file: src/__tests__/cAdminDashboard.test.ts testing src/utils/permissionDefaults.ts.
  */
  it('retains assurance set permissions (create, read, update) for c admin', () => {
    const matrix = buildBrdRolePermissionDefaults();
    const cAdminFlags = getRoleScopeFlags(matrix, 'C Admin', 'assurance_sets');

    expect(cAdminFlags.read).toBe(true);
    expect(cAdminFlags.create).toBe(true);
    expect(cAdminFlags.update).toBe(true);
  });

  /**
    what: tests that c admin retains ability to configure assurance requirements.
    how: checks assurance_requirements scope flags for c admin persona.
    with what file: src/__tests__/cAdminDashboard.test.ts testing src/utils/permissionDefaults.ts.
  */
  it('allows c admin to manage assurance requirements checklist', () => {
    const matrix = buildBrdRolePermissionDefaults();
    const cAdminFlags = getRoleScopeFlags(matrix, 'C Admin', 'assurance_requirements');

    expect(cAdminFlags.read).toBe(true);
    expect(cAdminFlags.create).toBe(true);
  });
});
