/*
  file summary: document version snapshots on assurance set requirements.
  responsibilities: freezes the exact document version a requirement was verified against, locks every linked version when a set is approved, and gives the detail view and review drawer a version-pinned copy of a library document.
  role in system: used by useMapStore.ts (verify, approve, new version, seed data), AssuranceDetailView.tsx and DocumentReviewDrawer.tsx; a later version or a review on another set never changes an approved set.
*/

import {
  AssuranceRequirement,
  AssuranceSet,
  ObjectVerification,
  ObjectVerificationChannel,
  RequirementVersionSnapshot,
} from '../types/assurance';
import { MasterDocument } from '../types/document';
import { getAssuranceSetObjects } from './assuranceTemplates';

/* a finished set stays approved when a later set reuses one of its library documents */
export function isClosedAssuranceSet(set: Pick<AssuranceSet, 'stage' | 'approverDecision'>): boolean {
  return set.approverDecision === 'Approved' || set.stage === 'Approved' || set.stage === 'Certified';
}

/* the library document a requirement points at, by documentId or linkedDocumentId */
export function findRequirementDocument(
  req: Pick<AssuranceRequirement, 'documentId' | 'linkedDocumentId'>,
  documents: MasterDocument[],
): MasterDocument | undefined {
  return documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
}

/**
  what: a frozen copy of a document's current version; inputs are the document, when it was verified and by whom.
  how: copies the current version label, the file name and upload date of that version, the expiry date and the review status.
  with what file: src/utils/documentVersionSnapshot.ts used by useMapStore.ts.
*/
export function takeVersionSnapshot(
  doc: MasterDocument,
  verifiedAt: string,
  verifiedBy?: string,
  verificationStatus: RequirementVersionSnapshot['verificationStatus'] = 'Verified',
): RequirementVersionSnapshot {
  const version = doc.versions.find((v) => v.versionLabel === doc.currentVersion) || doc.versions[0];
  return {
    documentId: doc.id,
    versionLabel: doc.currentVersion,
    fileName: version?.fileName || '',
    uploadedAt: version?.uploadedAt || '',
    verifiedAt,
    verifiedBy,
    verificationStatus,
    expiryDate: doc.expiryDate,
  };
}

/**
  what: the version fields of a requirement after a review; inputs are the requirement as reviewed, its set before the review, the document and the reviewer.
  how: a Verified requirement records the document's current version, except on a closed set that already holds a snapshot, which keeps it; any other status drops the snapshot.
  with what file: src/utils/documentVersionSnapshot.ts used by verifyDocument and updateRequirementStatus in useMapStore.ts.
*/
export function stampReviewedVersion(
  req: AssuranceRequirement,
  set: Pick<AssuranceSet, 'stage' | 'approverDecision'>,
  doc: MasterDocument | undefined,
  verifiedAt: string,
  verifiedBy?: string,
): AssuranceRequirement {
  const reqWithDecision: AssuranceRequirement = {
    ...req,
    decisionTime: req.decisionTime || verifiedAt,
  };
  if (req.verifierStatus !== 'Verified') return { ...reqWithDecision, verifiedVersion: undefined };
  if (isClosedAssuranceSet(set) && req.verifiedVersion) return reqWithDecision;
  if (!doc) return reqWithDecision;
  return {
    ...reqWithDecision,
    documentVersion: doc.currentVersion,
    verifiedVersion: {
      ...takeVersionSnapshot(doc, verifiedAt, verifiedBy),
      decisionTime: verifiedAt,
      attemptNumber: req.attemptNumber,
    },
  };
}

