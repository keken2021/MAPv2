/*
  file summary: pure functions for reading covered objects and computing available object pools for assurance sets.
  responsibilities: extracts covered vessels, crew, equipment, and implements the Rule 8 object pool logic for project and standalone sets.
  role in system: single source of truth for covered object derivation and object pool filtering under ADR 0042.
*/

import type { AssuranceObject, AssuranceObjectType, AssuranceSet, AssuranceSubtype } from '../types/assurance';
import type { Vessel } from '../types/vessel';
import type { CrewMember } from '../types/crew';
import type { EquipmentAsset } from '../types/equipment';
import type { Project, ProjectAssetLink } from '../types/project';
import { sameOrganization } from './organizationMatch';
import { getRespondingParty, SetPartiesInput } from './setParties';
import { getAssetPeriodConflicts } from './assuranceOverlap';

export interface SetObjectsInput {
  assuranceObjects?: AssuranceObject[] | null;
  /* legacy fallbacks during migration */
  vesselId?: string;
  vesselName?: string;
  imoNumber?: string;
  crewId?: string;
  crewName?: string;
  crewIds?: string[];
  crewNames?: string[];
  equipmentId?: string;
  equipmentName?: string;
}

export interface PoolAssuranceObject extends AssuranceObject {
  disabled?: boolean;
  conflictReason?: string;
  rawAsset?: Vessel | CrewMember | EquipmentAsset | unknown;
}

export interface SetObjectPoolStoreData {
  vessels: Vessel[];
  crew?: CrewMember[];
  equipment?: EquipmentAsset[];
  storeAssuranceObjects?: AssuranceObject[];
  assuranceSets: AssuranceSet[];
}

export interface SetObjectPoolDraftInput extends SetPartiesInput, SetObjectsInput {
  id?: string;
  scopeType?: string;
  startDate?: string;
  endDate?: string;
  charterWindowStart?: string;
  charterWindowEnd?: string;
}

/**
 * Extracts the covered vessel from the assurance set's assuranceObjects list.
 * Optionally resolves the full Vessel record from the store if a vessel list is supplied.
 */
export function getSetVessel(
  set?: SetObjectsInput | null,
  vessels?: Vessel[],
): Vessel | AssuranceObject | undefined {
  if (!set) return undefined;
  let targetId = '';
  let targetName = '';

  if (Array.isArray(set.assuranceObjects)) {
    const vesselObj = set.assuranceObjects.find((o) => o.type === 'vessel');
    if (vesselObj) {
      if (vessels) {
        const matched = vessels.find((v) => v.id === vesselObj.id || v.name === vesselObj.name);
        if (matched) return matched;
      }
      return vesselObj;
    }
  }

  targetId = set.vesselId || '';
  targetName = set.vesselName || '';
  if (targetId || targetName) {
    if (vessels) {
      const matched = vessels.find((v) => v.id === targetId || v.name === targetName);
      if (matched) return matched;
    }
    return {
      id: targetId,
      name: targetName,
      type: 'vessel',
      ownerOrganization: '',
      identifier: set.imoNumber,
    };
  }
  return undefined;
}

/**
 * Extracts all covered crew members from the assurance set's assuranceObjects list.
 * Optionally resolves full CrewMember records from the store if a crew list is supplied.
 */
export function getSetCrew(
  set?: SetObjectsInput | null,
  crewList?: CrewMember[],
): Array<CrewMember | AssuranceObject> {
  if (!set) return [];
  if (Array.isArray(set.assuranceObjects)) {
    const crewObjects = set.assuranceObjects.filter(
      (o) => o.type === 'person' || o.type === 'crew',
    );
    if (crewObjects.length > 0) {
      if (!crewList) return crewObjects;
      return crewObjects.map((co) => {
        const found = crewList.find((c) => c.id === co.id || c.fullName === co.name);
        return found || co;
      });
    }
  }
  const fallbackIds = set.crewIds || (set.crewId ? [set.crewId] : []);
  const fallbackNames = set.crewNames || (set.crewName ? [set.crewName] : []);
  if (crewList && fallbackIds.length > 0) {
    return fallbackIds
      .map((id, index) => crewList.find((c) => c.id === id) || {
        id,
        name: fallbackNames[index] || id,
        type: 'person' as AssuranceObjectType,
        ownerOrganization: '',
      })
      .filter(Boolean);
  }
  return fallbackIds.map((id, index) => ({
    id,
    name: fallbackNames[index] || id,
    type: 'person' as AssuranceObjectType,
    ownerOrganization: '',
  }));
}

