/*
  file summary: project composition helpers — rollup sync, readiness, and asset AS filtering.
  responsibilities: filters projects by persona, resolves eligible sets per asset.
  role in system: consumed by useMapStore and project views.
*/

import { AssuranceObject, AssuranceProject, AssuranceRequirement, AssuranceSet, AssuranceSubtype, ThreePillarsCategory } from '../types/assurance';
import { getAssuranceObjectScope, getAssuranceSetCrewIds, getThreePillarsCategory } from './assuranceTemplates';
import { UserRolePersona } from '../types/audit';
import { CrewMember } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';
import { OrganizationParty } from '../types/assurance';
import {
  ContractChainRole,
  ContractParty,
  Project,
  ProjectAssetLink,
  ProjectType,
  WORK_LOCATION_OPTIONS,
} from '../types/project';
import { UserProfile } from '../types/user';
import { VesselInformation } from '../types/vessel';
import type { AppNotification } from '../types/notification';
import { calculateAssuranceSetReadiness, derivePipelineStage } from './readinessHelpers';
import { isClosedAssuranceSet } from './documentVersionSnapshot';
import { getSessionUserForPersona, parseAssigneeOrganization } from './userRoleHelpers';
import {
  filterVesselsForPersona,
  getClientAdminOrganization,
  isAssuranceSetAssignedToPersona,
  orgFieldMatches,
} from './rbacHelpers';

export { WORK_LOCATION_OPTIONS };

export type ComposableProjectAsset = {
  assetType: ProjectAssetLink['assetType'];
  assetId: string;
  assetName: string;
  providerOrganization: string;
  isOwnOrganization: boolean;
};

export function projectTypeRequiresRiskProfile(type: ProjectType): boolean {
  return type === 'Charter / Voyage' || type === 'Mixed / Composite' || type === 'Assurance Campaign';
}

export function projectTypeRequiresRoute(type: ProjectType): boolean {
  return type === 'Charter / Voyage';
}

export function projectTypeShowsServiceFields(type: ProjectType): boolean {
  return (
    type === 'Service Engagement' ||
    type === 'Crew Provision' ||
    type === 'Equipment Rental' ||
    type === 'Mixed / Composite'
  );
}

export function requiresAssuranceSetForAssetLink(
  requestingOrganization: string,
  providerOrganization: string,
): boolean {
  const normalize = (org: string) => org.trim().toLowerCase();
  return normalize(requestingOrganization) !== normalize(providerOrganization);
}

export function getProjectEffectiveCharterer(project: Project): string {
  return project.charterer?.trim() || project.requestingOrganization;
}

/**
  what: client organization of a project; input is the project.
  how: uses ownerOrganization when recorded, otherwise the effective charterer.
  with what file: src/utils/projectHelpers.ts used by useMapStore.ts, notificationHelpers.ts and NotificationsView.tsx.
*/
export function getProjectClientOrganization(project: Project): string {
  return project.ownerOrganization?.trim() || getProjectEffectiveCharterer(project);
}

export const CONTRACT_CHAIN_LABELS: Record<ContractChainRole, string> = {
  client: 'Client',
  head_contractor: 'Head contractor',
  vendor: 'Vendor',
};

export const sameOrganization = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/* owner names used when an object records none; they are not organizations */
const PLACEHOLDER_OWNERS = ['Vessel Provider', 'Crew Provider', 'Equipment Provider'];

const addOrganization = (organizations: string[], organization: string | undefined) => {
  const name = organization?.trim();
  if (name && !organizations.some((listed) => sameOrganization(listed, name))) organizations.push(name);
};

/**
  what: real owner organizations of a set's objects, in object order.
  how: reads each object's owner, skipping placeholder names and repeats.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx and useMapStore.ts.
*/
export function objectOwnerOrganizations(objects: Pick<AssuranceObject, 'ownerOrganization'>[] = []): string[] {
  const owners: string[] = [];
  for (const object of objects) {
    if (!PLACEHOLDER_OWNERS.includes(object.ownerOrganization)) addOrganization(owners, object.ownerOrganization);
  }
  return owners;
}

/**
  what: the providers of a set: every owner of an object on it, each of which submits for its objects.
  how: non-client owners come first, then the client when it owns an object; a requesting provider is included. With no owner the client is the provider.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function setProviders(
  objects: Pick<AssuranceObject, 'ownerOrganization'>[],
  client: string,
  requestingProvider?: string,
): string[] {
  const owners = objectOwnerOrganizations(objects);
  addOrganization(owners, requestingProvider);
  const others = owners.filter((owner) => !sameOrganization(owner, client));
  const clientOwns = owners.some((owner) => sameOrganization(owner, client));
  return others.length === 0 || clientOwns ? [...others, client] : others;
}

/**
  what: the provider that submits a task.
  how: the owner of the task's object, otherwise of the first object of the task's type, otherwise the first provider.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx and useMapStore.ts.
*/
export function taskProvider(
  objects: Pick<AssuranceObject, 'id' | 'type' | 'ownerOrganization'>[],
  providers: string[],
  subtype?: AssuranceSubtype,
  targetObjectId?: string,
): string | undefined {
  const object =
    objects.find((item) => item.id === targetObjectId) ||
    objects.find((item) => getAssuranceObjectScope(item.type) === subtype);
  return (
    providers.find((provider) => object && sameOrganization(provider, object.ownerOrganization)) || providers[0]
  );
}

/**
  what: every organization on a set.
  how: uses the recorded list, otherwise collects the client, provider, stakeholder organizations and object owners stored on the set.
  with what file: src/utils/projectHelpers.ts used by AssuranceDetailView.tsx and CreateAssuranceSetView.tsx.
*/
export function setOrganizations(
  set: Pick<
    AssuranceSet,
    | 'organizations'
    | 'clientOrg'
    | 'charterer'
    | 'serviceProviderOrg'
    | 'stakeholders'
    | 'assignedSubmitter'
    | 'assignedVerifier'
    | 'assignedInspector'
    | 'assignedApprover'
    | 'assuranceObjects'
  >,
): string[] {
  if (set.organizations?.length) return set.organizations;
  const organizations: string[] = [];
  addOrganization(organizations, set.clientOrg || set.charterer);
  addOrganization(organizations, set.serviceProviderOrg);
  addOrganization(organizations, set.stakeholders?.submitterOrg || parseAssigneeOrganization(set.assignedSubmitter || ''));
  addOrganization(organizations, set.stakeholders?.verifierOrg || parseAssigneeOrganization(set.assignedVerifier || ''));
  addOrganization(organizations, set.stakeholders?.inspectorOrg || parseAssigneeOrganization(set.assignedInspector || ''));
  addOrganization(organizations, set.stakeholders?.approverOrg || parseAssigneeOrganization(set.assignedApprover || ''));
  objectOwnerOrganizations(set.assuranceObjects).forEach((owner) => addOrganization(organizations, owner));
  return organizations;
}

