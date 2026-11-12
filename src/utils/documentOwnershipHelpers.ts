/*
  file summary: ownership and reuse rules for library evidence (FR-16, A16).
  responsibilities: resolve which organization owns a document, whether the viewer may edit or remove it, and whether library reuse is offered on a set.
  role in system: used by DocumentDetailView, DocumentUploadModal, VersionHistoryDrawer, AssuranceDetailView, and useMapStore guards.
*/

import type { AssuranceObject, AssuranceSet, OrganizationParty } from '../types/assurance';
import type { CrewMember } from '../types/crew';
import type { MasterDocument } from '../types/document';
import type { EquipmentAsset } from '../types/equipment';
import type { VesselInformation } from '../types/vessel';
import type { UserProfile } from '../types/user';
import { orgFieldMatches } from './rbacHelpers';
import { isOwnUpload } from './uploadOwnership';

export const EVIDENCE_NOT_OWNED_EDIT =
  'You can only edit or replace evidence owned by your organization.';

export const EVIDENCE_REUSE_VENDOR_ONLY =
  'Reuse from the Document Library is available when your organization is the Vendor on this set.';

export interface DocumentOwnershipAssetContext {
  equipment?: Pick<EquipmentAsset, 'id' | 'owningOrganization' | 'parentVesselId'>[];
  crew?: Pick<CrewMember, 'id' | 'organization' | 'manningAgency' | 'currentVesselId'>[];
  assuranceObjects?: Pick<AssuranceObject, 'id' | 'type' | 'ownerOrganization'>[];
}

export type OwnershipCheckDocument = Pick<
  MasterDocument,
  'ownerOrganization' | 'vesselId' | 'versions' | 'issuingAuthority'
> & {
  targetObjectType?: MasterDocument['targetObjectType'];
  targetObjectId?: string;
};

/**
  what: the organization that owns a library document; inputs are the document, vessels, users, and optional non-vessel asset registries.
  how: prefers ownerOrganization, then referenced target object (equipment/person/activity/vessel), then vesselId registered owner / managers, then first uploader's organization.
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function getDocumentOwnerOrganization(
  document: OwnershipCheckDocument,
  vessels: Pick<VesselInformation, 'id' | 'registeredOwner' | 'technicalManager' | 'ismCompany'>[] = [],
  users: Pick<UserProfile, 'name' | 'id' | 'organization'>[] = [],
  assetContext: DocumentOwnershipAssetContext = {},
): string | undefined {
  const recorded = document.ownerOrganization?.trim();
  if (recorded) return recorded;

  if (document.targetObjectType && document.targetObjectId) {
    if (document.targetObjectType === 'equipment' && assetContext.equipment) {
      const eq = assetContext.equipment.find((e) => e.id === document.targetObjectId);
      if (eq?.owningOrganization?.trim()) return eq.owningOrganization.trim();
      if (eq?.parentVesselId) {
        const parentVessel = vessels.find((v) => v.id === eq.parentVesselId);
        if (parentVessel?.registeredOwner?.trim()) return parentVessel.registeredOwner.trim();
        if (parentVessel?.technicalManager?.trim()) return parentVessel.technicalManager.trim();
        if (parentVessel?.ismCompany?.trim()) return parentVessel.ismCompany.trim();
      }
    } else if (document.targetObjectType === 'person' && assetContext.crew) {
      const member = assetContext.crew.find((c) => c.id === document.targetObjectId);
      if (member?.organization?.trim()) return member.organization.trim();
      if (member?.manningAgency?.trim()) return member.manningAgency.trim();
      if (member?.currentVesselId) {
        const parentVessel = vessels.find((v) => v.id === member.currentVesselId);
        if (parentVessel?.registeredOwner?.trim()) return parentVessel.registeredOwner.trim();
        if (parentVessel?.technicalManager?.trim()) return parentVessel.technicalManager.trim();
        if (parentVessel?.ismCompany?.trim()) return parentVessel.ismCompany.trim();
      }
    } else if (assetContext.assuranceObjects) {
      const obj = assetContext.assuranceObjects.find((o) => o.id === document.targetObjectId);
      if (obj?.ownerOrganization?.trim()) return obj.ownerOrganization.trim();
    }
  }

  const effectiveVesselId =
    document.vesselId ||
    (document.targetObjectType === 'vessel' ? document.targetObjectId : undefined);
  if (effectiveVesselId) {
    const vessel = vessels.find((v) => v.id === effectiveVesselId);
    if (vessel?.registeredOwner?.trim()) return vessel.registeredOwner.trim();
    if (vessel?.technicalManager?.trim()) return vessel.technicalManager.trim();
    if (vessel?.ismCompany?.trim()) return vessel.ismCompany.trim();
  }

  const firstVersion = document.versions?.[0];
  if (firstVersion) {
    const user = users.find((u) => isOwnUpload(firstVersion, u));
    if (user?.organization?.trim()) return user.organization.trim();
  }

  return document.issuingAuthority?.trim() || undefined;
}

/**
  what: true when the viewer may edit or replace this evidence; requires matching the document owner organization.
  how: compares the viewer's organization to the document owner; missing owner or cross-org viewer returns false.
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function canEditOwnedEvidence(
  document: OwnershipCheckDocument,
  viewerOrganization: string | undefined,
  options: {
    persona?: string;
    vessels?: Pick<VesselInformation, 'id' | 'registeredOwner' | 'technicalManager' | 'ismCompany'>[];
    users?: Pick<UserProfile, 'name' | 'id' | 'organization'>[];
    equipment?: Pick<EquipmentAsset, 'id' | 'owningOrganization' | 'parentVesselId'>[];
    crew?: Pick<CrewMember, 'id' | 'organization' | 'manningAgency' | 'currentVesselId'>[];
    assuranceObjects?: Pick<AssuranceObject, 'id' | 'type' | 'ownerOrganization'>[];
  } = {},
): boolean {
  const owner = getDocumentOwnerOrganization(document, options.vessels, options.users, {
    equipment: options.equipment,
    crew: options.crew,
    assuranceObjects: options.assuranceObjects,
  });
  if (!owner || !viewerOrganization?.trim()) return false;
  return orgFieldMatches(viewerOrganization, owner);
}

/**
  what: true when the viewer's organization is the Vendor (responding provider) on the set.
  how: matches serviceProviderOrg / respondingParty, or a party row with group Vendor.
  with what file: src/utils/documentOwnershipHelpers.ts used for A16 library reuse.
*/
export function isViewerVendorOnSet(
  set: Pick<AssuranceSet, 'serviceProviderOrg' | 'respondingParty' | 'parties'>,
  viewerOrganization: string | undefined,
): boolean {
  if (!viewerOrganization?.trim()) return false;
  if (orgFieldMatches(viewerOrganization, set.serviceProviderOrg || '')) return true;
  if (orgFieldMatches(viewerOrganization, set.respondingParty || '')) return true;
  return (set.parties ?? []).some(
    (p) => p.group === 'Vendor' && orgFieldMatches(viewerOrganization, p.organization),
  );
}

