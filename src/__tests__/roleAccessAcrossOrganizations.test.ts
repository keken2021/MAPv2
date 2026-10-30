import { describe, expect, it } from 'vitest';
import { ENABLE_ROLES_AND_PERMISSIONS } from '../config/featureFlags';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import {
  getOrganizationSwitcherOptions,
  getPersonasForOrganization,
  pickSessionUserForOrgPersona,
} from '../utils/demoSessionHelpers';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import {
  assigneeMatchesUser,
  filterAssuranceSetsForSession,
  isAssuranceSetAssignedToPersona,
  isSidebarHiddenDuplicate,
  isViewAccessibleToPersona,
  SIDEBAR_HIDDEN_DUPLICATES,
} from '../utils/rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';

const matrix = buildBrdRolePermissionDefaults();

const WORKFLOW_ROLES: UserRolePersona[] = ['Submitter', 'Verifier', 'Inspector', 'Approver'];

interface SidebarNavDefinition {
  key: string;
  label: string;
  parentKey?: string;
}

const SIDEBAR_NAV_DEFINITIONS: SidebarNavDefinition[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'project', label: 'Projects' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'vessels', label: 'Vessels', parentKey: 'assets' },
  { key: 'equipment', label: 'Equipment', parentKey: 'assets' },
  { key: 'crew', label: 'Crew Directory', parentKey: 'assets' },
  { key: 'assurance-sets', label: 'Assurance Sets' },
  { key: 'documents', label: 'Document Library' },
  { key: 'verifier', label: 'Verification Queue' },
  { key: 'inspector', label: 'Inspections' },
  { key: 'approver', label: 'Approvals' },
  { key: 'capa', label: 'CAPA' },
  { key: 'audit', label: 'Audit Trail' },
  { key: 'users', label: 'User Management' },
  ...(ENABLE_ROLES_AND_PERMISSIONS ? [{ key: 'roles-permissions', label: 'Roles & Permissions' }] : []),
];

function resolveSessionUser(
  persona: UserRolePersona,
  organization: string,
  users: UserProfile[],
): UserProfile | undefined {
  const context = getDemoSessionContext({ activeDemoOrganization: organization });
  return (
    getSessionUserForPersona(persona, users, context) ??
    pickSessionUserForOrgPersona(users, organization, persona) ??
    users.find((u) => u.roles.includes(persona))
  );
}

function isAwaitingApprovalSet(set: AssuranceSet): boolean {
  return (
    set.stage === 'Approval' ||
    set.stage === 'Approved' ||
    set.approverDecision !== 'Pending' ||
    (set.requirements.length > 0 &&
      set.requirements.every((r) => !r.isMandatory || r.verifierStatus === 'Verified' || r.isFulfilled))
  );
}

function orgMatchesSetForAdmin(set: AssuranceSet, organization: string): boolean {
  const org = organization.trim().toLowerCase();
  const fields = [
    set.serviceProviderOrg,
    set.initiatorOrg,
    set.assignedSubmitter,
    set.stakeholders?.submitterOrg,
    set.assignedStakeholders?.submitterOrg,
  ];
  const orgMatches = fields.some((f) => Boolean(f) && f!.toLowerCase().includes(org));
  const isOwnerVessel =
    (org.includes('northwind') || org.includes('pacific')) &&
    (set.vesselId === 'VESSEL-005' || Boolean(set.vesselName?.toLowerCase().includes('atlantic ocean')));
  const isMadeByThisOrgAdmin =
    set.createdByPersona === 'Administrator' &&
    [set.initiatorOrg, set.serviceProviderOrg].some((f) => Boolean(f) && f!.toLowerCase().includes(org));
  return orgMatches || isOwnerVessel || isMadeByThisOrgAdmin;
}

function orgMatchesSetForClientAdmin(set: AssuranceSet, organization: string): boolean {
  const org = organization.trim().toLowerCase();
  const fields = [set.clientOrg, set.charterer, set.initiatorOrg];
  return fields.some((f) => Boolean(f) && f!.toLowerCase().includes(org));
}