/**
  what: the organization list with any unlisted object owner added.
  how: keeps the list order and appends each new owner; returns the same list when nothing is new.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function addObjectOwners(
  organizations: string[],
  objects: Pick<AssuranceObject, 'ownerOrganization'>[],
): string[] {
  const next = [...organizations];
  objectOwnerOrganizations(objects).forEach((owner) => addOrganization(next, owner));
  return next.length === organizations.length ? organizations : next;
}

/**
  what: why an organization cannot leave a set, or null when it can.
  how: names the first object it owns, then the first role it holds.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function organizationInUse(
  organization: string,
  objects: Pick<AssuranceObject, 'name' | 'ownerOrganization'>[],
  roles: Partial<Record<'Verifier' | 'Inspector' | 'Approver', string>>,
): string | null {
  const owned = objects.find((object) => sameOrganization(object.ownerOrganization, organization));
  if (owned) return 'Owns ' + owned.name + '. Remove that object first.';
  const role = (Object.keys(roles) as Array<'Verifier' | 'Inspector' | 'Approver'>).find((key) => {
    const held = roles[key];
    return Boolean(held) && sameOrganization(held!, organization);
  });
  return role ? 'Is the ' + role + '. Choose another organization first.' : null;
}

/**
  what: listed organizations that may verify or approve a set.
  how: an organization that owns an object cannot review it; the client is exempt because its own objects are internal assurance.
  with what file: src/utils/projectHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function eligibleReviewers(
  organizations: string[],
  objects: Pick<AssuranceObject, 'ownerOrganization'>[],
  client: string,
): string[] {
  const owners = objectOwnerOrganizations(objects);
  return organizations.filter(
    (organization) =>
      sameOrganization(organization, client) || !owners.some((owner) => sameOrganization(owner, organization)),
  );
}

/**
  what: builds the project party list from the chain and any extra organizations.
  how: client, head contractor, and vendor are recorded once; a repeated name is kept on its first role.
  with what file: src/utils/projectHelpers.ts used by CreateProjectView.tsx and useMapStore.ts.
*/
export function buildContractParties(input: {
  client: string;
  headContractor?: string;
  vendor?: string;
  extraParties?: OrganizationParty[];
}): ContractParty[] {
  const parties: ContractParty[] = [];
  const add = (organization: string | undefined, group: OrganizationParty['group'], chainRole?: ContractChainRole) => {
    const name = organization?.trim();
    if (!name) return;
    if (parties.some((party) => sameOrganization(party.organization, name))) return;
    parties.push({ organization: name, group, ...(chainRole ? { chainRole } : {}) });
  };
  add(input.client, 'Client', 'client');
  add(input.headContractor, 'Vendor', 'head_contractor');
  add(input.vendor, 'Vendor', 'vendor');
  for (const extra of input.extraParties ?? []) add(extra.organization, extra.group);
  return parties;
}

export function contractPartyByRole(
  parties: ContractParty[] | undefined,
  role: ContractChainRole,
): ContractParty | undefined {
  return parties?.find((party) => party.chainRole === role);
}

/**
 * Whether the active persona and viewing organization may edit the project's contract chain
 * or participating organizations. Only an Administrator of the project's owner organization may edit.
 * Fails closed when viewingOrganization or project owner organization is empty.
 */
export function canEditProjectOrganizations(
  project?: {
    ownerOrganization?: string;
    requestingOrganization?: string;
    charterer?: string;
  } | null,
  persona?: string | null,
  viewingOrganization?: string | null,
): boolean {
  if (!project || !persona || !viewingOrganization) return false;
  const viewer = viewingOrganization.trim();
  if (!viewer) return false;
  const isAdmin = persona === 'Administrator' || persona === 'C Admin';
  if (!isAdmin) return false;
  const ownerOrg =
    project.ownerOrganization?.trim() ||
    project.requestingOrganization?.trim() ||
    project.charterer?.trim() ||
    '';
  if (!ownerOrg) return false;
  return sameOrganization(ownerOrg, viewer) || orgFieldMatches(ownerOrg, viewer);
}

/**
 * Sets or clears head_contractor or vendor in a contract parties list.
 * - The old holder stays in the list without a chainRole.
 * - If the organization is already in the list, moves it into the role rather than adding a duplicate.
 * - Rejects client role (returns parties unmodified).
 * - Reuses sameOrganization and contractPartyByRole.
 */
export function replaceChainParty(
  parties: ContractParty[] | undefined,
  role: ContractChainRole,
  organization: string | undefined,
): ContractParty[] {
  const currentParties = parties ? [...parties] : [];
  if (role === 'client') return currentParties;

  const trimmed = organization?.trim() || '';
  const currentHolder = contractPartyByRole(currentParties, role);

  // Reject assigning client organization to a contractor role
  const clientParty = contractPartyByRole(currentParties, 'client');
  if (trimmed && clientParty && sameOrganization(clientParty.organization, trimmed)) {
    return currentParties;
  }

  // If role is being cleared
  if (!trimmed) {
    if (!currentHolder) return currentParties;
    return currentParties.map((party) => {
      if (
        party === currentHolder ||
        (party.chainRole === role && sameOrganization(party.organization, currentHolder.organization))
      ) {
        const { chainRole: _, ...rest } = party;
        return rest;
      }
      return party;
    });
  }

  // If already held by this organization in this role
  if (currentHolder && sameOrganization(currentHolder.organization, trimmed)) {
    return currentParties;
  }

  // Demote old holder: old holder stays in the list without chainRole
  const nextParties: ContractParty[] = [];
  for (const party of currentParties) {
    if (party.chainRole === role) {
      const { chainRole: _, ...rest } = party;
      nextParties.push(rest);
    } else {
      nextParties.push(party);
    }
  }

  // If organization is already in the list, move into the role
  const existingIndex = nextParties.findIndex((p) => sameOrganization(p.organization, trimmed));
  if (existingIndex >= 0) {
    nextParties[existingIndex] = {
      ...nextParties[existingIndex],
      chainRole: role,
    };
  } else {
    nextParties.push({
      organization: trimmed,
      group: 'Vendor',
      chainRole: role,
    });
  }

  return nextParties;
}

