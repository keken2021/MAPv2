/*
  file summary: project composition helpers — rollup sync, readiness, and asset AS filtering.
  responsibilities: builds master assurance requirements, filters projects by persona, resolves eligible sets per asset.
  role in system: consumed by useMapStore and project views.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { Project, ProjectAssetLink } from '../types/project';
import { UserProfile } from '../types/user';
import { calculateAssuranceSetReadiness } from './readinessHelpers';
import { getClientAdminOrganization } from './rbacHelpers';

export function getEligibleAssuranceSetsForAsset(
  assetType: ProjectAssetLink['assetType'],
  assetId: string,
  assuranceSets: AssuranceSet[],
): AssuranceSet[] {
  return assuranceSets.filter((set) => {
    if (set.isProjectMaster) return false;
    if (assetType === 'Vessel') return set.vesselId === assetId;
    if (assetType === 'Crew') return set.crewId === assetId;
    if (assetType === 'Equipment') return set.equipmentId === assetId;
    if (assetType === 'Activity') return set.activityId === assetId;
    return false;
  });
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
        p.charterer.toLowerCase().includes(clientOrg.toLowerCase()),
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