/**
  what: a set with its document versions locked when it is closed, or unlocked when it is open; inputs are the set, the library and the time.
  how: a closed set gets lockedAt once and a snapshot on every linked requirement that has none (from the document's current version); an open set loses lockedAt but keeps its per-requirement snapshots.
  with what file: src/utils/documentVersionSnapshot.ts used by useMapStore.ts after a review or an approval decision.
*/
export function syncDocumentVersionLock<T extends AssuranceSet>(set: T, documents: MasterDocument[], now: string): T {
  if (!isClosedAssuranceSet(set)) {
    return set.lockedAt ? { ...set, lockedAt: undefined } : set;
  }
  let changed = !set.lockedAt;
  const requirements = set.requirements.map((r) => {
    if (r.verifiedVersion) return r;
    const doc = findRequirementDocument(r, documents);
    if (!doc) return r;
    changed = true;
    return {
      ...r,
      documentVersion: doc.currentVersion,
      verifiedVersion: takeVersionSnapshot(doc, now, undefined, r.verifierStatus),
    };
  });
  if (!changed) return set;
  return { ...set, requirements, lockedAt: set.lockedAt || now };
}

/**
  what: seed sets with the versions of their closed sets locked; inputs are the seed sets and the seed library.
  how: locks each closed set as of the newest upload among its linked versions, so the seed date is stable between runs.
  with what file: src/utils/documentVersionSnapshot.ts used by the initial state of useMapStore.ts.
*/
export function freezeClosedSetDocuments<T extends AssuranceSet>(sets: T[], documents: MasterDocument[]): T[] {
  return sets.map((set) => {
    if (!isClosedAssuranceSet(set) || set.lockedAt) return set;
    const uploads = set.requirements
      .map((r) => findRequirementDocument(r, documents))
      .flatMap((doc) => (doc ? [doc.versions.find((v) => v.versionLabel === doc.currentVersion)?.uploadedAt || ''] : []))
      .filter(Boolean)
      .sort();
    const lockDate = uploads[uploads.length - 1] || set.charterWindowStart;
    return syncDocumentVersionLock(set, documents, lockDate);
  });
}

export interface RequirementDocumentView {
  /** the document as this set shows it: pinned to the snapshot on a closed set, live otherwise */
  doc: MasterDocument;
  /** true when the set is closed and the version is frozen */
  isLocked: boolean;
  snapshot?: RequirementVersionSnapshot;
  /** label of a newer library version that this closed set does not take, if any */
  newerVersionLabel?: string;
}

/**
  what: the document a requirement row and the review drawer show; inputs are the set, the requirement and the live library document.
  how: on a closed set the document is pinned to the requirement's snapshot (or its recorded documentVersion): currentVersion, status and expiry come from the snapshot and later versions are left out, as in DocumentDetailView's version view; on an open set the live document is returned.
  with what file: src/utils/documentVersionSnapshot.ts used by AssuranceDetailView.tsx.
*/
export function getRequirementDocumentView(
  set: Pick<AssuranceSet, 'stage' | 'approverDecision'>,
  req: Pick<AssuranceRequirement, 'verifiedVersion' | 'documentVersion'>,
  doc: MasterDocument,
): RequirementDocumentView {
  if (!isClosedAssuranceSet(set)) return { doc, isLocked: false };
  const snapshot = req.verifiedVersion;
  const label = snapshot?.versionLabel || req.documentVersion;
  if (!label) return { doc, isLocked: false };

  const index = doc.versions.findIndex((v) => v.versionLabel === label);
  const pinned: MasterDocument = {
    ...doc,
    currentVersion: label,
    /* versions are newest first: the pinned one and the ones before it */
    versions: index >= 0 ? doc.versions.slice(index) : doc.versions,
    verificationStatus: snapshot?.verificationStatus || doc.verificationStatus,
    expiryDate: snapshot?.expiryDate || doc.expiryDate,
  };
  return {
    doc: pinned,
    isLocked: true,
    snapshot,
    newerVersionLabel: doc.currentVersion !== label ? doc.currentVersion : undefined,
  };
}

const sameOrganization = (left?: string, right?: string) => {
  if (!left?.trim() || !right?.trim()) return false;
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};

const clientOf = (set: Pick<AssuranceSet, 'clientOrg' | 'charterer'>) =>
  (set.clientOrg || set.charterer || '').trim();

const organizationInLabel = (label?: string) => {
  const match = label?.match(/\(([^)]+)\)\s*$/);
  return match?.[1]?.trim();
};