/**
  what: ensures all invitedOrganizations are present in contractParties.
  how: checks project.invitedOrganizations, and appends any missing ones as Vendor contractParties.
  with what file: src/utils/projectHelpers.ts consumed by ProjectDetailView.tsx, RequestAssuranceSetModal.tsx, and EditParticipatingOrganizationsModal.tsx.
*/
export function syncInvitedOrganizationsToParties<
  T extends Pick<Project, 'contractParties' | 'invitedOrganizations'>,
>(project: T): T {
  const invited = project.invitedOrganizations ?? [];
  if (invited.length === 0) return project;
  const currentParties = project.contractParties ?? [];
  const missing = invited.filter(
    (org) => org?.trim() && !currentParties.some((p) => sameOrganization(p.organization, org)),
  );
  if (missing.length === 0) return project;
  const newParties: ContractParty[] = [
    ...currentParties,
    ...missing.map((org) => ({ organization: org.trim(), group: 'Vendor' as const })),
  ];
  return {
    ...project,
    contractParties: newParties,
  };
}

/**
  what: organizations on a set with their group.
  how: uses the recorded party list, otherwise the client and the vendor already stored on the set.
  with what file: src/utils/projectHelpers.ts used by AssuranceDetailView.tsx and CreateAssuranceSetView.tsx.
*/
export function setOrganizationParties(
  set: Pick<AssuranceSet, 'parties' | 'clientOrg' | 'charterer' | 'serviceProviderOrg'>,
): OrganizationParty[] {
  if (set.parties?.length) return set.parties;
  const parties: OrganizationParty[] = [];
  const client = set.clientOrg?.trim() || set.charterer?.trim();
  if (client) parties.push({ organization: client, group: 'Client' });
  const vendor = set.serviceProviderOrg?.trim();
  if (vendor && (!client || !sameOrganization(vendor, client))) {
    parties.push({ organization: vendor, group: 'Vendor' });
  }
  return parties;
}

export function formatProjectValue(value: number | null | undefined, currency?: string): string {
  if (value == null || Number.isNaN(value)) return '';
  const code = currency?.trim() || 'USD';
  const amount = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(value);
  return `${code} ${amount}`;
}

export function getProjectOrganizationForPersona(
  persona: UserRolePersona,
  users: Pick<UserProfile, 'roles' | 'organization'>[],
  sessionOrganization?: string,
): string {
  if (sessionOrganization?.trim()) return sessionOrganization.trim();
  if (persona === 'C Admin') {
    return getClientAdminOrganization(users);
  }
  return 'Northwind Marine Pty Ltd';
}

export function isOrganizationMatch(org: string, fieldValue: string): boolean {
  return orgFieldMatches(org, fieldValue);
}

export function isVesselOwnedByOrganization(vessel: VesselInformation, org: string): boolean {
  if (!org?.trim()) return false;
  return [vessel.registeredOwner, vessel.technicalManager, vessel.ismCompany].some(
    (field) => field && orgFieldMatches(org, field),
  );
}

export function isCrewOwnedByOrganization(crewMember: CrewMember, org: string): boolean {
  if (!org?.trim() || !crewMember.organization) return false;
  return orgFieldMatches(org, crewMember.organization);
}

export function isEquipmentOwnedByOrganization(equipment: EquipmentAsset, org: string): boolean {
  if (!org?.trim()) return false;
  return orgFieldMatches(org, equipment.owningOrganization);
}

export function isAssetOwnedByOrganization(
  assetType: ProjectAssetLink['assetType'],
  org: string,
  vessel?: VesselInformation,
  crewMember?: CrewMember,
  equipment?: EquipmentAsset,
): boolean {
  if (assetType === 'Vessel' && vessel) return isVesselOwnedByOrganization(vessel, org);
  if (assetType === 'Crew' && crewMember) return isCrewOwnedByOrganization(crewMember, org);
  if (assetType === 'Equipment' && equipment) return isEquipmentOwnedByOrganization(equipment, org);
  return false;
}

export function filterVesselsForProjectComposition(
  vessels: VesselInformation[],
  persona: UserRolePersona,
  requestingOrganization: string,
  assuranceSets: AssuranceSet[],
  includeExternalProviders: boolean,
): VesselInformation[] {
  if (includeExternalProviders) return vessels;
  if (persona === 'Administrator') {
    return filterVesselsForPersona(vessels, assuranceSets, persona);
  }
  return vessels.filter((v) => isVesselOwnedByOrganization(v, requestingOrganization));
}

export function filterCrewForProjectComposition(
  crew: CrewMember[],
  requestingOrganization: string,
  includeExternalProviders: boolean,
): CrewMember[] {
  if (includeExternalProviders) return crew;
  return crew.filter((c) => isCrewOwnedByOrganization(c, requestingOrganization));
}

export function filterEquipmentForProjectComposition(
  equipment: EquipmentAsset[],
  requestingOrganization: string,
  includeExternalProviders: boolean,
): EquipmentAsset[] {
  if (includeExternalProviders) return equipment;
  return equipment.filter((e) => isEquipmentOwnedByOrganization(e, requestingOrganization));
}

/** External-provider assets only (excludes same organization as the project requester). */
export function filterExternalVesselsForProjectComposition(
  vessels: VesselInformation[],
  requestingOrganization: string,
): VesselInformation[] {
  return vessels.filter(
    (v) => !isVesselOwnedByOrganization(v, requestingOrganization),
  );
}

export function filterExternalCrewForProjectComposition(
  crew: CrewMember[],
  requestingOrganization: string,
): CrewMember[] {
  return crew.filter(
    (c) => !isCrewOwnedByOrganization(c, requestingOrganization),
  );
}

export function filterExternalEquipmentForProjectComposition(
  equipment: EquipmentAsset[],
  requestingOrganization: string,
): EquipmentAsset[] {
  return equipment.filter(
    (e) => !isEquipmentOwnedByOrganization(e, requestingOrganization),
  );
}

/**
  what: true when a set can seed a project roster row (vessel, crew or equipment).
  how: uses the same resolver as Create Project Step 2 → Step 3 seeding.
*/
export function isAssuranceSetRosterable(
  set: AssuranceSet,
  vessels: VesselInformation[],
  crew: CrewMember[],
  equipment: EquipmentAsset[],
): boolean {
  return Boolean(buildDraftAssetLinkFromAssuranceSet(set, vessels, crew, equipment));
}

