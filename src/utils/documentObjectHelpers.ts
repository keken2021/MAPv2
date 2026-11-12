/*
  file summary: pure helpers for resolving referenced assurance objects on documents, checking per-object unique titles, and computing next version labels.
  responsibilities: resolves a document's referenced object (vessel, person, equipment, activity), lists org-scoped uploadable target objects, detects same-object duplicate titles (without blocking cross-object titles), and derives next version labels.
  role in system: consumed by useMapStore.ts, DocumentUploadModal.tsx, DocumentObjectReferenceFields.tsx, DocumentTable.tsx, DocumentDetailView.tsx, and asset detail views.
*/

import type { AssuranceObject, AssuranceObjectType, AssuranceSet } from '../types/assurance';
import type { UserRolePersona } from '../types/audit';
import type { CrewMember } from '../types/crew';
import type { DocumentEntityType, DocumentVersion, MasterDocument } from '../types/document';
import type { EquipmentAsset } from '../types/equipment';
import type { UserProfile } from '../types/user';
import type { VesselInformation } from '../types/vessel';
import { getAssuranceSetObjects } from './assuranceTemplates';
import { isCrewOwnedByOrganization, isEquipmentOwnedByOrganization } from './projectHelpers';
import { isAssuranceSetAssignedToPersona, isVesselOwnedByClientOrg, orgFieldMatches } from './rbacHelpers';

export interface DocumentTargetObject {
  type: AssuranceObjectType;
  id: string;
  name: string;
  identifier?: string;
  ownerOrganization?: string;
  parentVesselId?: string;
  subtitle?: string;
}

export interface DocumentObjectLookupContext {
  vessels?: Pick<
    VesselInformation,
    'id' | 'name' | 'imoNumber' | 'registeredOwner' | 'technicalManager' | 'ismCompany'
  >[];
  crew?: Pick<
    CrewMember,
    | 'id'
    | 'fullName'
    | 'rank'
    | 'organization'
    | 'manningAgency'
    | 'currentVesselId'
    | 'layer1CoreDocuments'
    | 'layer2Endorsements'
  >[];
  equipment?: Pick<
    EquipmentAsset,
    'id' | 'name' | 'equipmentIdentifier' | 'category' | 'owningOrganization' | 'parentVesselId'
  >[];
  assuranceObjects?: Pick<
    AssuranceObject,
    'id' | 'type' | 'name' | 'identifier' | 'ownerOrganization'
  >[];
  assuranceSets?: Pick<
    AssuranceSet,
    | 'id'
    | 'vesselId'
    | 'vesselName'
    | 'crewId'
    | 'crewName'
    | 'crewIds'
    | 'equipmentId'
    | 'equipmentName'
    | 'assuranceObjects'
    | 'requirements'
    | 'clientOrg'
    | 'serviceProviderOrg'
    | 'initiatorOrg'
  >[];
}

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  vessel: 'Vessel',
  person: 'Crew',
  equipment: 'Equipment',
  activity: 'Activity',
};

export function getObjectTypeLabel(type?: AssuranceObjectType): string {
  if (!type) return 'Unassigned';
  return OBJECT_TYPE_LABELS[type] || String(type);
}

export function getEntityTypeForObjectType(objectType?: AssuranceObjectType): DocumentEntityType {
  if (objectType === 'person') return 'Crew Certificate';
  if (objectType === 'equipment') return 'Equipment Certificate';
  if (objectType === 'activity') return 'Project Dossier';
  return 'Vessel Certificate';
}

