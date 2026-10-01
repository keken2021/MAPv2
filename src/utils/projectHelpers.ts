/*
  file summary: project composition helpers — rollup sync, readiness, and asset AS filtering.
  responsibilities: builds master assurance requirements, filters projects by persona, resolves eligible sets per asset.
  role in system: consumed by useMapStore and project views.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
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

export function buildMasterAssuranceRequirements(
  childSets: AssuranceSet[],
  projectName: string,
): AssuranceRequirement[] {
  const merged: AssuranceRequirement[] = [];
  const seen = new Set<string>();

  childSets.forEach((childSet) => {
    childSet.requirements.forEach((req) => {
      const key = `${childSet.id}::${req.id}::${req.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        ...req,
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
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    });
  }

  return merged;
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

export function filterProjectsForPersona(
  projects: Project[],
  persona: UserRolePersona,
  users: UserProfile[],
): Project[] {
  if (persona === 'Administrator') return projects;
  if (persona === 'C Admin') {
    const clientOrg = getClientAdminOrganization(users);
    return projects.filter(
      (p) =>
        p.operatorOrganization.toLowerCase().includes(clientOrg.toLowerCase()) ||
        p.clientOperator.toLowerCase().includes(clientOrg.toLowerCase()) ||
        p.requestingOrganization.toLowerCase().includes(clientOrg.toLowerCase()) ||
        (p.charterer && p.charterer.toLowerCase().includes(clientOrg.toLowerCase())) ||
        (p.serviceProvider && p.serviceProvider.toLowerCase().includes(clientOrg.toLowerCase())),
    );
  }
  return [];
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
