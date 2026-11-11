/*
  file summary: ownership and reuse rules for library evidence (FR-16, A16).
  responsibilities: resolve which organization owns a document, whether the viewer may edit or remove it, and whether library reuse is offered on a set.
  role in system: used by DocumentDetailView, DocumentUploadModal, VersionHistoryDrawer, AssuranceDetailView, and useMapStore guards.
*/

import type { AssuranceSet, OrganizationParty } from '../types/assurance';
import type { MasterDocument } from '../types/document';
import type { VesselInformation } from '../types/vessel';
import type { UserProfile } from '../types/user';
import { orgFieldMatches } from './rbacHelpers';

export const EVIDENCE_NOT_OWNED_EDIT =
  'You can only edit or replace evidence owned by your organization.';

export const EVIDENCE_REUSE_VENDOR_ONLY =
  'Reuse from the Document Library is available when your organization is the Vendor on this set.';

/**
  what: the organization that owns a library document; inputs are the document, vessels and optional users.
  how: prefers ownerOrganization, then the vessel's registered owner / managers, then the first uploader's organization.
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function getDocumentOwnerOrganization(
  document: Pick<MasterDocument, 'ownerOrganization' | 'vesselId' | 'versions' | 'issuingAuthority'>,
  vessels: Pick<VesselInformation, 'id' | 'registeredOwner' | 'technicalManager' | 'ismCompany'>[] = [],
  users: Pick<UserProfile, 'name' | 'id' | 'organization'>[] = [],
): string | undefined {
  const recorded = document.ownerOrganization?.trim();
  if (recorded) return recorded;

  if (document.vesselId) {
    const vessel = vessels.find((v) => v.id === document.vesselId);
    if (vessel?.registeredOwner?.trim()) return vessel.registeredOwner.trim();
    if (vessel?.technicalManager?.trim()) return vessel.technicalManager.trim();
    if (vessel?.ismCompany?.trim()) return vessel.ismCompany.trim();
  }

  const uploader = document.versions?.[0]?.uploadedBy?.trim();
  if (uploader) {
    const user = users.find(
      (u) => u.id === uploader || orgFieldMatches(u.name, uploader) || u.name === uploader,
    );
    if (user?.organization?.trim()) return user.organization.trim();
  }

  return document.issuingAuthority?.trim() || undefined;
}

/**
  what: true when the viewer may edit or replace this evidence; Administrators always may.
  how: compares the viewer's organization to the document owner; missing owner blocks non-admins.
  with what file: src/utils/documentOwnershipHelpers.ts.
*/
export function canEditOwnedEvidence(
  document: Pick<MasterDocument, 'ownerOrganization' | 'vesselId' | 'versions' | 'issuingAuthority'>,
  viewerOrganization: string | undefined,
  options: {
    persona?: string;
    vessels?: Pick<VesselInformation, 'id' | 'registeredOwner' | 'technicalManager' | 'ismCompany'>[];
    users?: Pick<UserProfile, 'name' | 'id' | 'organization'>[];
  } = {},
): boolean {
  if (options.persona === 'Administrator') return true;
  const owner = getDocumentOwnerOrganization(document, options.vessels, options.users);
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
