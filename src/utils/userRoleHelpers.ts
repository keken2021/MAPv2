/* 
  file summary: user role entitlement helpers for multi-role assignments and segregation-of-duty checks.
  responsibilities: validates operational role combinations, filters users by role entitlement, and formats role labels.
  role in system: consumed by UserManagement modals, UserTable, and CreateAssuranceSetView.
*/

import { AssuranceObject, SetSubmitter } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { MasterDocument } from '../types/document';
import { RoleName } from '../types/permissions';
import { UserProfile } from '../types/user';
import { MOCK_PERSONA_SESSION_USER_IDS } from '../store/mockData';
import { pickSessionUserForOrgPersona } from './demoSessionHelpers';
export { pickSessionUserForOrgPersona };

export const OPERATIONAL_ROLE_OPTIONS: { role: UserRolePersona; label: string }[] = [
  { role: 'Submitter', label: 'Submitter' },
  { role: 'Verifier', label: 'Verifier' },
  { role: 'Inspector', label: 'Inspector' },
  { role: 'Approver', label: 'Approver' },
];

/* on-screen names for stored role values; stored values are never renamed */
export const ROLE_DISPLAY_LABELS: Record<string, string> = {
  Administrator: 'Administrator',
  'C Admin': 'Client Admin',
  'C Admin · Client Created': 'Client Admin',
  'Vessel Provider': 'Provider',
  'Vessel Provider Admin': 'Provider',
  'Service Provider Admin': 'Provider',
};

/**
  what: returns the on-screen name for a stored role value.
  how: looks the role up in ROLE_DISPLAY_LABELS and falls back to the role itself, so custom roles show their own name.
  with what file: src/utils/userRoleHelpers.ts used by HeaderBanner, AppSidebar, UserTable, audit trail views and exports.
*/
export function getRoleDisplayLabel(role: string): string {
  return ROLE_DISPLAY_LABELS[role] ?? role;
}

/** Roles that may be assigned when provisioning Organization or Third-Party stakeholders (BRD 4.3). */
export const STAKEHOLDER_OPERATIONAL_ROLES: UserRolePersona[] = [
  'Submitter',
  'Verifier',
  'Inspector',
  'Approver',
];

/**
  what: builds operational role checklist options including admin-created custom roles with optional exclusions.
  how: aggregates static operational roles and custom roles from store, filtering out any roles matching excludeRoles.
  with what file: src/utils/userRoleHelpers.ts consumed by UserRoleChecklist.tsx.
*/
export function getOperationalRoleOptions(
  customRoles: string[] = [],
  excludeRoles: RoleName[] = [],
): { role: RoleName; label: string; isCustom?: boolean }[] {
  const brd = OPERATIONAL_ROLE_OPTIONS.map(({ role, label }) => ({
    role: role as RoleName,
    label,
    isCustom: false,
  }));
  const custom = customRoles.map((role) => ({
    role: role as RoleName,
    label: `${role} `,
    isCustom: true,
  }));
  const combined = [...brd, ...custom];
  if (excludeRoles.length > 0) {
    return combined.filter((opt) => !excludeRoles.includes(opt.role));
  }
  return combined;
}

export function userHasRole(
  user: Pick<UserProfile, 'roles'>,
  role: RoleName,
): boolean {
  return user.roles.includes(role);
}

/**
  what: resolves the user the active persona is signed in as; inputs are the persona and the user registry.
  how: looks up the persona in MOCK_PERSONA_SESSION_USER_IDS, then falls back to the first active user holding the role.
  with what file: src/utils/userRoleHelpers.ts used by NotificationPanel.tsx, NotificationsView.tsx, RequestAssuranceSetModal.tsx, CreateAssuranceSetView.tsx and App.tsx.
*/
export interface DemoSessionContext {
  organization?: string;
  sessionUserId?: string;
}

export function getDemoSessionContext(state: {
  activeDemoOrganization: string;
  activeSessionUserId?: string;
}): DemoSessionContext {
  return {
    organization: state.activeDemoOrganization,
    sessionUserId: state.activeSessionUserId,
  };
}