/**
  what: true when a set's contract period lies fully inside the project window.
  how: requires both windows; set start on or after project start and set end on or before project end.
  Dates are not rewritten — callers filter or block selection instead.
*/
export function isAssuranceSetWithinProjectWindow(
  set: Pick<AssuranceSet, 'charterWindowStart' | 'charterWindowEnd'>,
  projectWindowStart: string,
  projectWindowEnd: string,
): boolean {
  if (!projectWindowStart || !projectWindowEnd) return false;
  if (!set.charterWindowStart || !set.charterWindowEnd) return false;
  return (
    projectWindowStart <= set.charterWindowStart && set.charterWindowEnd <= projectWindowEnd
  );
}

export type ProjectDateBounds = {
  min?: string;
  max?: string;
};

export type ClampedPeriod = {
  start: string;
  end: string;
  moved: boolean;
};

/**
  what: date boundaries of a project window, optionally constrained by an earliest selectable date.
  how: returns min (the later of project start and earliest) and max (project end); no project or no window returns no limits.
*/
export function getProjectDateBounds(
  project?: { charterWindowStart?: string; charterWindowEnd?: string } | null,
  earliest?: string,
): ProjectDateBounds {
  if (!project || !project.charterWindowStart || !project.charterWindowEnd) {
    return {};
  }
  const min = earliest && earliest > project.charterWindowStart
    ? earliest
    : project.charterWindowStart;
  return {
    min,
    max: project.charterWindowEnd,
  };
}

/**
  what: clamps a contract period so start and end fit within the given date bounds.
  how: clamps start to min and max, clamps end to min and max, ensures end >= start, reports moved.
*/
export function clampPeriodToBounds(
  start: string,
  end: string,
  bounds: ProjectDateBounds,
): ClampedPeriod {
  let nextStart = start;
  let nextEnd = end;

  if (bounds.min) {
    if (nextStart && nextStart < bounds.min) nextStart = bounds.min;
    if (nextEnd && nextEnd < bounds.min) nextEnd = bounds.min;
  }
  if (bounds.max) {
    if (nextStart && nextStart > bounds.max) nextStart = bounds.max;
    if (nextEnd && nextEnd > bounds.max) nextEnd = bounds.max;
  }
  if (nextStart && nextEnd && nextStart > nextEnd) {
    nextEnd = nextStart;
    if (bounds.max && nextEnd > bounds.max) {
      nextEnd = bounds.max;
      nextStart = bounds.max;
    }
  }

  const moved = nextStart !== start || nextEnd !== end;
  return { start: nextStart, end: nextEnd, moved };
}

export type AssuranceSetsForProjectCreationOptions = {
  vessels?: VesselInformation[];
  crew?: CrewMember[];
  equipment?: EquipmentAsset[];
  projectWindowStart?: string;
  projectWindowEnd?: string;
};

/**
  what: assurance sets the requester may seed a new project from.
  how: public or org-matched sets that are not drafts/private and do not already belong to a project
  (a set is 1:1 with a project; a project may hold many sets). When asset registries are passed,
  only rosterable sets are kept. When a project window is passed, only sets fully inside it are kept.
*/
export function getAssuranceSetsForProjectCreation(
  assuranceSets: AssuranceSet[],
  requestingOrganization: string,
  projects: Project[] = [],
  options: AssuranceSetsForProjectCreationOptions = {},
): AssuranceSet[] {
  const {
    vessels,
    crew,
    equipment,
    projectWindowStart = '',
    projectWindowEnd = '',
  } = options;
  const requireRosterable = Boolean(vessels && crew && equipment);
  const requireWindow = Boolean(projectWindowStart && projectWindowEnd);

  return assuranceSets.filter((s) => {
    if (s.visibility === 'draft' || (s.visibility as string) === 'private') return false;
    /* already on a project — cannot seed another (same rule as getStandaloneAssuranceSetsForAttach) */
    if (getProjectForAssuranceSet(s, projects)) return false;
    const isPublic = s.visibility === 'public';
    const matchesOrg =
      !requestingOrganization ||
      orgFieldMatches(requestingOrganization, s.charterer || '') ||
      orgFieldMatches(requestingOrganization, s.initiatorOrg || '') ||
      orgFieldMatches(requestingOrganization, s.clientOrg || '') ||
      orgFieldMatches(requestingOrganization, s.serviceProviderOrg || '');
    if (!(isPublic || matchesOrg)) return false;
    if (
      requireRosterable &&
      !isAssuranceSetRosterable(s, vessels!, crew!, equipment!)
    ) {
      return false;
    }
    if (
      requireWindow &&
      !isAssuranceSetWithinProjectWindow(s, projectWindowStart, projectWindowEnd)
    ) {
      return false;
    }
    return true;
  });
}

export type DraftProjectAssetLink = {
  assetType: ProjectAssetLink['assetType'];
  assetId: string;
  assetName: string;
  providerOrganization: string;
  assuranceSetId: string;
  roleInProject: string;
  notes?: string;
};

/** Shown when no assets qualify for project linking (no charter assurance set yet). */
export const PROJECT_ASSET_LINK_HINT =
  'Charter it from the Marketplace first, or use Add Assurance Set.';

/** External asset eligible for project linking — chartered/rented with at least one eligible assurance set. */
export type LinkableProjectAsset = {
  assetType: ProjectAssetLink['assetType'];
  assetId: string;
  assetName: string;
  providerOrganization: string;
  eligibleAssuranceSets: AssuranceSet[];
};

