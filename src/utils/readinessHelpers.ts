/* 
  file summary: centralized compliance readiness calculation helpers for documents, assurance sets, and vessels.
  responsibilities: computes dynamic stage-weighted readiness indices (initiated: 10%, submitted: 40%, verified: 70%, approved: 100%) and aggregates average compliance scores.
  role in system: consumed by useMapStore, VesselTable, AssuranceTable, DashboardView, VesselDetailView, and AssuranceDetailView.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { VesselInformation } from '../types/vessel';

/**
  dynamic stage percentage weights as specified in compliance calculation rules:
  - initiated = 10%
  - submitted = 40%
  - verified = 70%
  - approved = 100%
*/
export const STAGE_READINESS_WEIGHTS = {
  initiated: 10,
  submitted: 40,
  verified: 70,
  approved: 100,
} as const;

/**
  what: calculates the dynamic readiness score (0-100%) for an individual assurance requirement document.
  how: checks approval, verification, submission, or initial status and returns the corresponding stage weight.
  with what file: src/utils/readinessHelpers.ts consumed by assurance and vessel calculation routines.
*/
export function getRequirementReadinessPercentage(
  req: AssuranceRequirement,
  parentSet?: Partial<AssuranceSet>,
): number {
  const hasUploadedDoc = Boolean(req.documentId) || Boolean(req.linkedDocumentId);

  /* if no document is uploaded/attached and requirement is not fulfilled, it remains in initiated state (10%) and can never be 100% */
  if (!hasUploadedDoc && !req.isFulfilled) {
    return STAGE_READINESS_WEIGHTS.initiated; /* 10% */
  }

  /* check if requirement is fully approved via campaign sign-off or certified stage */
  const isParentApproved =
    parentSet?.stage === 'Certified' ||
    parentSet?.stage === 'Approved' ||
    parentSet?.approverDecision === 'Approved' ||
    (parentSet?.formalApprovalRequired === false &&
      (req.verifierStatus === 'Verified' || req.isFulfilled || parentSet?.verificationRequired === false) &&
      (!parentSet?.mandatoryInspectionRequired || parentSet?.inspectionCompleted));

  if (isParentApproved && (hasUploadedDoc || req.isFulfilled)) {
    return STAGE_READINESS_WEIGHTS.approved; /* 100% */
  }

  /* check if verification is bypassed in workflow policy and document is present */
  if (parentSet?.verificationRequired === false && hasUploadedDoc) {
    return STAGE_READINESS_WEIGHTS.verified; /* 70% */
  }

  /* check if requirement is verified by verifier */
  if (req.verifierStatus === 'Verified' || req.isFulfilled) {
    return STAGE_READINESS_WEIGHTS.verified; /* 70% */
  }

  /* check if requirement document is uploaded / submitted for verification */
  const isCampaignSubmitted = parentSet?.stage && parentSet.stage !== 'Initiated';

  if (
    hasUploadedDoc ||
    req.verifierStatus === 'Correction Requested' ||
    (req.verifierStatus === 'Pending' && isCampaignSubmitted)
  ) {
    return STAGE_READINESS_WEIGHTS.submitted; /* 40% */
  }

  /* initiated / default requirement state (no document uploaded yet in initial setup) */
  return STAGE_READINESS_WEIGHTS.initiated; /* 10% */
}

/**
  what: calculates the dynamic readiness score (0-100%) for an individual master document in the document library.
  how: checks verification status and version history to determine if document is verified (70%), submitted (40%), or initiated (10%).
  with what file: src/utils/readinessHelpers.ts consumed by document vault and compliance metrics.
*/
export function calculateDocumentReadiness(doc: MasterDocument): number {
  if (doc.verificationStatus === 'Verified') {
    return STAGE_READINESS_WEIGHTS.verified; /* 70% */
  }

  if (
    doc.verificationStatus === 'Pending' ||
    (doc.versions && doc.versions.length > 0)
  ) {
    return STAGE_READINESS_WEIGHTS.submitted; /* 40% */
  }

  return STAGE_READINESS_WEIGHTS.initiated; /* 10% */
}

/**
  what: calculates the overall readiness score for an assurance set based on the average calculation of all its requirement documents and workflow policies.
  how: sums requirement stage weights and divides by total requirement count, rounding to nearest whole integer.
  with what file: src/utils/readinessHelpers.ts consumed by store and views.
*/
export function calculateAssuranceSetReadiness(set: AssuranceSet): number {
  if (!set.requirements || set.requirements.length === 0) {
    if (set.stage === 'Certified' || set.stage === 'Approved' || set.stage === 'Approval') return STAGE_READINESS_WEIGHTS.approved;
    if (set.stage === 'Verification' || set.stage === 'Inspection') return STAGE_READINESS_WEIGHTS.verified;
    if (set.stage === 'Validation') return STAGE_READINESS_WEIGHTS.submitted;
    return STAGE_READINESS_WEIGHTS.initiated;
  }

  const uploadedCount = set.requirements.filter((r) => Boolean(r.documentId || r.linkedDocumentId || r.isFulfilled)).length;

  /* if there are no uploaded documents for any requirement, readiness will never be 100% and stays at initiated 10% */
  if (uploadedCount === 0) {
    return STAGE_READINESS_WEIGHTS.initiated; /* 10% */
  }

  if (
    (set.stage === 'Certified' || set.stage === 'Approved' || set.approverDecision === 'Approved') &&
    uploadedCount === set.requirements.length
  ) {
    return STAGE_READINESS_WEIGHTS.approved; /* 100% */
  }

  const allReqsReady = set.requirements.every(
    (r) => (Boolean(r.documentId || r.linkedDocumentId) || r.isFulfilled) &&
      (r.isFulfilled || r.verifierStatus === 'Verified' || set.verificationRequired === false)
  );

  /* if formal approval is disabled and all requirements and mandatory inspections are fulfilled with uploaded docs, return 100% */
  if (set.formalApprovalRequired === false && allReqsReady && (!set.mandatoryInspectionRequired || set.inspectionCompleted)) {
    return STAGE_READINESS_WEIGHTS.approved;
  }

  const totalScore = set.requirements.reduce(
    (sum, req) => sum + getRequirementReadinessPercentage(req, set),
    0
  );

  const calculatedAvg = Math.round(totalScore / set.requirements.length);

  /* if any requirement lacks an uploaded document, ensure readiness never reaches 100% */
  if (uploadedCount < set.requirements.length && calculatedAvg >= 100) {
    return 95;
  }

  return calculatedAvg;
}