export function getSessionUserForPersona(
  persona: UserRolePersona,
  users: UserProfile[],
  demoContext?: DemoSessionContext,
): UserProfile | undefined {
  if (demoContext?.sessionUserId) {
    const byId = users.find(
      (user) =>
        user.id === demoContext.sessionUserId &&
        user.status === 'Active' &&
        user.roles.includes(persona),
    );
    if (byId) return byId;
  }

  if (demoContext?.organization?.trim()) {
    const orgUser = pickSessionUserForOrgPersona(
      users,
      demoContext.organization.trim(),
      persona,
    );
    if (orgUser) return orgUser;
  }

  const mappedId = MOCK_PERSONA_SESSION_USER_IDS[persona];
  return (
    users.find((u) => u.id === mappedId && u.roles.includes(persona)) ||
    users.find((u) => u.status === 'Active' && u.roles.includes(persona))
  );
}

export function usersWithRole(users: UserProfile[], role: RoleName): UserProfile[] {
  return users.filter((u) => userHasRole(u, role));
}

/**
  what: returns the ordered list of eligible verifiers for assurance set creation with CAdmins first.
  how: extracts users with role 'C Admin' first, then appends remaining users with role 'Verifier'.
  with what file: src/utils/userRoleHelpers.ts consumed by CreateAssuranceSetView.tsx.
*/
export function getEligibleVerifiers(users: UserProfile[]): UserProfile[] {
  const cAdmins = users.filter((u) => userHasRole(u, 'C Admin'));
  const otherVerifiers = users.filter((u) => userHasRole(u, 'Verifier') && !userHasRole(u, 'C Admin'));
  return [...cAdmins, ...otherVerifiers];
}

/**
  what: returns the people who may submit for one service provider; inputs are the user registry and that organization.
  how: keeps active users of that organization who hold Submitter, C Admin, or Administrator. Submitters come first, then client admins, then administrators. A person already listed under an earlier role is not repeated.
  with what file: src/utils/userRoleHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function getServiceProviderSubmitterCandidates(
  users: UserProfile[],
  serviceProviderOrg: string,
): UserProfile[] {
  const provider = serviceProviderOrg.trim();
  if (!provider) return [];
  const eligible = users.filter(
    (user) =>
      user.status === 'Active' &&
      Boolean(user.organization) &&
      stakeholderOrgMatches(user.organization, provider) &&
      (userHasRole(user, 'Submitter') ||
        userHasRole(user, 'C Admin') ||
        userHasRole(user, 'Administrator')),
  );
  const submitters = eligible.filter((user) => userHasRole(user, 'Submitter'));
  const clientAdmins = eligible.filter(
    (user) => userHasRole(user, 'C Admin') && !userHasRole(user, 'Submitter'),
  );
  const administrators = eligible.filter(
    (user) =>
      userHasRole(user, 'Administrator') &&
      !userHasRole(user, 'Submitter') &&
      !userHasRole(user, 'C Admin'),
  );
  return [...submitters, ...clientAdmins, ...administrators];
}

/**
  what: classifies a user into a review channel (Internal Client, Appointed Third Party, or Issuing Authority).
  how: checks user role, organization, and department metadata.
  with what file: src/utils/userRoleHelpers.ts consumed by CreateAssuranceSetView.tsx.
*/
export function getReviewChannelForUser(
  user: UserProfile,
  clientOrg?: string,
): 'internal' | 'third_party' | 'issuing_authority' {
  const orgLower = (user.organization || '').toLowerCase();
  const deptLower = (user.departmentOrScope || '').toLowerCase();

  // Issuing authority / regulatory body (e.g. AMSA, Flag State, Classification Society statutory portal)
  if (
    orgLower.includes('authority') ||
    orgLower.includes('amsa') ||
    orgLower.includes('maritime safety') ||
    deptLower.includes('statutory authority') ||
    deptLower.includes('digital validation')
  ) {
    return 'issuing_authority';
  }

  // Internal client team if organization matches client org or has C Admin role
  if (
    user.roles.includes('C Admin') ||
    (clientOrg && orgLower.includes(clientOrg.toLowerCase()))
  ) {
    return 'internal';
  }

  // Appointed third party
  if (
    user.userType === 'Third-Party' ||
    orgLower.includes('surveyor') ||
    orgLower.includes('bureau') ||
    orgLower.includes('maritime audit') ||
    orgLower.includes('veritas')
  ) {
    return 'third_party';
  }

  /* staff of a different organization are outside this client's group, so they are never its internal reviewers */
  if (clientOrg && orgLower && !orgLower.includes(clientOrg.toLowerCase()) && !clientOrg.toLowerCase().includes(orgLower)) {
    return 'third_party';
  }

  return 'internal';
}