/** Canonical case-insensitive single-space normalized title for unique-per-object comparison. */
export function normalizeDocumentTitle(title: string | undefined): string {
  return (title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Strips an optional trailing crew member suffix (" — Capt. Name" or " - Capt. Name") when comparing documents on the same person object. */
export function normalizeTitleForObjectComparison(
  title: string | undefined,
  objectType?: AssuranceObjectType,
  objectName?: string,
): string {
  const normalized = normalizeDocumentTitle(title);
  if (!normalized || objectType !== 'person' || !objectName) return normalized;
  const normName = normalizeDocumentTitle(objectName);
  if (!normName) return normalized;
  for (const sep of [' — ', ' - ', ' – ']) {
    const suffix = `${sep}${normName}`;
    if (normalized.endsWith(suffix)) {
      return normalized.slice(0, normalized.length - suffix.length).trim();
    }
  }
  return normalized;
}

/** Next version label after existing versions (e.g. ['v1.0'] -> 'v1.1'). */
export function getNextVersionLabel(
  versions?: Pick<DocumentVersion, 'versionLabel'>[],
  currentVersion?: string,
): string {
  const labels = [
    ...(versions ?? []).map((v) => v.versionLabel),
    ...(currentVersion ? [currentVersion] : []),
  ];
  let highestMinor = -1;
  for (const label of labels) {
    const match = /^v1\.(\d+)$/i.exec((label || '').trim());
    if (match) {
      const minor = Number(match[1]);
      if (!Number.isNaN(minor) && minor > highestMinor) {
        highestMinor = minor;
      }
    }
  }
  const countBased = versions?.length ?? 0;
  const nextMinor = Math.max(countBased, highestMinor >= 0 ? highestMinor + 1 : 1);
  return `v1.${nextMinor}`;
}

function containsWholeToken(haystackLower: string, token: string | undefined): boolean {
  const trimmed = (token || '').trim().toLowerCase();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return pattern.test(haystackLower);
}

function resolveObjectByTypeAndId(
  type: AssuranceObjectType,
  id: string,
  fallbackName: string | undefined,
  context: DocumentObjectLookupContext,
): DocumentTargetObject {
  const vessels = context.vessels ?? [];
  const crew = context.crew ?? [];
  const equipment = context.equipment ?? [];
  const assuranceObjects = context.assuranceObjects ?? [];

  if (type === 'vessel') {
    const v = vessels.find((item) => item.id === id);
    if (v) {
      return {
        type: 'vessel',
        id: v.id,
        name: v.name,
        identifier: v.imoNumber ? `IMO ${v.imoNumber}` : undefined,
        ownerOrganization: v.registeredOwner || v.technicalManager || v.ismCompany,
      };
    }
  } else if (type === 'person') {
    const c = crew.find((item) => item.id === id);
    if (c) {
      return {
        type: 'person',
        id: c.id,
        name: c.fullName,
        identifier: c.rank,
        ownerOrganization: c.organization || c.manningAgency,
        parentVesselId: c.currentVesselId,
      };
    }
  } else if (type === 'equipment') {
    const e = equipment.find((item) => item.id === id);
    if (e) {
      return {
        type: 'equipment',
        id: e.id,
        name: e.name,
        identifier: e.equipmentIdentifier,
        ownerOrganization: e.owningOrganization,
        parentVesselId: e.parentVesselId,
      };
    }
  }

  const obj = assuranceObjects.find((item) => item.id === id);
  if (obj) {
    return {
      type: obj.type || type,
      id: obj.id,
      name: obj.name,
      identifier: obj.identifier,
      ownerOrganization: obj.ownerOrganization,
    };
  }

  return {
    type,
    id,
    name: fallbackName || id,
  };
}

/**
  what: resolves the Assurance Object referenced by a document (explicit targetObject fields first, then linked requirements, crew/equipment/activity signatures, and vesselId).
  how: returns null when the document is unreferenced/unassigned in the vault so unassigned docs do not collide with real objects.
*/
export function resolveDocumentTargetObject(
  doc: Pick<
    MasterDocument,
    | 'id'
    | 'title'
    | 'entityType'
    | 'vesselId'
    | 'certificateNo'
    | 'ownerOrganization'
    | 'targetObjectType'
    | 'targetObjectId'
    | 'targetObjectName'
    | 'vesselAttributes'
    | 'crewAttributes'
  >,
  context: DocumentObjectLookupContext = {},
): DocumentTargetObject | null {
  const vessels = context.vessels ?? [];
  const crew = context.crew ?? [];
  const equipment = context.equipment ?? [];
  const assuranceObjects = context.assuranceObjects ?? [];
  const assuranceSets = context.assuranceSets ?? [];

  if (doc.targetObjectType && doc.targetObjectId) {
    return resolveObjectByTypeAndId(
      doc.targetObjectType,
      doc.targetObjectId,
      doc.targetObjectName ||
        doc.vesselAttributes?.vesselName ||
        doc.crewAttributes?.crewName ||
        doc.targetObjectId,
      context,
    );
  }

  // Linked assurance requirement targetObjectId
  for (const set of assuranceSets) {
    const req = set.requirements?.find(
      (r) => r.documentId === doc.id || r.linkedDocumentId === doc.id,
    );
    if (req?.targetObjectId) {
      const setObj = getAssuranceSetObjects(set as AssuranceSet).find(
        (o) => o.id === req.targetObjectId,
      );
      if (setObj) {
        return resolveObjectByTypeAndId(setObj.type, setObj.id, setObj.name, context);
      }
      const catalogObj = assuranceObjects.find((o) => o.id === req.targetObjectId);
      if (catalogObj) {
        return resolveObjectByTypeAndId(catalogObj.type, catalogObj.id, catalogObj.name, context);
      }
    }
  }

  // Crew / person resolution
  if (doc.entityType === 'Crew Certificate' || Boolean(doc.crewAttributes)) {
    const crewMatch = crew.find(
      (c) =>
        (doc.targetObjectId && c.id === doc.targetObjectId) ||
        (doc.crewAttributes?.crewName &&
          c.fullName.trim().toLowerCase() === doc.crewAttributes.crewName.trim().toLowerCase()) ||
        c.layer1CoreDocuments?.some((d) => d.id === doc.id) ||
        c.layer2Endorsements?.some((d) => d.id === doc.id),
    );
    if (crewMatch) {
      return {
        type: 'person',
        id: crewMatch.id,
        name: crewMatch.fullName,
        identifier: crewMatch.rank,
        ownerOrganization: crewMatch.organization || crewMatch.manningAgency,
        parentVesselId: crewMatch.currentVesselId,
      };
    }
    if (doc.targetObjectId || doc.crewAttributes?.crewName) {
      return {
        type: 'person',
        id: doc.targetObjectId || `person:${normalizeDocumentTitle(doc.crewAttributes?.crewName)}`,
        name: doc.crewAttributes?.crewName || doc.targetObjectName || doc.targetObjectId || 'Crew',
        identifier: doc.crewAttributes?.rank,
      };
    }
  }

  // Equipment resolution before vesselId fallback (seeded equipment certs carry parent vesselId)
  const haystack = `${doc.id} ${doc.title} ${doc.certificateNo}`.toLowerCase();
  if (doc.entityType === 'Equipment Certificate' || equipment.length > 0) {
    const eqMatch = equipment.find(
      (e) =>
        (doc.targetObjectId && e.id === doc.targetObjectId) ||
        containsWholeToken(haystack, e.id) ||
        containsWholeToken(haystack, e.equipmentIdentifier),
    );
    if (eqMatch) {
      return {
        type: 'equipment',
        id: eqMatch.id,
        name: eqMatch.name,
        identifier: eqMatch.equipmentIdentifier,
        ownerOrganization: eqMatch.owningOrganization,
        parentVesselId: eqMatch.parentVesselId,
      };
    }
    if (doc.entityType === 'Equipment Certificate' && doc.targetObjectId) {
      return {
        type: 'equipment',
        id: doc.targetObjectId,
        name: doc.targetObjectName || doc.targetObjectId,
      };
    }
  }

  // Activity resolution before vesselId fallback (seeded activity docs carry vesselId: 'VESSEL-001')
  const activities = assuranceObjects.filter((o) => o.type === 'activity');
  if (doc.entityType === 'Project Dossier' || doc.id.startsWith('MAP-ACT-') || activities.length > 0) {
    const actMatch = activities.find(
      (a) =>
        (doc.targetObjectId && a.id === doc.targetObjectId) ||
        containsWholeToken(haystack, a.id) ||
        (a.identifier && containsWholeToken(haystack, a.identifier)) ||
        (doc.id.startsWith('MAP-ACT-') && a.name && doc.title.toLowerCase().includes(a.name.toLowerCase())),
    );
    if (actMatch) {
      return {
        type: 'activity',
        id: actMatch.id,
        name: actMatch.name,
        identifier: actMatch.identifier,
        ownerOrganization: actMatch.ownerOrganization,
      };
    }
    if (doc.targetObjectId && doc.entityType === 'Project Dossier') {
      return {
        type: 'activity',
        id: doc.targetObjectId,
        name: doc.targetObjectName || doc.targetObjectId,
      };
    }
  }

  // Vessel resolution when explicitly linked by vesselId or targetObjectId
  if (doc.vesselId) {
    return resolveObjectByTypeAndId(
      'vessel',
      doc.vesselId,
      doc.targetObjectName || doc.vesselAttributes?.vesselName || doc.vesselId,
      context,
    );
  }

  return null;
}

/** Concise plain-text object label for tables & metadata rows (no badge clutter). */
export function formatDocumentTargetObjectLabel(
  doc: Parameters<typeof resolveDocumentTargetObject>[0],
  context: DocumentObjectLookupContext = {},
): string {
  const target = resolveDocumentTargetObject(doc, context);
  if (!target) return doc.entityType;
  return `${getObjectTypeLabel(target.type)}: ${target.name}`;
}

/**
  what: returns all Assurance Objects that the viewer (Administrator or Submitter) may reference when uploading a document.
  how: includes objects owned by viewerOrg across vessel, person, equipment, and activity plus any objects on sets assigned to the active user.
*/
export function getUploadableTargetObjects(
  persona: UserRolePersona,
  viewerOrg: string | undefined,
  state: {
    vessels: VesselInformation[];
    crew: CrewMember[];
    equipment: EquipmentAsset[];
    assuranceObjects: AssuranceObject[];
    assuranceSets: AssuranceSet[];
    sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> & {
      status?: UserProfile['status'];
    } | null;
    users?: UserProfile[];
  },
): DocumentTargetObject[] {
  if (persona !== 'Administrator' && persona !== 'Submitter') return [];
  const org = viewerOrg?.trim() || state.sessionUser?.organization?.trim() || '';

  const byKey = new Map<string, DocumentTargetObject>();
  const addTarget = (target: DocumentTargetObject) => {
    const key = `${target.type}:${target.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, target);
    }
  };

  // Objects covered on assurance sets assigned to this user
  if (state.sessionUser) {
    const assignedSets = state.assuranceSets.filter((set) =>
      isAssuranceSetAssignedToPersona(set, persona, org || undefined, state.sessionUser, state.users),
    );
    assignedSets.forEach((set) => {
      getAssuranceSetObjects(set).forEach((obj) => {
        const resolved = resolveObjectByTypeAndId(obj.type, obj.id, obj.name, state);
        addTarget({
          ...resolved,
          subtitle: resolved.identifier || OBJECT_TYPE_LABELS[resolved.type] || String(resolved.type),
        });
      });
    });
  }

  // Objects owned/managed by viewerOrg (vessels, crew, equipment, activities)
  if (org) {
    state.vessels.forEach((vessel) => {
      if (isVesselOwnedByClientOrg(vessel, org)) {
        addTarget({
          type: 'vessel',
          id: vessel.id,
          name: vessel.name,
          identifier: vessel.imoNumber ? `IMO ${vessel.imoNumber}` : undefined,
          ownerOrganization: vessel.registeredOwner || vessel.technicalManager || vessel.ismCompany,
          subtitle: vessel.imoNumber ? `IMO ${vessel.imoNumber}` : vessel.vesselType,
        });
      }
    });

    state.crew.forEach((member) => {
      const parentVessel = member.currentVesselId
        ? state.vessels.find((v) => v.id === member.currentVesselId)
        : undefined;
      const ownedViaCrew = isCrewOwnedByOrganization(member, org);
      const ownedViaVessel = Boolean(parentVessel && isVesselOwnedByClientOrg(parentVessel, org));
      if (ownedViaCrew || ownedViaVessel) {
        addTarget({
          type: 'person',
          id: member.id,
          name: member.fullName,
          identifier: member.rank,
          ownerOrganization: member.organization || member.manningAgency || org,
          parentVesselId: member.currentVesselId,
          subtitle: member.rank,
        });
      }
    });

    state.equipment.forEach((item) => {
      const parentVessel = item.parentVesselId
        ? state.vessels.find((v) => v.id === item.parentVesselId)
        : undefined;
      const ownedDirect = isEquipmentOwnedByOrganization(item, org);
      const ownedViaVessel = Boolean(parentVessel && isVesselOwnedByClientOrg(parentVessel, org));
      if (ownedDirect || ownedViaVessel) {
        addTarget({
          type: 'equipment',
          id: item.id,
          name: item.name,
          identifier: item.equipmentIdentifier,
          ownerOrganization: item.owningOrganization,
          parentVesselId: item.parentVesselId,
          subtitle: item.equipmentIdentifier,
        });
      }
    });

    state.assuranceObjects.forEach((obj) => {
      if (obj.ownerOrganization && orgFieldMatches(org, obj.ownerOrganization)) {
        const resolved = resolveObjectByTypeAndId(obj.type, obj.id, obj.name, state);
        addTarget({
          ...resolved,
          subtitle: resolved.identifier || OBJECT_TYPE_LABELS[resolved.type] || String(resolved.type),
        });
      }
    });
  }

  return Array.from(byKey.values());
}

export interface DuplicateObjectDocumentMatch {
  id: string;
  title: string;
  source: 'document' | 'crew';
  document?: MasterDocument;
}

/**
  what: detects whether a new document title already exists on the exact same referenced Assurance Object.
  how: compares normalized titles strictly within the same { type, id } object (allowing identical titles across different objects).
*/
export function findDuplicateObjectDocumentTitle(
  documents: MasterDocument[],
  targetObject: Pick<DocumentTargetObject, 'type' | 'id'> & { name?: string },
  title: string,
  context: DocumentObjectLookupContext & { excludeDocId?: string } = {},
): DuplicateObjectDocumentMatch | null {
  if (!targetObject.id) return null;
  const candidateTitle = normalizeTitleForObjectComparison(
    title,
    targetObject.type,
    targetObject.name,
  );
  if (!candidateTitle) return null;

  for (const doc of documents) {
    if (context.excludeDocId && doc.id === context.excludeDocId) continue;
    const resolved = resolveDocumentTargetObject(doc, context);
    if (!resolved) continue;
    if (resolved.type !== targetObject.type || resolved.id !== targetObject.id) continue;
    const existingNorm = normalizeTitleForObjectComparison(
      doc.title,
      resolved.type,
      resolved.name,
    );
    if (existingNorm === candidateTitle) {
      return {
        id: doc.id,
        title: doc.title,
        source: 'document',
        document: doc,
      };
    }
  }

  if (targetObject.type === 'person' && context.crew) {
    const member = context.crew.find((c) => c.id === targetObject.id);
    if (member) {
      const crewCerts = [
        ...(member.layer1CoreDocuments ?? []),
        ...(member.layer2Endorsements ?? []),
      ];
      for (const cert of crewCerts) {
        if (context.excludeDocId && cert.id === context.excludeDocId) continue;
        const existingNorm = normalizeTitleForObjectComparison(
          cert.title,
          'person',
          member.fullName,
        );
        if (existingNorm === candidateTitle) {
          return {
            id: cert.id,
            title: cert.title,
            source: 'crew',
          };
        }
      }
    }
  }

  return null;
}