/**
 * Extracts covered equipment from the assurance set's assuranceObjects list.
 * Optionally resolves full EquipmentAsset records from the store if an equipment list is supplied.
 */
export function getSetEquipment(
  set?: SetObjectsInput | null,
  equipmentList?: EquipmentAsset[],
): Array<EquipmentAsset | AssuranceObject> {
  if (!set) return [];
  if (Array.isArray(set.assuranceObjects)) {
    const eqObjects = set.assuranceObjects.filter((o) => o.type === 'equipment');
    if (eqObjects.length > 0) {
      if (!equipmentList) return eqObjects;
      return eqObjects.map((eo) => {
        const found = equipmentList.find((e) => e.id === eo.id || e.name === eo.name);
        return found || eo;
      });
    }
  }
  const fallbackId = set.equipmentId;
  if (!fallbackId) return [];
  if (equipmentList) {
    const found = equipmentList.find((e) => e.id === fallbackId);
    if (found) return [found];
  }
  return [
    {
      id: fallbackId,
      name: set.equipmentName || fallbackId,
      type: 'equipment',
      ownerOrganization: '',
    },
  ];
}

/**
 * Extracts the primary vessel ID covered by the assurance set.
 */
export function getSetVesselId(set?: SetObjectsInput | null): string {
  if (!set) return '';
  if (set.vesselId) return set.vesselId;
  if (Array.isArray(set.assuranceObjects)) {
    const vesselObj = set.assuranceObjects.find((o) => o.type === 'vessel');
    if (vesselObj) return vesselObj.id;
  }
  return '';
}

/**
 * Extracts the primary vessel name covered by the assurance set.
 */
export function getSetVesselName(set?: SetObjectsInput | null): string {
  if (!set) return '';
  if (set.vesselName) return set.vesselName;
  if (Array.isArray(set.assuranceObjects)) {
    const vesselObj = set.assuranceObjects.find((o) => o.type === 'vessel');
    if (vesselObj) return vesselObj.name;
  }
  return '';
}

/**
 * Extracts the IMO number of the covered vessel.
 */
export function getSetImoNumber(set?: SetObjectsInput | null): string {
  if (!set) return '';
  if (set.imoNumber) return set.imoNumber;
  if (Array.isArray(set.assuranceObjects)) {
    const vesselObj = set.assuranceObjects.find((o) => o.type === 'vessel');
    if (vesselObj?.identifier) {
      return vesselObj.identifier.replace(/^IMO:?\s*/i, '').trim();
    }
  }
  return '';
}

/**
 * Extracts all crew member IDs covered by the assurance set.
 */
export function getSetCrewIds(set?: SetObjectsInput | null): string[] {
  if (!set) return [];
  const fallback = set.crewIds || (set.crewId ? [set.crewId] : []);
  if (fallback.length > 0) return fallback;
  if (Array.isArray(set.assuranceObjects)) {
    const crewObjects = set.assuranceObjects.filter(
      (o) => o.type === 'person' || o.type === 'crew',
    );
    if (crewObjects.length > 0) return crewObjects.map((c) => c.id);
  }
  return [];
}

/**
 * Extracts all crew member names covered by the assurance set.
 */
export function getSetCrewNames(set?: SetObjectsInput | null): string[] {
  if (!set) return [];
  const fallback = set.crewNames || (set.crewName ? [set.crewName] : []);
  if (fallback.length > 0) return fallback;
  if (Array.isArray(set.assuranceObjects)) {
    const crewObjects = set.assuranceObjects.filter(
      (o) => o.type === 'person' || o.type === 'crew',
    );
    if (crewObjects.length > 0) return crewObjects.map((c) => c.name);
  }
  return [];
}

/**
 * Extracts the primary equipment ID covered by the assurance set.
 */
export function getSetEquipmentId(set?: SetObjectsInput | null): string {
  if (!set) return '';
  if (set.equipmentId) return set.equipmentId;
  if (Array.isArray(set.assuranceObjects)) {
    const eqObj = set.assuranceObjects.find((o) => o.type === 'equipment');
    if (eqObj) return eqObj.id;
  }
  return '';
}

/**
 * Extracts the primary equipment name covered by the assurance set.
 */
export function getSetEquipmentName(set?: SetObjectsInput | null): string {
  if (!set) return '';
  if (set.equipmentName) return set.equipmentName;
  if (Array.isArray(set.assuranceObjects)) {
    const eqObj = set.assuranceObjects.find((o) => o.type === 'equipment');
    if (eqObj) return eqObj.name;
  }
  return '';
}