/**
  what: filters eligible verifiers enforcing that a service provider / asset owner cannot verify its own documents.
  how: returns client admins, independent third parties, and issuing authorities, strictly excluding the service provider/asset owner organization.
  with what file: src/utils/userRoleHelpers.ts consumed by CreateAssuranceSetView.tsx.
*/
export function findObjectSubmitter(
  object: Pick<AssuranceObject, 'id' | 'ownerOrganization'>,
  documents: Pick<MasterDocument, 'vesselId' | 'versions'>[],
  users: UserProfile[],
): UserProfile | undefined {
  const uploads = documents
    .filter((document) => document.vesselId === object.id)
    .flatMap((document) => document.versions)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  for (const upload of uploads) {
    const uploader = users.find(
      (user) =>
        user.name === upload.uploadedBy &&
        user.status === 'Active' &&
        userHasRole(user, 'Submitter') &&
        stakeholderOrgMatches(user.organization || '', object.ownerOrganization),
    );
    if (uploader) return uploader;
  }
  return undefined;
}

export function getOrganizationRoleCandidates(
  users: UserProfile[],
  organization: string | undefined,
  role: 'Verifier' | 'Inspector' | 'Approver',
): UserProfile[] {
  if (!organization) return [];
  return users.filter(
    (user) =>
      user.status === 'Active' &&
      stakeholderOrgMatches(user.organization || '', organization) &&
      (userHasRole(user, role) || (role !== 'Inspector' && userHasRole(user, 'C Admin'))),
  );
}

export function filterEligibleVerifiersForScope(
  users: UserProfile[],
  options?: {
    vesselOwnerOrg?: string;
    serviceProviderOrg?: string;
    isCharteringOtherServices?: boolean;
    isClientAdmin?: boolean;
  },
): UserProfile[] {
  const allEligible = getEligibleVerifiers(users);
  const providerOrg = options?.serviceProviderOrg || options?.vesselOwnerOrg;

  if (options?.isClientAdmin || options?.isCharteringOtherServices) {
    // Even if chartering other services, exclude the actual target service provider organization
    if (providerOrg) {
      const providerOrgLower = providerOrg.toLowerCase();
      const filtered = allEligible.filter((u) => !u.organization?.toLowerCase().includes(providerOrgLower));
      return filtered.length > 0 ? filtered : allEligible;
    }
    return allEligible;
  }

  if (providerOrg) {
    const providerOrgLower = providerOrg.toLowerCase();
    const filtered = allEligible.filter((u) => !u.organization?.toLowerCase().includes(providerOrgLower));
    return filtered.length > 0 ? filtered : allEligible;
  }
  return allEligible;
}

/**
  what: filters eligible approvers enforcing that a service provider / asset owner cannot approve its own documents.
  how: returns approvers and client admins, strictly excluding the service provider/asset owner organization.
  with what file: src/utils/userRoleHelpers.ts consumed by CreateAssuranceSetView.tsx.
*/
export function filterEligibleApproversForScope(
  users: UserProfile[],
  options?: {
    vesselOwnerOrg?: string;
    serviceProviderOrg?: string;
    isCharteringOtherServices?: boolean;
    isClientAdmin?: boolean;
  },
): UserProfile[] {
  const allApprovers = users.filter((u) => userHasRole(u, 'Approver') || userHasRole(u, 'C Admin'));
  const providerOrg = options?.serviceProviderOrg || options?.vesselOwnerOrg;

  if (options?.isClientAdmin || options?.isCharteringOtherServices) {
    if (providerOrg) {
      const providerOrgLower = providerOrg.toLowerCase();
      const filtered = allApprovers.filter((u) => !u.organization?.toLowerCase().includes(providerOrgLower));
      return filtered.length > 0 ? filtered : allApprovers;
    }
    return allApprovers;
  }

  if (providerOrg) {
    const providerOrgLower = providerOrg.toLowerCase();
    const filtered = allApprovers.filter((u) => !u.organization?.toLowerCase().includes(providerOrgLower));
    return filtered.length > 0 ? filtered : allApprovers;
  }
  return allApprovers;
}

