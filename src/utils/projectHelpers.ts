/*
  file summary: project composition helpers — rollup sync, readiness, and asset AS filtering.
  responsibilities: filters projects by persona, resolves eligible sets per asset.
  role in system: consumed by useMapStore and project views.
*/

import { AssuranceProject, AssuranceRequirement, AssuranceSet, AssuranceSubtype } from '../types/assurance';
import { EXISTING_PROJECTS } from './assuranceTemplates';
import { UserRolePersona } from '../types/audit';
import { CrewMember } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';
import {
  Project,
  ProjectAssetLink,
  ProjectType,
  WORK_LOCATION_OPTIONS,
} from '../types/project';
import { UserProfile } from '../types/user';
import { VesselInformation } from '../types/vessel';
import { calculateAssuranceSetReadiness, derivePipelineStage } from './readinessHelpers';
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
  if (!org.trim()) return false;
  return [vessel.registeredOwner, vessel.technicalManager, vessel.ismCompany].some(
    (field) => field && orgFieldMatches(org, field),
  );
}

export function isCrewOwnedByOrganization(crewMember: CrewMember, org: string): boolean {
  if (!org.trim() || !crewMember.organization) return false;
  return orgFieldMatches(org, crewMember.organization);
}

export function isEquipmentOwnedByOrganization(equipment: EquipmentAsset, org: string): boolean {
  if (!org.trim()) return false;
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

/** Assurance sets the requester may seed a new project from (public and organizational). */
export function getAssuranceSetsForProjectCreation(
  assuranceSets: AssuranceSet[],
  requestingOrganization: string,
): AssuranceSet[] {
  return assuranceSets.filter((s) => {
    if (s.visibility === 'draft' || (s.visibility as string) === 'private') return false;
    const isPublic = s.visibility === 'public';
    const matchesOrg =
      !requestingOrganization ||
      orgFieldMatches(requestingOrganization, s.charterer || '') ||
      orgFieldMatches(requestingOrganization, s.initiatorOrg || '') ||
      orgFieldMatches(requestingOrganization, s.clientOrg || '') ||
      orgFieldMatches(requestingOrganization, s.serviceProviderOrg || '');

    return isPublic || matchesOrg;
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
    if (assetType === 'Crew') return set.crewId === assetId;
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
 */
export function getLinkableProjectAssets(input: {
  vessels: VesselInformation[];
  crew: CrewMember[];
  equipment: EquipmentAsset[];
  assuranceSets: AssuranceSet[];
  requestingOrganization: string;
  excludeAssetKeys?: Iterable<string>;
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

    const eligibleAssuranceSets = getEligibleAssuranceSetsForAsset(
      assetType,
      assetId,
      input.assuranceSets,
      { requestingOrganization: input.requestingOrganization, providerOrganization },
    );
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
    if (assetType === 'Crew') return set.crewId === assetId;
    if (assetType === 'Equipment') return set.equipmentId === assetId;
    if (assetType === 'Activity') return set.activityId === assetId;
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
    project.serviceProvider,
  ];
  return fields.some((field) => field && orgFieldMatches(clientOrg, field));
}

export function filterProjectsForPersona(
  projects: Project[],
  persona: UserRolePersona,
  users: UserProfile[],
  assuranceSets: AssuranceSet[] = [],
  sessionOrganization?: string,
): Project[] {
  if (persona === 'Administrator') return projects;

  if (persona === 'C Admin') {
    const clientOrg = getClientAdminOrganization(users, sessionOrganization);
    return projects.filter((p) => {
      if (projectOrgMatchesClient(p, clientOrg)) return true;
      if (assuranceSets.length === 0) return false;
      return getProjectAssuranceSets(p, assuranceSets).some((set) =>
        isAssuranceSetAssignedToPersona(set, persona),
      );
    });
  }

  const operationalPersonas: UserRolePersona[] = [
    'Submitter',
    'Verifier',
    'Inspector',
    'Approver',
  ];
  if (operationalPersonas.includes(persona)) {
    return projects.filter((p) =>
      getProjectAssuranceSets(p, assuranceSets).some((set) =>
        isAssuranceSetAssignedToPersona(set, persona),
      ),
    );
  }

  return [];
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
  how: persona-filtered live projects first, then static template catalog entries not already in the registry.
*/
export function getAssuranceWizardProjectOptions(
  projects: Project[],
  persona: UserRolePersona,
  users: UserProfile[],
  assuranceSets: AssuranceSet[] = [],
  sessionOrganization?: string,
): AssuranceProject[] {
  const registryProjects = filterProjectsForPersona(
    projects,
    persona,
    users,
    assuranceSets,
    sessionOrganization,
  ).map(
    projectToAssuranceProjectScope,
  );
  const registryIds = new Set(registryProjects.map((project) => project.id));
  const templateOnly = EXISTING_PROJECTS.filter((project) => !registryIds.has(project.id));
  return [...registryProjects, ...templateOnly];
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
  return stage === 'Approved' || stage === 'Certified';
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