/**
 * Returns the operational scopes for an assurance set (defaults to ['Vessel']).
 */
export function getAssuranceSetScopes(set?: Pick<AssuranceSet, 'assuranceType' | 'subtypes'> | null): AssuranceSubtype[] {
  if (!set) return ['Vessel'];
  if (set.subtypes && set.subtypes.length > 0) return set.subtypes;
  if (set.assuranceType) return [set.assuranceType];
  return ['Vessel'];
}

export function isVesselOwnedByOrg(
  vessel: { registeredOwner?: string; technicalManager?: string; ismCompany?: string } | undefined,
  org: string,
): boolean {
  if (!vessel || !org.trim()) return false;
  const orgLower = org.toLowerCase();
  return [vessel.registeredOwner, vessel.technicalManager, vessel.ismCompany].some((field) => {
    if (!field) return false;
    const fieldLower = field.toLowerCase();
    return fieldLower.includes(orgLower) || orgLower.includes(fieldLower);
  });
}

function mapAssetTypeToAssuranceObjectType(assetType: string): AssuranceObjectType {
  const lower = assetType.toLowerCase();
  if (lower === 'vessel') return 'vessel';
  if (lower === 'crew' || lower === 'person') return 'person';
  if (lower === 'equipment') return 'equipment';
  if (lower === 'activity') return 'activity';
  return 'vessel';
}

function mapAssetTypeToSubtype(assetType: string): 'Vessel' | 'Crew' | 'Equipment' {
  const lower = assetType.toLowerCase();
  if (lower === 'crew' || lower === 'person') return 'Crew';
  if (lower === 'equipment') return 'Equipment';
  return 'Vessel';
}

/**
 * Returns the pool of assurance objects available to be covered by an assurance set.
 * Enforces Rule 8:
 * - Project set: strictly roster entries (project.assetLinks) where providerOrganization is the Responding party, one row per asset.
 * - Set without project: Responding party's own vessels, crew, equipment and activities, with the Under Charter rule.
 * - Both: runs period conflict check; booked assets stay listed with disabled: true and conflictReason.
 */