/**
  what: filters candidate verifiers, approvers, or inspectors dynamically based on selected ReviewMode and governance rules.
  how:
    - Strictly excludes service provider organization under all modes.
    - If mode is 'internal': restricts to Client Group only.
    - If mode is 'third_party': restricts to external Assurance Group only.
    - If mode is 'issuing_authority': returns empty for verifier (automated API) and internal/third-party for approver.
    - If mode is 'mixed': allows both Client Group and Assurance Group.
  with what file: src/utils/userRoleHelpers.ts consumed by CreateAssuranceSetView.tsx.
*/
export function filterCandidatesByReviewMode(
  users: UserProfile[],
  reviewMode: 'internal' | 'third_party' | 'issuing_authority' | 'mixed',
  role: 'Verifier' | 'Approver' | 'Inspector',
  options?: {
    clientOrg?: string;
    serviceProviderOrg?: string;
    internalDeployment?: boolean;
  }
): UserProfile[] {
  const providerOrgLower = (options?.serviceProviderOrg || '').toLowerCase();
  const clientOrg = options?.clientOrg;
  const isInternal = options?.internalDeployment === true;

  return users.filter((u) => {
    // 1. Absolute Rule: Exclude the provider's personnel ONLY during third-party charters (not internal self-assurance)
    if (!isInternal && providerOrgLower && u.organization?.toLowerCase().includes(providerOrgLower)) {
      return false;
    }

    // 2. Role matching
    if (role === 'Verifier') {
      if (!userHasRole(u, 'Verifier') && !userHasRole(u, 'C Admin')) return false;
    } else if (role === 'Approver') {
      if (!userHasRole(u, 'Approver') && !userHasRole(u, 'C Admin')) return false;
    } else if (role === 'Inspector') {
      if (!userHasRole(u, 'Inspector')) return false;
    }

    // 3. Channel filtering according to ReviewMode
    const channel = getReviewChannelForUser(u, clientOrg);

    if (reviewMode === 'internal') {
      return isInternal || channel === 'internal';
    }

    if (reviewMode === 'third_party') {
      return channel === 'third_party';
    }

    if (reviewMode === 'issuing_authority') {
      // Verifier is handled by Authority API; Approver can be internal client or appointed third party
      if (role === 'Verifier') return false;
      return channel === 'internal' || channel === 'third_party' || isInternal;
    }

    if (reviewMode === 'mixed') {
      return channel === 'internal' || channel === 'third_party' || isInternal;
    }

    return true;
  });
}

export function formatUserRoles(roles: RoleName[]): string {
  return roles.map(getRoleDisplayLabel).join(', ');
}

export function splitRolesForForm(roles: RoleName[]): {
  isPlatformAdmin: boolean;
  operationalRoles: RoleName[];
} {
  return {
    isPlatformAdmin: roles.includes('Administrator'),
    operationalRoles: roles.filter((role) => role !== 'Administrator'),
  };
}

export function buildRolesFromForm(
  isPlatformAdmin: boolean,
  operationalRoles: RoleName[],
): RoleName[] {
  const roles = [...operationalRoles];
  if (isPlatformAdmin && !roles.includes('Administrator')) {
    roles.unshift('Administrator');
  }
  return roles;
}

export function getSegregationWarnings(roles: RoleName[]): string[] {
  const warnings: string[] = [];
  const has = (role: RoleName) => roles.includes(role);

  if (has('Verifier') && has('Approver')) {
    warnings.push(
      'Segregation of duties: Verifier and Approver should not be assigned to the same participant on one assurance set.',
    );
  }

  if (has('Submitter') && has('Verifier')) {
    warnings.push(
      'Segregation of duties: Submitter and Verifier require controls so the user cannot verify their own uploads on the same assurance set.',
    );
  }

  if (has('C Admin') && has('Verifier') && !has('Administrator')) {
    warnings.push(
      'C Admin may only hold Verifier access when explicitly designated under the assurance agreement.',
    );
  }

  return warnings;
}