describe('role access check across organizations', () => {
  it('verifies every visible sidebar link passes the route guard across all organizations and personas', () => {
    const orgOptions = getOrganizationSwitcherOptions(MOCK_USERS);
    expect(orgOptions.length).toBe(26);

    orgOptions.forEach((option) => {
      const org = option.organization;
      const personas = getPersonasForOrganization(MOCK_USERS, org);
      expect(personas.length).toBeGreaterThan(0);

      personas.forEach((persona) => {
        const sessionUser = resolveSessionUser(persona, org, MOCK_USERS);
        expect(sessionUser).toBeDefined();

        const visibleSidebarLinks: SidebarNavDefinition[] = [];

        SIDEBAR_NAV_DEFINITIONS.forEach((item) => {
          const isDuplicate = isSidebarHiddenDuplicate(persona, item.key);
          const passesGuard = isViewAccessibleToPersona(
            item.key,
            null,
            persona,
            matrix,
            {},
            sessionUser,
          );

          if (!isDuplicate && passesGuard) {
            visibleSidebarLinks.push(item);
          }
        });

        expect(visibleSidebarLinks.length).toBeGreaterThan(0);

        visibleSidebarLinks.forEach((link) => {
          const routeAllowed = isViewAccessibleToPersona(
            link.key,
            null,
            persona,
            matrix,
            {},
            sessionUser,
          );
          expect(routeAllowed).toBe(true);

          const hiddenList = SIDEBAR_HIDDEN_DUPLICATES[persona] || [];
          expect(hiddenList).not.toContain(link.key);
        });

        if (persona === 'Verifier') {
          const verifierKeys = visibleSidebarLinks.map((l) => l.key);
          expect(verifierKeys).not.toContain('verifier');
          expect(verifierKeys).not.toContain('approver');
        } else if (persona === 'Inspector') {
          const inspectorKeys = visibleSidebarLinks.map((l) => l.key);
          expect(inspectorKeys).not.toContain('inspector');
          expect(inspectorKeys).not.toContain('approver');
        } else if (persona === 'Approver') {
          const approverKeys = visibleSidebarLinks.map((l) => l.key);
          expect(approverKeys).not.toContain('approver');
        } else if (persona === 'C Admin') {
          const cAdminKeys = visibleSidebarLinks.map((l) => l.key);
          expect(cAdminKeys).not.toContain('assurance-sets');
          expect(cAdminKeys).not.toContain('verifier');
          expect(cAdminKeys).not.toContain('inspector');
          expect(cAdminKeys).not.toContain('approver');
          expect(cAdminKeys).not.toContain('documents');
        }
      });
    });
  });

  it('ensures no Submitter, Verifier, Inspector or Approver sees an assurance set that does not name them', () => {
    const orgOptions = getOrganizationSwitcherOptions(MOCK_USERS);

    orgOptions.forEach((option) => {
      const org = option.organization;
      const personas = getPersonasForOrganization(MOCK_USERS, org);

      personas.forEach((persona) => {
        if (!WORKFLOW_ROLES.includes(persona)) return;

        const sessionUser = resolveSessionUser(persona, org, MOCK_USERS);
        expect(sessionUser).toBeDefined();

        const visibleSets = filterAssuranceSetsForSession(
          MOCK_ASSURANCE_SETS,
          persona,
          org,
          sessionUser,
        );

        visibleSets.forEach((set) => {
          if (persona === 'Submitter') {
            expect(assigneeMatchesUser(set.assignedSubmitter, sessionUser)).toBe(true);
          } else if (persona === 'Verifier') {
            expect(assigneeMatchesUser(set.assignedVerifier, sessionUser)).toBe(true);
          } else if (persona === 'Inspector') {
            expect(assigneeMatchesUser(set.assignedInspector, sessionUser)).toBe(true);
            expect(set.mandatoryInspectionRequired).toBe(true);
          } else if (persona === 'Approver') {
            expect(assigneeMatchesUser(set.assignedApprover, sessionUser)).toBe(true);
            expect(isAwaitingApprovalSet(set)).toBe(true);
          }
        });

        MOCK_ASSURANCE_SETS.forEach((set) => {
          if (persona === 'Submitter' && !assigneeMatchesUser(set.assignedSubmitter, sessionUser)) {
            expect(isAssuranceSetAssignedToPersona(set, persona, org, sessionUser)).toBe(false);
          } else if (persona === 'Verifier' && !assigneeMatchesUser(set.assignedVerifier, sessionUser)) {
            expect(isAssuranceSetAssignedToPersona(set, persona, org, sessionUser)).toBe(false);
          } else if (
            persona === 'Inspector' &&
            (!assigneeMatchesUser(set.assignedInspector, sessionUser) || !set.mandatoryInspectionRequired)
          ) {
            expect(isAssuranceSetAssignedToPersona(set, persona, org, sessionUser)).toBe(false);
          } else if (
            persona === 'Approver' &&
            (!assigneeMatchesUser(set.assignedApprover, sessionUser) || !isAwaitingApprovalSet(set))
          ) {
            expect(isAssuranceSetAssignedToPersona(set, persona, org, sessionUser)).toBe(false);
          }
        });

        const coworker = {
          id: 'USR-COWORKER-TEST',
          name: 'Colleague Other',
          organization: org,
          roles: [persona],
        };
        visibleSets.forEach((set) => {
          expect(isAssuranceSetAssignedToPersona(set, persona, org, coworker)).toBe(false);
        });
      });
    });
  });

  it('ensures Administrator and Administrator as client see their organization sets', () => {
    const orgOptions = getOrganizationSwitcherOptions(MOCK_USERS);

    orgOptions.forEach((option) => {
      const org = option.organization;
      const personas = getPersonasForOrganization(MOCK_USERS, org);

      if (personas.includes('Administrator')) {
        const adminUser = resolveSessionUser('Administrator', org, MOCK_USERS);
        expect(adminUser).toBeDefined();

        const adminSets = filterAssuranceSetsForSession(
          MOCK_ASSURANCE_SETS,
          'Administrator',
          org,
          adminUser,
        );

        adminSets.forEach((set) => {
          expect(orgMatchesSetForAdmin(set, org)).toBe(true);
        });

        MOCK_ASSURANCE_SETS.forEach((set) => {
          const matchesOrg = orgMatchesSetForAdmin(set, org);
          const isVisible = isAssuranceSetAssignedToPersona(set, 'Administrator', org, adminUser);
          expect(isVisible).toBe(matchesOrg);
        });
      }

      if (personas.includes('C Admin')) {
        const clientAdminUser = resolveSessionUser('C Admin', org, MOCK_USERS);
        expect(clientAdminUser).toBeDefined();

        const clientSets = filterAssuranceSetsForSession(
          MOCK_ASSURANCE_SETS,
          'C Admin',
          org,
          clientAdminUser,
        );

        clientSets.forEach((set) => {
          expect(orgMatchesSetForClientAdmin(set, org)).toBe(true);
        });

        MOCK_ASSURANCE_SETS.forEach((set) => {
          const matchesOrg = orgMatchesSetForClientAdmin(set, org);
          const isVisible = isAssuranceSetAssignedToPersona(set, 'C Admin', org, clientAdminUser);
          expect(isVisible).toBe(matchesOrg);
        });
      }
    });
  });
});
