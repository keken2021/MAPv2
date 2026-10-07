/*
  file summary: project composition helpers — rollup sync, readiness, and asset AS filtering.
  responsibilities: builds master assurance requirements, filters projects by persona, resolves eligible sets per asset.
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
import { calculateAssuranceSetReadiness } from './readinessHelpers';
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

export function getProjectOrganizationForPersona(
  persona: UserRolePersona,
  users: Pick<UserProfile, 'roles' | 'organization'>[],
): string {
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
  if (assetType === 'Activity') return true;
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
    if (set.isProjectMaster) return false;
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

  return matched.filter(
    (set) =>
      orgFieldMatches(requestingOrg, set.initiatorOrg || '') ||
      orgFieldMatches(requestingOrg, set.charterer || ''),
  );
}

function assetTypeToSubtype(assetType: ProjectAssetLink['assetType']): AssuranceSubtype {
  if (assetType === 'Crew') return 'Crew';
  if (assetType === 'Equipment') return 'Equipment';
  if (assetType === 'Activity') return 'Activity';
  return 'Vessel';
}

function isChildSetComplete(childSet: AssuranceSet): boolean {
  return (
    childSet.stage === 'Approved' ||
    childSet.stage === 'Certified' ||
    childSet.approverDecision === 'Approved'
  );
}

/** Master project requirements that link to child assurance sub-sets (not flattened documents). */
export function buildMasterAssuranceRequirements(
  childSets: AssuranceSet[],
  projectName: string,
  assetLinks: ProjectAssetLink[] = [],
): AssuranceRequirement[] {
  if (assetLinks.length > 0) {
    const links = assetLinks
      .map((link): AssuranceRequirement | null => {
        const childSet = childSets.find((s) => s.id === link.assuranceSetId);
        if (!childSet) return null;
        const complete = isChildSetComplete(childSet);
        return {
          id: `PROJ-LINK-${link.assuranceSetId}`,
          category: 'Custom Requirement',
          title: childSet.title,
          description: `Linked sub-set for ${link.assetName} (${link.assetType}) · ${link.providerOrganization}`,
          subtype: assetTypeToSubtype(link.assetType),
          fulfillmentType: 'assurance_set' as const,
          linkedAssuranceSetId: childSet.id,
          isMandatory: true,
          isFulfilled: complete,
          ocrConfidence: 0,
          verifierStatus: complete ? ('Verified' as const) : ('Pending' as const),
        };
      })
      .filter((r): r is AssuranceRequirement => r !== null);

    if (links.length > 0) return links;
  }

  const merged: AssuranceRequirement[] = [];
  const seen = new Set<string>();

  childSets.forEach((childSet) => {
    childSet.requirements.forEach((req) => {
      const key = `${childSet.id}::${req.id}::${req.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        ...req,
        fulfillmentType: 'document',
        id: `PROJ-REQ-${childSet.id}-${req.id}`,
        description: req.description
          ? `${req.description} (from ${childSet.id} · ${childSet.title})`
          : `Sourced from ${childSet.id} · ${childSet.title}`,
      });
    });
  });

  if (merged.length === 0) {
    merged.push({
      id: 'PROJ-REQ-PLACEHOLDER',
      category: 'Activity Custom Requirement',
      title: `Project Charter Scope — ${projectName}`,
      description: 'Placeholder until asset assurance sets are linked and synced.',
      fulfillmentType: 'document',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    });
  }

  return merged;
}

/** Standalone assurance sets eligible to attach to a project roster. */
export function getStandaloneAssuranceSetsForAttach(
  assuranceSets: AssuranceSet[],
  project: Project,
): AssuranceSet[] {
  const linkedIds = new Set(project.assetLinks.map((l) => l.assuranceSetId));
  return assuranceSets.filter(
    (s) => !s.isProjectMaster && !linkedIds.has(s.id) && s.visibility !== 'draft',
  );
}

export function calculateProjectReadiness(
  project: Project,
  assuranceSets: AssuranceSet[],
): number {
  const childSetIds = project.assetLinks.map((l) => l.assuranceSetId).filter(Boolean);
  if (childSetIds.length === 0) {
    const master = assuranceSets.find((s) => s.id === project.masterAssuranceSetId);
    return master ? calculateAssuranceSetReadiness(master) : 0;
  }

  const scores = childSetIds
    .map((id) => assuranceSets.find((s) => s.id === id))
    .filter((s): s is AssuranceSet => Boolean(s))
    .map((s) => calculateAssuranceSetReadiness(s));

  return scores.length > 0 ? Math.min(...scores) : 0;
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
): Project[] {
  if (persona === 'Administrator') return projects;
  if (persona === 'C Admin') {
    const clientOrg = getClientAdminOrganization(users);
    return projects.filter((p) => {
      if (projectOrgMatchesClient(p, clientOrg)) return true;
      if (assuranceSets.length === 0) return false;

      const master = assuranceSets.find((s) => s.id === p.masterAssuranceSetId);
      if (master && isAssuranceSetAssignedToPersona(master, persona)) return true;

      return p.assetLinks.some((link) => {
        const child = assuranceSets.find((s) => s.id === link.assuranceSetId);
        return child && isAssuranceSetAssignedToPersona(child, persona);
      });
    });
  }
  return [];
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
    primaryActivityId: project.primaryActivityId || fromLink('Activity'),
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
): AssuranceProject[] {
  const registryProjects = filterProjectsForPersona(projects, persona, users, assuranceSets).map(
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

export function generateMasterAssuranceSetId(
  projectId: string,
  assuranceSets: AssuranceSet[],
): string {
  const suffix = projectId.replace(/^MAP-PROJ-/, 'P-');
  let candidate = `AS-${suffix}-MASTER`;
  if (!assuranceSets.some((s) => s.id === candidate)) return candidate;

  let seq = 1;
  while (assuranceSets.some((s) => s.id === `${candidate}-${seq}`)) {
    seq += 1;
  }
  return `${candidate}-${seq}`;
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