export function getSetObjectPool(
  setOrDraft: SetObjectPoolDraftInput | null | undefined,
  project: Pick<Project, 'assetLinks'> | null | undefined,
  storeData: SetObjectPoolStoreData,
): PoolAssuranceObject[] {
  const respondingParty = getRespondingParty(setOrDraft)?.trim() || '';
  const startDate = setOrDraft?.startDate || setOrDraft?.charterWindowStart || '';
  const endDate = setOrDraft?.endDate || setOrDraft?.charterWindowEnd || '';
  const excludeId = setOrDraft?.id;

  const result: PoolAssuranceObject[] = [];
  const seen = new Set<string>();

  if (project && project.assetLinks) {
    // Rule 8a: Project set - strictly roster entries where providerOrganization is Responding party
    if (!respondingParty) return [];

    const matchingLinks: ProjectAssetLink[] = [];
    for (const link of project.assetLinks) {
      if (!sameOrganization(link.providerOrganization, respondingParty)) continue;
      const key = `${link.assetType}:${link.assetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matchingLinks.push(link);
    }

    for (const link of matchingLinks) {
      const objType = mapAssetTypeToAssuranceObjectType(link.assetType);
      const subType = mapAssetTypeToSubtype(link.assetType);
      let conflictReason: string | undefined;

      if (startDate && endDate) {
        const conflicts = getAssetPeriodConflicts(
          subType,
          link.assetId,
          startDate,
          endDate,
          storeData.assuranceSets,
          excludeId,
        );
        if (conflicts.length > 0) {
          conflictReason = `Asset has ${conflicts.length} overlapping contract period(s).`;
        }
      }

      result.push({
        id: link.assetId,
        name: link.assetName,
        type: objType,
        ownerOrganization: link.providerOrganization,
        disabled: Boolean(conflictReason),
        conflictReason,
      });
    }

    // Own crew of the Responding party (not on the external roster) is also offered
    for (const c of storeData.crew || []) {
      if (!c.organization || !sameOrganization(c.organization, respondingParty)) continue;
      if (seen.has(`Crew:${c.id}`)) continue;
      seen.add(`Crew:${c.id}`);
      let conflictReason: string | undefined;
      if (startDate && endDate) {
        const conflicts = getAssetPeriodConflicts('Crew', c.id, startDate, endDate, storeData.assuranceSets, excludeId);
        if (conflicts.length > 0) conflictReason = `Crew member has ${conflicts.length} overlapping contract period(s).`;
      }
      result.push({
        id: c.id,
        name: c.fullName,
        type: 'person',
        ownerOrganization: respondingParty,
        identifier: c.rank,
        disabled: Boolean(conflictReason),
        conflictReason,
        rawAsset: c,
      });
    }

    // Own equipment of the Responding party (not on the external roster) is also offered
    for (const e of storeData.equipment || []) {
      if (!sameOrganization(e.owningOrganization, respondingParty)) continue;
      if (seen.has(`Equipment:${e.id}`)) continue;
      seen.add(`Equipment:${e.id}`);
      let conflictReason: string | undefined;
      if (startDate && endDate) {
        const conflicts = getAssetPeriodConflicts('Equipment', e.id, startDate, endDate, storeData.assuranceSets, excludeId);
        if (conflicts.length > 0) conflictReason = `Equipment has ${conflicts.length} overlapping contract period(s).`;
      }
      result.push({
        id: e.id,
        name: e.name,
        type: 'equipment',
        ownerOrganization: respondingParty,
        identifier: e.equipmentIdentifier,
        disabled: Boolean(conflictReason),
        conflictReason,
        rawAsset: e,
      });
    }

    return result;
  }

  // Rule 8b: Standalone set without project - Responding party's own fleet and assets
  if (!respondingParty) return [];

  // Vessels owned by Responding party with Under Charter rule
  for (const v of storeData.vessels) {
    if (!isVesselOwnedByOrg(v, respondingParty)) continue;
    // Under Charter rule: booked/chartered vessel
    const isUnderCharter = v.status === 'Under Charter';
    let conflictReason: string | undefined;
    if (isUnderCharter) {
      conflictReason = 'Vessel is currently Under Charter.';
    } else if (startDate && endDate) {
      const conflicts = getAssetPeriodConflicts(
        'Vessel',
        v.id,
        startDate,
        endDate,
        storeData.assuranceSets,
        excludeId,
      );
      if (conflicts.length > 0) {
        conflictReason = `Vessel has ${conflicts.length} overlapping contract period(s).`;
      }
    }

    result.push({
      id: v.id,
      name: v.name,
      type: 'vessel',
      ownerOrganization: respondingParty,
      identifier: v.imoNumber,
      disabled: Boolean(conflictReason),
      conflictReason,
      rawAsset: v,
    });
  }

  // Crew owned by Responding party
  if (storeData.crew) {
    for (const c of storeData.crew) {
      const belongs = c.organization && sameOrganization(c.organization, respondingParty);
      if (!belongs) continue;
      let conflictReason: string | undefined;
      if (startDate && endDate) {
        const conflicts = getAssetPeriodConflicts(
          'Crew',
          c.id,
          startDate,
          endDate,
          storeData.assuranceSets,
          excludeId,
        );
        if (conflicts.length > 0) {
          conflictReason = `Crew member has ${conflicts.length} overlapping contract period(s).`;
        }
      }
      result.push({
        id: c.id,
        name: c.fullName,
        type: 'person',
        ownerOrganization: respondingParty,
        identifier: c.rank,
        disabled: Boolean(conflictReason),
        conflictReason,
        rawAsset: c,
      });
    }
  }

  // Equipment owned by Responding party
  if (storeData.equipment) {
    for (const e of storeData.equipment) {
      if (!sameOrganization(e.owningOrganization, respondingParty)) continue;
      let conflictReason: string | undefined;
      if (startDate && endDate) {
        const conflicts = getAssetPeriodConflicts(
          'Equipment',
          e.id,
          startDate,
          endDate,
          storeData.assuranceSets,
          excludeId,
        );
        if (conflicts.length > 0) {
          conflictReason = `Equipment has ${conflicts.length} overlapping contract period(s).`;
        }
      }
      result.push({
        id: e.id,
        name: e.name,
        type: 'equipment',
        ownerOrganization: respondingParty,
        identifier: e.equipmentIdentifier,
        disabled: Boolean(conflictReason),
        conflictReason,
        rawAsset: e,
      });
    }
  }

  // Activities owned by Responding party
  if (storeData.storeAssuranceObjects) {
    for (const o of storeData.storeAssuranceObjects) {
      if (o.type === 'activity' && sameOrganization(o.ownerOrganization, respondingParty)) {
        result.push({
          ...o,
          disabled: false,
        });
      }
    }
  }

  return result;
}