export function userMatchesAnyRole(
  user: Pick<UserProfile, 'roles'>,
  roles: RoleName[],
): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function getAssuranceAssignmentWarnings(assignments: {
  submitterId?: string;
  verifierId?: string;
  approverId?: string;
  subtypeStakeholders?: Partial<Record<string, { submitterId?: string; verifierId?: string }>>;
  vesselOwnerOrg?: string;
  serviceProviderOrg?: string;
  isCharteringOtherServices?: boolean;
  isClientAdmin?: boolean;
  internalDeployment?: boolean;
  users?: UserProfile[];
}): string[] {
  const warnings: string[] = [];
  const { submitterId, verifierId, approverId, subtypeStakeholders, vesselOwnerOrg, serviceProviderOrg, isCharteringOtherServices, isClientAdmin, internalDeployment, users } = assignments;
  const providerOrg = serviceProviderOrg || vesselOwnerOrg;

  if (submitterId && verifierId && submitterId === verifierId) {
    warnings.push(
      'Segregation of duties: The same user cannot be assigned as both Submitter and Verifier on one assurance set.',
    );
  }

  if (submitterId && approverId && submitterId === approverId) {
    warnings.push(
      'Segregation of duties: The document submitter cannot be the formal approver on this assurance set.',
    );
  }

  if (subtypeStakeholders) {
    Object.entries(subtypeStakeholders).forEach(([subtype, mapping]) => {
      if (mapping?.submitterId && mapping?.verifierId && mapping.submitterId === mapping.verifierId) {
        warnings.push(
          `Segregation of duties (${subtype}): Submitter and Verifier cannot be the same person for the ${subtype} section.`,
        );
      }
    });
  }

  if (providerOrg && !isCharteringOtherServices && !isClientAdmin && !internalDeployment && users) {
    const ownerOrgLower = providerOrg.toLowerCase();
    const verifierUser = users.find((u) => u.id === verifierId);
    const approverUser = users.find((u) => u.id === approverId);

    if (verifierUser && verifierUser.organization?.toLowerCase().includes(ownerOrgLower)) {
      warnings.push(
        'Segregation of duties: Vessel admin/owner cannot be assigned as Verifier for their own vessel unless chartering other services.',
      );
    }
    if (approverUser && approverUser.organization?.toLowerCase().includes(ownerOrgLower)) {
      warnings.push(
        'Segregation of duties: Vessel admin/owner cannot be assigned as Approver for their own vessel unless chartering other services.',
      );
    }
  }

  return warnings;
}

function stakeholderOrgMatches(orgA: string, orgB: string): boolean {
  const a = orgA.trim().toLowerCase();
  const b = orgB.trim().toLowerCase();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/** Parse organization from display label "Name (Organization)" */
export function parseAssigneeOrganization(assigneeName: string): string | undefined {
  const match = assigneeName.match(/\(([^)]+)\)\s*$/);
  return match?.[1]?.trim();
}

export function findUserByAssigneeLabel(
  users: UserProfile[],
  assigneeName: string,
): UserProfile | undefined {
  const org = parseAssigneeOrganization(assigneeName);
  const namePart = assigneeName.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
  return users.find(
    (u) =>
      u.name.toLowerCase() === namePart ||
      assigneeName.includes(u.name) ||
      (org && u.organization && stakeholderOrgMatches(u.organization, org) && assigneeName.includes(u.name.split(' ')[0])),
  );
}

export const PENDING_ASSIGNMENT = 'Pending Assignment';

export type StakeholderRole = 'Submitter' | 'Verifier' | 'Inspector' | 'Approver';

export interface StakeholderOrganizationFields {
  serviceProviderOrg?: string;
  clientOrg?: string;
  charterer?: string;
  assignedSubmitter?: string;
  assignedVerifier?: string;
  assignedInspector?: string;
  assignedApprover?: string;
  stakeholders?: {
    submitterOrg?: string;
    verifierOrg?: string;
    inspectorOrg?: string;
    approverOrg?: string;
  } | null;
  submitters?: SetSubmitter[];
}

export function getStakeholderRoleOrganization(
  set: StakeholderOrganizationFields,
  role: StakeholderRole,
): string | undefined {
  if (role === 'Submitter') {
    return (
      set.stakeholders?.submitterOrg ||
      set.serviceProviderOrg ||
      parseAssigneeOrganization(set.assignedSubmitter || '')
    );
  }
  if (role === 'Verifier') {
    return (
      set.stakeholders?.verifierOrg ||
      parseAssigneeOrganization(set.assignedVerifier || '')
    );
  }
  if (role === 'Inspector') {
    return (
      set.stakeholders?.inspectorOrg ||
      parseAssigneeOrganization(set.assignedInspector || '')
    );
  }
  if (role === 'Approver') {
    return (
      set.stakeholders?.approverOrg ||
      parseAssigneeOrganization(set.assignedApprover || '') ||
      set.clientOrg ||
      set.charterer
    );
  }
  return undefined;
}

export function setSubmitters(set: StakeholderOrganizationFields): SetSubmitter[] {
  if (set.submitters?.length) return set.submitters;
  const organization = getStakeholderRoleOrganization(set, 'Submitter');
  if (!organization && !set.assignedSubmitter) return [];
  return [{ organization: organization || '', assignee: set.assignedSubmitter || PENDING_ASSIGNMENT }];
}