/** Resolve the primary asset represented by a standalone assurance set. */
export function buildDraftAssetLinkFromAssuranceSet(
  set: AssuranceSet,
  vessels: VesselInformation[],
  crew: CrewMember[],
  equipment: EquipmentAsset[],
): DraftProjectAssetLink | null {
  const defaultRoles: Partial<Record<ProjectAssetLink['assetType'], string>> = {
    Vessel: 'Subject vessel',
    Crew: 'Service crew',
    Equipment: 'Rented equipment',
  };

  if (set.assuranceType === 'Crew' && set.crewId) {
    const member = crew.find((c) => c.id === set.crewId);
    return {
      assetType: 'Crew',
      assetId: set.crewId,
      assetName: set.crewName || member?.fullName || set.crewId,
      providerOrganization:
        member?.organization || set.initiatorOrg || set.serviceProviderOrg || '',
      assuranceSetId: set.id,
      roleInProject: defaultRoles.Crew || '',
    };
  }

  if (set.assuranceType === 'Equipment' && set.equipmentId) {
    const item = equipment.find((e) => e.id === set.equipmentId);
    return {
      assetType: 'Equipment',
      assetId: set.equipmentId,
      assetName: set.equipmentName || item?.name || set.equipmentId,
      providerOrganization:
        item?.owningOrganization || set.initiatorOrg || set.serviceProviderOrg || '',
      assuranceSetId: set.id,
      roleInProject: defaultRoles.Equipment || '',
    };
  }

  if (set.vesselId) {
    const vessel = vessels.find((v) => v.id === set.vesselId);
    return {
      assetType: 'Vessel',
      assetId: set.vesselId,
      assetName: set.vesselName || vessel?.name || set.vesselId,
      providerOrganization:
        vessel?.registeredOwner || set.initiatorOrg || set.serviceProviderOrg || '',
      assuranceSetId: set.id,
      roleInProject: defaultRoles.Vessel || '',
    };
  }

  return null;
}