/**
  what: true when library evidence reuse should be offered for this upload on the set.
  how: reuse is only for a Vendor on the set (including a client that is also the Vendor).
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function canOfferEvidenceReuse(
  set: Pick<AssuranceSet, 'serviceProviderOrg' | 'respondingParty' | 'parties' | 'clientOrg' | 'charterer'> | undefined,
  viewerOrganization: string | undefined,
): boolean {
  if (!set) return true;
  return isViewerVendorOnSet(set, viewerOrganization);
}

/**
  what: true when a library document may be reused onto the set (Vendor-owned evidence only).
  how: excludes documents owned by the set's Client (unless that client is also Vendor) or by a Third party.
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function isReusableLibraryDocument(
  document: Pick<MasterDocument, 'ownerOrganization' | 'vesselId' | 'versions' | 'issuingAuthority'>,
  set: Pick<AssuranceSet, 'clientOrg' | 'charterer' | 'serviceProviderOrg' | 'respondingParty' | 'parties'>,
  vessels: Pick<VesselInformation, 'id' | 'registeredOwner' | 'technicalManager' | 'ismCompany'>[] = [],
  users: Pick<UserProfile, 'name' | 'id' | 'organization'>[] = [],
): boolean {
  const owner = getDocumentOwnerOrganization(document, vessels, users);
  if (!owner) return false;

  const client = (set.clientOrg || set.charterer || '').trim();
  const viewerIsVendor = isViewerVendorOnSet(set, owner);
  if (client && orgFieldMatches(owner, client) && !viewerIsVendor) return false;

  const thirdPartyMatch = (set.parties ?? []).some(
    (p: OrganizationParty) => p.group === 'Third party' && orgFieldMatches(owner, p.organization),
  );
  if (thirdPartyMatch) return false;

  return viewerIsVendor || orgFieldMatches(owner, set.serviceProviderOrg || set.respondingParty || '');
}