export function canAssignStakeholderRole(
  set: StakeholderOrganizationFields,
  role: StakeholderRole,
  adminOrganization: string | undefined,
  submitterOrganization?: string,
): boolean {
  const roleOrganization =
    (role === 'Submitter' && submitterOrganization) || getStakeholderRoleOrganization(set, role);
  if (!roleOrganization || !adminOrganization) return true;
  return stakeholderOrgMatches(roleOrganization, adminOrganization);
}

export type StakeholderAssignmentValidation =
  | { ok: true }
  | { ok: false; message: string };

/**
  Validates stakeholder changes on an existing assurance set (Assurance Detail, store updates).
*/
export function validateStakeholderAssignmentForSet(
  assuranceSet: StakeholderOrganizationFields & {
    internalDeployment?: boolean;
    clientOrg?: string;
    assuranceObjects?: Pick<AssuranceObject, 'ownerOrganization'>[];
    reviewMode?: 'internal' | 'third_party' | 'issuing_authority' | 'mixed';
  },
  role: 'Submitter' | 'Verifier' | 'Inspector' | 'Approver',
  assigneeName: string,
  users: UserProfile[],
  submitterOrganization?: string,
): StakeholderAssignmentValidation {
  if (!assigneeName.trim()) {
    return { ok: false, message: 'Please select an assignee.' };
  }

  const providerOrg = assuranceSet.serviceProviderOrg;
  const assigneeOrg = parseAssigneeOrganization(assigneeName);
  const assigneeUser = findUserByAssigneeLabel(users, assigneeName);

  /* a role is filled from the organization named for it, so an admin cannot name someone else's staff */
  const roleOrganization =
    (role === 'Submitter' && submitterOrganization) || getStakeholderRoleOrganization(assuranceSet, role);
  if (roleOrganization && assigneeOrg && !stakeholderOrgMatches(roleOrganization, assigneeOrg)) {
    return { ok: false, message: assigneeName + ' is not in ' + roleOrganization + '.' };
  }

  if (
    (role === 'Verifier' || role === 'Approver') &&
    providerOrg &&
    !assuranceSet.internalDeployment
  ) {
    if (assigneeOrg && stakeholderOrgMatches(providerOrg, assigneeOrg)) {
      return {
        ok: false,
        message: 'Service provider conflict: staff from ' + assigneeOrg + ' cannot ' + role.toLowerCase() + ' their own documents.',
      };
    }
    if (assigneeUser?.organization && stakeholderOrgMatches(providerOrg, assigneeUser.organization)) {
      return {
        ok: false,
        message: 'Service provider conflict: ' + assigneeUser.name + ' cannot ' + role.toLowerCase() + ' their own organization\'s documents.',
      };
    }
  }

  /* an organization that owns an object in the set cannot review it; the client\'s own objects are internal assurance */
  if ((role === 'Verifier' || role === 'Approver') && !assuranceSet.internalDeployment) {
    const organization = assigneeOrg || assigneeUser?.organization;
    const isClient = Boolean(
      organization && assuranceSet.clientOrg && stakeholderOrgMatches(assuranceSet.clientOrg, organization),
    );
    const ownsObject = Boolean(organization) && (assuranceSet.assuranceObjects ?? []).some(
      (object) => Boolean(object.ownerOrganization && organization && stakeholderOrgMatches(object.ownerOrganization, organization)),
    );
    if (ownsObject && !isClient) {
      return {
        ok: false,
        message: 'Object owner conflict: ' + organization + ' cannot ' + role.toLowerCase() + ' a set that covers its own objects.',
      };
    }
  }

  if (role === 'Verifier' || role === 'Approver') {
    const submitterOrg = assuranceSet.assignedSubmitter
      ? parseAssigneeOrganization(assuranceSet.assignedSubmitter)
      : undefined;
    const submitterLabels = setSubmitters(assuranceSet).map((submitter) => submitter.assignee);
    if (
      role === 'Verifier' &&
      submitterLabels.includes(assigneeName)
    ) {
      return { ok: false, message: 'Submitter and Verifier cannot be the same person on one assurance set.' };
    }
    if (
      role === 'Approver' &&
      submitterLabels.includes(assigneeName)
    ) {
      return { ok: false, message: 'Submitter and Approver cannot be the same person on one assurance set.' };
    }
    if (assigneeUser && assuranceSet.assignedSubmitter) {
      const submitterUser = findUserByAssigneeLabel(users, assuranceSet.assignedSubmitter);
      if (submitterUser && assigneeUser.id === submitterUser.id && (role === 'Verifier' || role === 'Approver')) {
        return {
          ok: false,
          message: 'Segregation of duties: the same user cannot be both Submitter and ' + role + '.',
        };
      }
    }
    void submitterOrg;
  }

  return { ok: true };
}

