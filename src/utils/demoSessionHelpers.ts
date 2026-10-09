/*
  file summary: demo session helpers for organization and persona switching from MOCK_USERS.
  responsibilities: lists orgs/personas per org, picks session user, formats display labels.
  role in system: consumed by useMapStore and AppSidebar.
*/

import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { orgFieldMatches } from './rbacHelpers';
import { getOrganizationLogo } from './vesselImageHelpers';

export const DEFAULT_DEMO_ORGANIZATION = 'Northwind Marine Pty Ltd';

export const DEMO_PERSONA_ORDER: UserRolePersona[] = [
  'Administrator',
  'C Admin',
  'Submitter',
  'Verifier',
  'Inspector',
  'Approver',
];

export const DEMO_PERSONA_LABELS: Record<UserRolePersona, string> = {
  Administrator: 'Vessel Admin',
  'C Admin': 'Client Admin',
  Submitter: 'Submitter',
  Verifier: 'Verifier',
  Inspector: 'Vessel Inspector',
  Approver: 'Approver',
};

export function getPersonaOptionsForOrganization(
  users: UserProfile[],
  organization: string,
): { role: UserRolePersona; label: string }[] {
  return getPersonasForOrganization(users, organization).map((role) => ({
    role,
    label: DEMO_PERSONA_LABELS[role],
  }));
}

export function getOrganizationsFromUsers(users: UserProfile[]): string[] {
  const orgs = new Set<string>();
  users.forEach((user) => {
    if (user.status === 'Active' && user.organization?.trim()) {
      orgs.add(user.organization.trim());
    }
  });
  return [...orgs].sort((a, b) => a.localeCompare(b));
}

export interface OrganizationSwitcherOption {
  organization: string;
  initials: string;
  userCount: number;
  roleCount: number;
}

/* one entry per organization in the sidebar switcher, with the counts shown under its name */
export function getOrganizationSwitcherOptions(users: UserProfile[]): OrganizationSwitcherOption[] {
  return getOrganizationsFromUsers(users).map((organization) => ({
    organization,
    initials: getOrganizationLogo(organization).initials,
    userCount: getActiveUsersInOrganization(users, organization).length,
    roleCount: getPersonasForOrganization(users, organization).length,
  }));
}

/* narrows the switcher list to names containing the search text; blank text keeps every organization */
export function filterOrganizationSwitcherOptions(
  options: OrganizationSwitcherOption[],
  term: string,
): OrganizationSwitcherOption[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((option) => option.organization.toLowerCase().includes(normalized));
}

/* second line of a switcher entry, e.g. "7 users · 2 roles" */
export function formatOrganizationSwitcherMeta(
  option: Pick<OrganizationSwitcherOption, 'userCount' | 'roleCount'>,
): string {
  if (option.roleCount === 0) return 'No roles available';
  const users = `${option.userCount} ${option.userCount === 1 ? 'user' : 'users'}`;
  const roles = `${option.roleCount} ${option.roleCount === 1 ? 'role' : 'roles'}`;
  return `${users} · ${roles}`;
}

export function getActiveUsersInOrganization(
  users: UserProfile[],
  organization: string,
): UserProfile[] {
  return users.filter(
    (user) => user.status === 'Active' && orgFieldMatches(organization, user.organization),
  );
}

export function getPersonasForOrganization(
  users: UserProfile[],
  organization: string,
): UserRolePersona[] {
  const roleSet = new Set<UserRolePersona>();
  getActiveUsersInOrganization(users, organization).forEach((user) => {
    user.roles.forEach((role) => {
      if (DEMO_PERSONA_ORDER.includes(role as UserRolePersona)) {
        roleSet.add(role as UserRolePersona);
      }
    });
  });
  return DEMO_PERSONA_ORDER.filter((persona) => roleSet.has(persona));
}

export function pickSessionUserForOrgPersona(
  users: UserProfile[],
  organization: string,
  persona: UserRolePersona,
): UserProfile | undefined {
  return getActiveUsersInOrganization(users, organization)
    .filter((user) => user.roles.includes(persona))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function resolveDefaultPersonaForOrganization(
  users: UserProfile[],
  organization: string,
  preferred?: UserRolePersona,
): UserRolePersona | undefined {
  const personas = getPersonasForOrganization(users, organization);
  if (personas.length === 0) return undefined;
  if (preferred && personas.includes(preferred)) return preferred;
  return personas[0];
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