/** Build draft roster links from one or more seed assurance sets (deduped by asset). */
export function buildDraftAssetLinksFromAssuranceSets(
  setIds: string[],
  assuranceSets: AssuranceSet[],
  vessels: VesselInformation[],
  crew: CrewMember[],
  equipment: EquipmentAsset[],
): { links: DraftProjectAssetLink[]; unresolvedSetIds: string[] } {
  const links: DraftProjectAssetLink[] = [];
  const seen = new Set<string>();
  const unresolvedSetIds: string[] = [];

  setIds.forEach((setId) => {
    const set = assuranceSets.find((s) => s.id === setId);
    if (!set) {
      unresolvedSetIds.push(setId);
      return;
    }
    const link = buildDraftAssetLinkFromAssuranceSet(
      set,
      vessels,
      crew,
      equipment,
    );
    if (!link) {
      unresolvedSetIds.push(setId);
      return;
    }
    const key = `${link.assetType}:${link.assetId}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  });

  return { links, unresolvedSetIds };
}

/** Assurance sets linked to an asset from the Charter / rental flow. */
export function getCharterAssuranceSetsForAsset(
  assetType: ProjectAssetLink['assetType'],
  assetId: string,
  assuranceSets: AssuranceSet[],
): AssuranceSet[] {
  return assuranceSets.filter((set) => {
    if (assetType === 'Vessel') return set.vesselId === assetId;
    if (assetType === 'Crew') return getAssuranceSetCrewIds(set).includes(assetId);
    if (assetType === 'Equipment') return set.equipmentId === assetId;
    return false;
  });
}

export function isAssetCharteredOrRented(
  assetType: ProjectAssetLink['assetType'],
  assetId: string,
  assuranceSets: AssuranceSet[],
): boolean {
  return getCharterAssuranceSetsForAsset(assetType, assetId, assuranceSets).length > 0;
}

/**
 * Shared picker list for Create Project step 3 and ProjectAddAssetModal.
 * An asset appears only when it is chartered/rented (charter-flow assurance set exists)
 * and has at least one eligible assurance set for the requesting organization.
 * When orphanedAmongProjects is given, only sets with no project among them are eligible,
 * so an asset whose sets all belong to a project is not listed.
 */
export function getLinkableProjectAssets(input: {
  vessels: VesselInformation[];
  crew: CrewMember[];
  equipment: EquipmentAsset[];
  assuranceSets: AssuranceSet[];
  requestingOrganization: string;
  excludeAssetKeys?: Iterable<string>;
  orphanedAmongProjects?: Project[];
}): LinkableProjectAsset[] {
  const exclude = new Set(input.excludeAssetKeys ?? []);
  const list: LinkableProjectAsset[] = [];

  const pushIfLinkable = (
    assetType: ProjectAssetLink['assetType'],
    assetId: string,
    assetName: string,
    providerOrganization: string,
  ) => {
    const key = `${assetType}:${assetId}`;
    if (exclude.has(key)) return;
    if (!isAssetCharteredOrRented(assetType, assetId, input.assuranceSets)) return;

    const orgEligibleSets = getEligibleAssuranceSetsForAsset(
      assetType,
      assetId,
      input.assuranceSets,
      { requestingOrganization: input.requestingOrganization, providerOrganization },
    );
    const projects = input.orphanedAmongProjects;
    const eligibleAssuranceSets = projects
      ? orgEligibleSets.filter((s) => isAssuranceSetOrphaned(s, projects))
      : orgEligibleSets;
    if (eligibleAssuranceSets.length === 0) return;

    list.push({
      assetType,
      assetId,
      assetName,
      providerOrganization,
      eligibleAssuranceSets,
    });
  };

  filterExternalVesselsForProjectComposition(
    input.vessels,
    input.requestingOrganization,
  ).forEach((v) => {
    pushIfLinkable('Vessel', v.id, v.name, v.registeredOwner);
  });

  filterExternalCrewForProjectComposition(
    input.crew,
    input.requestingOrganization,
  ).forEach((c) => {
    pushIfLinkable('Crew', c.id, c.fullName, c.organization || '');
  });

  filterExternalEquipmentForProjectComposition(
    input.equipment,
    input.requestingOrganization,
  ).forEach((e) => {
    pushIfLinkable('Equipment', e.id, e.name, e.owningOrganization);
  });

  return list;
}

export function getEligibleAssuranceSetsForAsset(
  assetType: ProjectAssetLink['assetType'],
  assetId: string,
  assuranceSets: AssuranceSet[],
  options?: {
    requestingOrganization?: string;
    providerOrganization?: string;
  },
): AssuranceSet[] {
  const matched = assuranceSets.filter((set) => {
    if (set.visibility === 'draft' || (set.visibility as string) === 'private') return false;
    if (assetType === 'Vessel') return set.vesselId === assetId;
    if (assetType === 'Crew') return getAssuranceSetCrewIds(set).includes(assetId);
    if (assetType === 'Equipment') return set.equipmentId === assetId;
    return false;
  });

  const requestingOrg = options?.requestingOrganization?.trim();
  if (!requestingOrg) return matched;

  const providerOrg = options?.providerOrganization?.trim() || requestingOrg;
  const isCrossOrg = requiresAssuranceSetForAssetLink(requestingOrg, providerOrg);

  if (isCrossOrg) return matched;

  return matched.filter((set) => {
    if (set.visibility === 'public') return true;
    return (
      orgFieldMatches(requestingOrg, set.initiatorOrg || '') ||
      orgFieldMatches(requestingOrg, set.charterer || '') ||
      orgFieldMatches(requestingOrg, set.clientOrg || '') ||
      orgFieldMatches(requestingOrg, set.serviceProviderOrg || '')
    );
  });
}

/** Standalone assurance sets eligible to attach to a project roster (public and organizational). */
export function getStandaloneAssuranceSetsForAttach(
  assuranceSets: AssuranceSet[],
  project: Project,
  allProjects: Project[] = [project],
): AssuranceSet[] {
  const linkedIds = new Set(project.assetLinks.map((l) => l.assuranceSetId));
  return assuranceSets.filter((s) => {
    if (linkedIds.has(s.id) || s.visibility === 'draft' || (s.visibility as string) === 'private') {
      return false;
    }
    /* a set belongs to at most one project, so sets already in another project are not offered */
    return !getProjectForAssuranceSet(s, allProjects);
  });
}

/** Assurance sets belonging to a project (by projectId or asset link). */
export function getProjectAssuranceSets(
  project: Project,
  assuranceSets: AssuranceSet[],
): AssuranceSet[] {
  const linkedIds = new Set(
    project.assetLinks.map((l) => l.assuranceSetId).filter(Boolean),
  );
  const seen = new Set<string>();
  const result: AssuranceSet[] = [];

  assuranceSets.forEach((set) => {
    const belongs =
      set.projectId === project.id || linkedIds.has(set.id);
    if (!belongs || seen.has(set.id)) return;
    seen.add(set.id);
    result.push(set);
  });

  return result;
}

/**
  what: calculates a project's readiness (0-100%); inputs are the project and all assurance sets.
  how: averages the readiness of every set that belongs to the project, the same rollup rule used for vessels and dashboards; a project with no sets scores 0.
  with what file: src/utils/projectHelpers.ts consumed by the store rollups, ProjectView.tsx, ProjectDetailView.tsx and DashboardView.tsx.
*/
export function calculateProjectReadiness(
  project: Project,
  assuranceSets: AssuranceSet[],
): number {
  const sets = getProjectAssuranceSets(project, assuranceSets);
  if (sets.length === 0) return 0;

  const total = sets.reduce((sum, s) => sum + calculateAssuranceSetReadiness(s, assuranceSets), 0);
  return Math.round(total / sets.length);
}

/**
  what: computes the percentage (0-100%) of approved required tasks across a project's sub-sets.
  how: counts mandatory, non-exempted requirements across all sub-sets of the project; a requirement is approved if its parent set is closed/approved or its verifierStatus is 'Verified' or isFulfilled is true.
  with what file: src/utils/projectHelpers.ts consumed by ProjectOverviewTab.tsx.
*/
export function calculateProjectApprovedPercentage(
  project: Project,
  assuranceSets: AssuranceSet[],
): number {
  const sets = getProjectAssuranceSets(project, assuranceSets);
  if (sets.length === 0) return 0;

  let totalRequired = 0;
  let approvedCount = 0;

  for (const set of sets) {
    const isSetApproved = isClosedAssuranceSet(set);
    const reqs = set.requirements ?? [];
    for (const req of reqs) {
      if (req.isMandatory === false || req.exemption) continue;
      totalRequired++;
      if (isSetApproved || req.verifierStatus === 'Verified' || req.isFulfilled) {
        approvedCount++;
      }
    }
  }

  if (totalRequired === 0) return 0;
  return Math.round((approvedCount / totalRequired) * 100);
}

export function deriveProjectStatus(
  project: Project,
  assuranceSets: AssuranceSet[],
): Project['status'] {
  const sets = getProjectAssuranceSets(project, assuranceSets);
  if (sets.length === 0 && project.assetLinks.length === 0) {
    return 'Composing';
  }

  const allApproved =
    sets.length > 0 &&
    sets.every(
      (s) =>
        s.stage === 'Approved' ||
        s.stage === 'Certified' ||
        s.approverDecision === 'Approved',
    );

  if (allApproved) return 'Ready for Charter';
  if (sets.length > 0 || project.assetLinks.length > 0) {
    return 'Assurance In Progress';
  }
  return 'Composing';
}

function projectOrgMatchesClient(
  project: Project,
  clientOrg: string,
): boolean {
  const fields = [
    project.ownerOrganization,
    project.operatorOrganization,
    project.clientOperator,
    project.requestingOrganization,
    project.charterer,
  ];
  return fields.some((field) => field && orgFieldMatches(clientOrg, field));
}

/**
  what: checks whether a single project is accessible to a user in their active persona session.
  how: checks project ownership/operator, invited orgs, creator/stakeholder assignment, direct notifications, and child assurance set assignments.
  with what file: src/utils/projectHelpers.ts used by useMapStore.ts, App.tsx, HeaderBanner.tsx, CreateAssuranceSetView.tsx, useNotificationInbox.ts, and tests.
*/
export function isProjectAccessibleToUser(
  project: Project,
  persona: UserRolePersona,
  users: UserProfile[],
  assuranceSets: AssuranceSet[] = [],
  sessionOrganization?: string,
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
  notifications: (AppNotification | { type?: string; projectId?: string; assuranceSetId?: string; recipientUserId?: string })[] = [],
): boolean {
  if (!project) return false;

  const resolvedUser =
    sessionUser ??
    getSessionUserForPersona(
      persona,
      users,
      sessionOrganization ? { organization: sessionOrganization } : undefined,
    );
  const user =
    resolvedUser &&
    (!sessionOrganization ||
      !resolvedUser.organization ||
      orgFieldMatches(sessionOrganization, resolvedUser.organization))
      ? resolvedUser
      : (sessionUser ?? undefined);

  // Direct stakeholder on project
  if (user?.id && project.stakeholderUserIds?.includes(user.id)) {
    return true;
  }

  // Direct creator of project
  if (user?.id && project.createdByUserId === user.id) {
    return true;
  }

  // Direct notification to user for this project or its child sets
  if (
    user?.id &&
    notifications?.length > 0 &&
    notifications.some(
      (n) =>
        n.recipientUserId === user.id &&
        (n.projectId === project.id ||
          Boolean(project.assetLinks?.some((l) => l.assuranceSetId && l.assuranceSetId === n.assuranceSetId))),
    )
  ) {
    return true;
  }

  if (persona === 'Administrator') {
    /* a Provider sees a project as its client, or through an assigned assurance set (ADR 0032); being a provider alone does not open every project */
    if (sessionOrganization && projectOrgMatchesClient(project, sessionOrganization)) return true;
    if (assuranceSets.length === 0) return false;
    return getProjectAssuranceSets(project, assuranceSets).some((set) =>
      isAssuranceSetAssignedToPersona(set, persona, sessionOrganization, user, users),
    );
  }

  if (persona === 'C Admin') {
    const clientOrg = getClientAdminOrganization(users, sessionOrganization);
    if (clientOrg && projectOrgMatchesClient(project, clientOrg)) return true;
    if (sessionOrganization && projectOrgMatchesClient(project, sessionOrganization)) return true;
    if (assuranceSets.length === 0) return false;
    return getProjectAssuranceSets(project, assuranceSets).some((set) =>
      isAssuranceSetAssignedToPersona(set, persona, sessionOrganization, user, users),
    );
  }

  if (persona === 'Submitter') {
    if (
      sessionOrganization &&
      !projectOrgMatchesClient(project, sessionOrganization) &&
      project.invitedOrganizations?.some((org) => orgFieldMatches(sessionOrganization, org))
    ) {
      return true;
    }
  }

  const operationalPersonas: UserRolePersona[] = [
    'Submitter',
    'Verifier',
    'Inspector',
    'Approver',
  ];
  if (operationalPersonas.includes(persona)) {
    return getProjectAssuranceSets(project, assuranceSets).some((set) =>
      isAssuranceSetAssignedToPersona(set, persona, sessionOrganization, user, users),
    );
  }

  return false;
}

export function filterProjectsForPersona(
  projects: Project[],
  persona: UserRolePersona,
  users: UserProfile[],
  assuranceSets: AssuranceSet[] = [],
  sessionOrganization?: string,
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'>,
  notifications?: (AppNotification | { type?: string; projectId?: string; assuranceSetId?: string; recipientUserId?: string })[],
): Project[] {
  return projects.filter((p) =>
    isProjectAccessibleToUser(
      p,
      persona,
      users,
      assuranceSets,
      sessionOrganization,
      sessionUser,
      notifications,
    ),
  );
}

/** Users in the sender's org who may create assurance sets (Vessel Admin / Submitter / C Admin). */
export function getAssuranceSetCreatorsInOrganization(
  users: UserProfile[],
  organization: string,
): UserProfile[] {
  const creatorRoles = new Set(['Administrator', 'Submitter', 'C Admin']);
  return users.filter(
    (u) =>
      u.status === 'Active' &&
      u.roles.some((role) => creatorRoles.has(role as UserRolePersona)) &&
      orgFieldMatches(organization, u.organization),
  );
}

/** Charterable vessels plus any vessel already linked to the project. */
export function withProjectVessels<T extends { id: string }>(
  charterable: T[],
  allVessels: T[],
  project: Pick<Project, 'assetLinks'> | undefined,
): T[] {
  const linkedIds = new Set(
    (project?.assetLinks ?? [])
      .filter((link) => link.assetType === 'Vessel')
      .map((link) => link.assetId),
  );
  const extras = allVessels.filter(
    (vessel) => linkedIds.has(vessel.id) && !charterable.some((item) => item.id === vessel.id),
  );
  return [...charterable, ...extras];
}

/** Creators in the sender's organization and in organizations invited onto the project. */
export function getAssuranceSetRequestRecipients(
  users: UserProfile[],
  senderOrganization: string,
  invitedOrganizations: string[] = [],
  senderUserId?: string,
): UserProfile[] {
  const seen = new Set<string>();
  const recipients: UserProfile[] = [];
  [senderOrganization, ...invitedOrganizations].forEach((organization) => {
    /* only a client admin of the organization can create a set for another party */
    getAssuranceSetCreatorsInOrganization(users, organization)
      .filter((user) => user.roles.some((role) => role === 'C Admin'))
      .forEach((user) => {
      if (user.id === senderUserId || seen.has(user.id)) return;
      seen.add(user.id);
      recipients.push(user);
    });
  });
  return recipients;
}

/** Resolve primary sub-asset ids from explicit project fields or first matching asset link. */
export function resolveProjectPrimaryAssetIds(
  project: Project,
): Pick<AssuranceProject, 'primaryVesselId' | 'primaryCrewId' | 'primaryEquipmentId' | 'primaryActivityId'> {
  const fromLink = (assetType: ProjectAssetLink['assetType']) =>
    project.assetLinks.find((link) => link.assetType === assetType)?.assetId;

  return {
    primaryVesselId: project.primaryVesselId || fromLink('Vessel'),
    primaryCrewId: project.primaryCrewId || fromLink('Crew'),
    primaryEquipmentId: project.primaryEquipmentId || fromLink('Equipment'),
    primaryActivityId: project.primaryActivityId,
  };
}

/** Map a live registry project to assurance wizard project scope metadata. */
export function projectToAssuranceProjectScope(project: Project): AssuranceProject {
  return {
    id: project.id,
    name: project.name,
    clientOperator: project.clientOperator || project.requestingOrganization,
    location: project.location,
    description: project.description,
    ...resolveProjectPrimaryAssetIds(project),
    defaultTemplateId: project.defaultTemplateId,
  };
}

/**
  what: project scope options for Create Assurance Set wizard.
  how: persona-filtered live store projects only (catalog entries are seeded in projectMockData).
*/
export function getAssuranceWizardProjectOptions(
  projects: Project[],
  persona: UserRolePersona,
  users: UserProfile[],
  assuranceSets: AssuranceSet[] = [],
  sessionOrganization?: string,
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'>,
): AssuranceProject[] {
  return filterProjectsForPersona(
    projects,
    persona,
    users,
    assuranceSets,
    sessionOrganization,
    sessionUser,
  ).map(projectToAssuranceProjectScope);
}

export function generateUniqueProjectId(existing: Project[]): string {
  const year = new Date().getFullYear();
  const prefix = `MAP-PROJ-${year}-MARINE-`;
  let seq = existing.filter((p) => p.id.startsWith(prefix)).length + 1;
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  while (existing.some((p) => p.id === candidate)) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  }
  return candidate;
}

export function countProjectAssets(links: ProjectAssetLink[]): string {
  const vessels = links.filter((l) => l.assetType === 'Vessel').length;
  const crew = links.filter((l) => l.assetType === 'Crew').length;
  const equipment = links.filter((l) => l.assetType === 'Equipment').length;
  const parts: string[] = [];
  if (vessels) parts.push(`${vessels} vessel${vessels !== 1 ? 's' : ''}`);
  if (crew) parts.push(`${crew} crew`);
  if (equipment) parts.push(`${equipment} equipment`);
  return parts.length > 0 ? parts.join(', ') : '0 assets';
}

/* approved and certified are the same terminal position on the pipeline */
function isTerminalStage(stage: AssuranceSet['stage']): boolean {
  return stage === 'Approved' || stage === 'Certified' || stage === 'Cancelled';
}

/**
  what: recalculates the pipeline stage and readiness index of a set after any change; inputs are the set and an optional resolver for linked sets.
  how: derives the stage from the requirement statuses (the first stage not cleared by every mandatory requirement), then computes the readiness index at that stage. a set with no requirements keeps its recorded stage because there is nothing to derive from, and a terminal stage keeps the label the record already uses.
  with what file: src/utils/projectHelpers.ts called by every assurance set action in src/store/useMapStore.ts; replicates database trigger trg_fn_recalc_assurance_set_readiness.
*/
export function recalculateSetReadiness(
  set: AssuranceSet,
  linkedSetResolver?: (setId: string) => AssuranceSet | undefined,
): AssuranceSet {
  if (set.stage === 'Cancelled') {
    return set;
  }
  if (set.closureType === 'partial' && (set.stage === 'Approved' || set.stage === 'Certified')) {
    return {
      ...set,
      readinessScore: calculateAssuranceSetReadiness(set, linkedSetResolver),
    };
  }
  const derivedStage = set.requirements.length > 0 ? derivePipelineStage(set) : set.stage;
  const stage = isTerminalStage(derivedStage) && isTerminalStage(set.stage) ? set.stage : derivedStage;
  const staged: AssuranceSet = { ...set, stage };

  return {
    ...staged,
    readinessScore: calculateAssuranceSetReadiness(staged, linkedSetResolver),
  };
}

/**
 * Recompute project readiness (average of project sets) and status from linked assurance sets.
 */
export function syncProjectFromAssuranceSets(
  projectId: string,
  projects: Project[],
  assuranceSets: AssuranceSet[],
): Project[] {
  const targetProject = projects.find((p) => p.id === projectId);
  if (!targetProject) return projects;

  const readinessScore = calculateProjectReadiness(targetProject, assuranceSets);
  const status = deriveProjectStatus(targetProject, assuranceSets);

  return projects.map((p) =>
    p.id === projectId ? { ...p, readinessScore, status } : p,
  );
}

/** Sync project headers for all projects affected by changed assurance sets. */
export function syncAllAffectedProjectRollups(
  projects: Project[],
  assuranceSets: AssuranceSet[],
  affectedSetIds?: string[],
): { updatedProjects: Project[]; updatedAssuranceSets: AssuranceSet[] } {
  let curProjects = projects;

  const targetProjects =
    affectedSetIds && affectedSetIds.length > 0
      ? projects.filter((p) => {
          const projectSets = getProjectAssuranceSets(p, assuranceSets);
          return (
            p.assetLinks.some((l) => affectedSetIds.includes(l.assuranceSetId)) ||
            projectSets.some((s) => affectedSetIds.includes(s.id))
          );
        })
      : projects;

  for (const proj of targetProjects) {
    curProjects = syncProjectFromAssuranceSets(proj.id, curProjects, assuranceSets);
  }

  return { updatedProjects: curProjects, updatedAssuranceSets: assuranceSets };
}

export type PppPillar = 'People' | 'Plant' | 'Process';

/**
  what: whether an assurance set belongs under a People, Plant or Process pill.
  how: All keeps every set. A pillar keeps a set that has one requirement whose category is that pillar, or whose category maps to that pillar. A set with no requirements matches only All.
  with what file: src/utils/projectHelpers.ts; superseded on project detail by ProjectAssuranceStatusTable (ADR 0033).
*/
export function assuranceSetMatchesPpp(
  set: {
    tags?: ThreePillarsCategory[];
    pppTags?: ThreePillarsCategory[];
    requirements?: { category?: string; subtype?: string }[];
  },
  pillar: PppPillar | 'All',
): boolean {
  if (pillar === 'All') return true;
  const tags = (Array.isArray(set.tags) && set.tags.length > 0)
    ? set.tags
    : (Array.isArray(set.pppTags) && set.pppTags.length > 0)
      ? set.pppTags
      : undefined;

  if (tags && tags.length > 0) {
    return tags.some((tag) => tag.toLowerCase() === pillar.toLowerCase());
  }

  const target = pillar.toLowerCase();
  return (set.requirements ?? []).some((requirement) => {
    const category = (requirement.category ?? '').trim();
    const categoryKey = category.toLowerCase();
    if (categoryKey === 'people' || categoryKey === 'plant' || categoryKey === 'process') {
      return categoryKey === target;
    }
    if (!category && !requirement.subtype) return false;
    return getThreePillarsCategory(requirement.subtype, category || undefined).toLowerCase() === target;
  });
}

/* label shown wherever a set has no project */
export const ORPHANED_ASSURANCE_SET_LABEL = 'Orphaned';

/**
  what: finds the single project an assurance set belongs to; inputs are the set and all projects.
  how: resolves through the project roster link, then the set's projectId; returns undefined for an orphaned set.
  with what file: src/utils/projectHelpers.ts used by useMapStore.ts, AssuranceDetailView.tsx and ProjectDetailView.tsx.
*/
export function getProjectForAssuranceSet(
  set: Pick<AssuranceSet, 'id' | 'projectId'>,
  projects: Project[],
): Project | undefined {
  return (
    projects.find((p) => p.assetLinks.some((l) => l.assuranceSetId === set.id)) ||
    projects.find((p) => p.id === set.projectId)
  );
}

/**
  what: true when an assurance set has no project and can be added to one; inputs are the set and all projects.
  how: excludes unfinished drafts, then checks getProjectForAssuranceSet.
  with what file: src/utils/projectHelpers.ts used by AssuranceDetailView.tsx.
*/
export function isAssuranceSetOrphaned(set: AssuranceSet, projects: Project[]): boolean {
  if (set.visibility === 'draft') return false;
  return !getProjectForAssuranceSet(set, projects);
}