/**
  what: internal when the client checked its own set, external when another organization did.
  how: an internal review mode, an internal deployment, or a verifier from the client organization is internal.
  with what file: src/utils/documentVersionSnapshot.ts used by deriveObjectVerification.
*/
export function objectVerificationChannel(
  set: Pick<AssuranceSet, 'clientOrg' | 'charterer' | 'reviewMode' | 'internalDeployment' | 'assignedVerifier' | 'stakeholders'>,
): ObjectVerificationChannel {
  const client = clientOf(set);
  const verifierOrg = set.stakeholders?.verifierOrg || organizationInLabel(set.assignedVerifier);
  if (set.reviewMode === 'internal' || set.internalDeployment) return 'internal';
  if (verifierOrg && sameOrganization(verifierOrg, client)) return 'internal';
  return 'external';
}

/**
  what: client organizations whose sets link a document.
  how: reads documentId and linkedDocumentId on each set's requirements.
  with what file: src/utils/documentVersionSnapshot.ts used by rbacHelpers.ts.
*/
export function documentClientOrganizations(
  documentId: string,
  sets: Pick<AssuranceSet, 'clientOrg' | 'charterer' | 'requirements'>[],
): string[] {
  const organizations = new Set<string>();
  for (const set of sets) {
    const linked = set.requirements?.some(
      (requirement) => requirement.documentId === documentId || requirement.linkedDocumentId === documentId,
    );
    if (!linked) continue;
    const client = clientOf(set);
    if (client) organizations.add(client);
  }
  return [...organizations];
}

/**
  what: the verification one organization can see for an assurance object.
  how: uses that organization's own sets for who, when and internal or external, then raises the status when another organization has also tested the object. The other organization's name and documents are not included.
  with what file: src/utils/documentVersionSnapshot.ts used by the object list, VerifierWorkspaceView.tsx and ApproverDashboardView.tsx.
*/
export function deriveObjectVerification(
  objectId: string,
  sets: AssuranceSet[],
  viewerOrganization: string,
): ObjectVerification | null {
  if (!objectId || !viewerOrganization.trim()) return null;
  const covering = sets.filter((set) => getAssuranceSetObjects(set).some((object) => object.id === objectId));
  if (covering.length === 0) return null;

  const testedClients = new Set<string>();
  for (const set of covering) {
    const tested = set.requirements?.some((requirement) => requirement.verifierStatus === 'Verified');
    const client = clientOf(set);
    if (tested && client) testedClients.add(client.toLowerCase());
  }

  const ownSets = covering.filter((set) => sameOrganization(clientOf(set), viewerOrganization));
  if (ownSets.length === 0) return null;

  const testedSets = ownSets.filter((set) => set.requirements?.some((requirement) => requirement.verifierStatus === 'Verified'));
  const uploaded = ownSets.some((set) =>
    set.requirements?.some((requirement) => requirement.documentId || requirement.linkedDocumentId),
  );
  const externalSet = testedSets.find((set) => objectVerificationChannel(set) === 'external');
  const internalSet = testedSets.find((set) => objectVerificationChannel(set) === 'internal');
  const chosen = externalSet || internalSet;
  const channel = chosen ? objectVerificationChannel(chosen) : undefined;

  let status: ObjectVerification['status'] = 'Uploaded, not externally verified';
  if (chosen && testedClients.size >= 2) status = 'Used and tested by several entities over time';
  else if (externalSet) status = 'Tested externally';
  else if (internalSet) status = 'Submitted and tested';
  else if (!uploaded && testedSets.length === 0) status = 'Uploaded, not externally verified';

  const snapshot = chosen?.requirements?.find((requirement) => requirement.verifiedVersion?.verifiedAt)?.verifiedVersion;
  return {
    status,
    channel,
    verifiedBy: snapshot?.verifiedBy || chosen?.stakeholders?.verifierName || chosen?.assignedVerifier,
    verifiedAt: snapshot?.verifiedAt || chosen?.sentForReviewAt || chosen?.lockedAt,
    clientOrganization: clientOf(ownSets[0]),
  };
}