export function hasBlockingAssuranceAssignmentConflict(assignments: {
  submitterId?: string;
  verifierId?: string;
  approverId?: string;
  subtypeStakeholders?: Partial<Record<string, { submitterId?: string; verifierId?: string }>>;
  vesselOwnerOrg?: string;
  serviceProviderOrg?: string;
  isCharteringOtherServices?: boolean;
  isClientAdmin?: boolean;
  internalDeployment?: boolean;
  users?: UserProfile[];
}): boolean {
  if (
    assignments.submitterId &&
    assignments.verifierId &&
    assignments.submitterId === assignments.verifierId
  ) {
    return true;
  }

  if (
    assignments.submitterId &&
    assignments.approverId &&
    assignments.submitterId === assignments.approverId
  ) {
    return true;
  }

  if (assignments.subtypeStakeholders) {
    for (const mapping of Object.values(assignments.subtypeStakeholders)) {
      if (mapping?.submitterId && mapping?.verifierId && mapping.submitterId === mapping.verifierId) {
        return true;
      }
    }
  }

  const providerOrg = assignments.serviceProviderOrg || assignments.vesselOwnerOrg;
  if (providerOrg && !assignments.internalDeployment && assignments.users) {
    const verifierUser = assignments.users.find((u) => u.id === assignments.verifierId);
    const approverUser = assignments.users.find((u) => u.id === assignments.approverId);
    if (
      verifierUser?.organization &&
      stakeholderOrgMatches(providerOrg, verifierUser.organization)
    ) {
      return true;
    }
    if (
      approverUser?.organization &&
      stakeholderOrgMatches(providerOrg, approverUser.organization)
    ) {
      return true;
    }
  }

  return false;
}

/**
  what: checks if the current user persona or identity matches the document submitter or vessel owner.
  how: compares user id, name, organization, or persona against assigned submitter, uploader, or vessel owner.
  with what file: src/utils/userRoleHelpers.ts consumed by DocumentReviewDrawer.tsx and VerifierWorkspaceView.tsx.
*/
export function isUserDocumentSubmitter(
  user: { id?: string; name?: string; organization?: string } | null | undefined,
  activePersona: UserRolePersona,
  document?: { uploadedBy?: string; vesselOwner?: string; vesselId?: string } | null,
  requirement?: { assignedSubmitter?: string; submitterId?: string } | null,
  assuranceSet?: { assignedSubmitter?: string; initiatorOrg?: string; initiatorRole?: string } | null,
): boolean {
  if (activePersona === 'Submitter') {
    return true;
  }

  if (!user && !document && !requirement && !assuranceSet) return false;

  const userName = user?.name?.toLowerCase() || '';
  const userOrg = user?.organization?.toLowerCase() || '';
  const userId = user?.id?.toLowerCase() || '';

  // 1. Direct requirement-level submitter assignment
  if (requirement?.submitterId && user?.id && requirement.submitterId === user.id) {
    return true;
  }
  if (requirement?.assignedSubmitter) {
    const reqSubLower = requirement.assignedSubmitter.toLowerCase();
    if (userName && reqSubLower.includes(userName)) return true;
    if (userOrg && reqSubLower.includes(userOrg)) return true;
  }

  // 2. Set-level assigned submitter
  if (assuranceSet?.assignedSubmitter) {
    const setSubLower = assuranceSet.assignedSubmitter.toLowerCase();
    if (userName && setSubLower.includes(userName)) return true;
    if (userOrg && setSubLower.includes(userOrg)) return true;
  }

  // 3. Document uploader identity
  if (document?.uploadedBy) {
    const uploaderLower = document.uploadedBy.toLowerCase();
    if (userName && uploaderLower.includes(userName)) return true;
    if (userId && uploaderLower.includes(userId)) return true;
    if (userOrg && uploaderLower.includes(userOrg)) return true;
  }

  return false;
}