/**
  what: calculates the dynamic fleet compliance readiness score for a vessel based on all linked assurance sets and statutory documents.
  how: aggregates document and requirement scores linked to the vessel and computes the average score.
  with what file: src/utils/readinessHelpers.ts consumed by FleetRegistryView, VesselTable, and DashboardView.
*/
export function calculateVesselReadiness(
  vessel: VesselInformation,
  assuranceSets: AssuranceSet[] = [],
  documents: MasterDocument[] = [],
): number {
  /* find assurance sets linked to this vessel */
  const linkedSets = assuranceSets.filter(
    (s) => s.vesselId === vessel.id || (vessel.name && s.vesselName?.toLowerCase() === vessel.name.toLowerCase())
  );

  if (linkedSets.length > 0) {
    const totalSetScore = linkedSets.reduce(
      (sum, s) => sum + calculateAssuranceSetReadiness(s),
      0
    );
    return Math.round(totalSetScore / linkedSets.length);
  }

  /* fallback: calculate average based on standalone documents linked to vessel */
  const linkedDocs = documents.filter(
    (d) => d.vesselId === vessel.id || (vessel.imoNumber && d.vesselAttributes?.imoNumber === vessel.imoNumber)
  );

  if (linkedDocs.length > 0) {
    const totalDocScore = linkedDocs.reduce(
      (sum, d) => sum + calculateDocumentReadiness(d),
      0
    );
    return Math.round(totalDocScore / linkedDocs.length);
  }

  /* fallback: check statutory certificates on vessel record */
  if (vessel.statutoryCertificates && vessel.statutoryCertificates.length > 0) {
    const certScores = vessel.statutoryCertificates.map((cert) => {
      if (cert.status === 'Valid') return STAGE_READINESS_WEIGHTS.approved;
      if (cert.status === 'Expiring Soon') return STAGE_READINESS_WEIGHTS.verified;
      return STAGE_READINESS_WEIGHTS.submitted;
    });
    return Math.round(certScores.reduce((sum, s) => sum + s, 0) / certScores.length);
  }

  return vessel.complianceReadinessScore || STAGE_READINESS_WEIGHTS.initiated;
}

/**
  what: checks whether a vessel has reached 100% assurance readiness or holds an approved assurance set.
  how: examines linked assurance sets for approved/certified stages or 100% calculated readiness scores.
  with what file: src/utils/readinessHelpers.ts consumed by VesselDetailView, VesselModal, and VesselTable.
*/
export function isVesselAssuranceApproved(
  vessel: VesselInformation,
  assuranceSets: AssuranceSet[] = [],
  documents: MasterDocument[] = [],
): boolean {
  /* find linked assurance sets for this vessel */
  const linkedSets = assuranceSets.filter(
    (s) => s.vesselId === vessel.id || (vessel.name && s.vesselName?.toLowerCase() === vessel.name.toLowerCase())
  );

  if (linkedSets.length > 0) {
    return linkedSets.some(
      (s) =>
        s.stage === 'Approved' ||
        s.stage === 'Certified' ||
        s.approverDecision === 'Approved' ||
        calculateAssuranceSetReadiness(s) >= 100
    );
  }

  /* fallback: if no assurance sets exist, check calculated vessel readiness */
  return calculateVesselReadiness(vessel, assuranceSets, documents) >= 100;
}

/**
  what: validates if a target vessel operating or transit status is permitted based on assurance readiness approval gating.
  how: prevents 'Under Charter', 'In Operations', and 'In Transit' unless the vessel is 100% ready or approved.
  with what file: src/utils/readinessHelpers.ts consumed by VesselDetailView and VesselModal.
*/
export function isVesselStatusPermitted(
  status: import('../types/vessel').VesselRegistrationStatus,
  vessel: VesselInformation,
  assuranceSets: AssuranceSet[] = [],
  documents: MasterDocument[] = [],
): { isPermitted: boolean; reason?: string } {
  const isRestrictedStatus =
    status === 'Under Charter' ||
    status === 'In Operations' ||
    status === 'In Transit' ||
    status === 'In-Transit';
  if (!isRestrictedStatus) {
    return { isPermitted: true };
  }

  const isApproved = isVesselAssuranceApproved(vessel, assuranceSets, documents);
  if (!isApproved) {
    return {
      isPermitted: false,
      reason: `Cannot set status to ${status}: Vessel assurance set readiness is not 100% ready or approved.`,
    };
  }

  return { isPermitted: true };
}
