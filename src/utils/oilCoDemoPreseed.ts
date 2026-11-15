/*
  file summary: Oil Co demo helpers for AS-04 / AS-05 template walkthroughs.
  responsibilities: marks which template slots stay open for live upload, and auto-verifies
  pre-seeded uploads when the set enters Verification so the verifier only reviews the live uploads.
  role in system: used by CreateAssuranceSetView at create time and useMapStore on stage transition.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { recalculateSetReadiness } from './projectHelpers';

export const DEMO_PRESEED_TEMPLATE_IDS = [
  'tmpl-pub-ss04-bunkering',
  'tmpl-pub-ss05-control-systems',
] as const;

/** first N template documents stay awaiting upload; the rest start as Submitted */
export const DEMO_OPEN_UPLOAD_COUNT = 3;

export function isDemoPreseedTemplate(templateId: string | undefined | null): boolean {
  return Boolean(
    templateId &&
      (DEMO_PRESEED_TEMPLATE_IDS as readonly string[]).includes(templateId),
  );
}

/** true when this template slot should stay empty for the submitter to upload */
export function isDemoOpenUploadSlot(templatePosition: number): boolean {
  return templatePosition >= 0 && templatePosition < DEMO_OPEN_UPLOAD_COUNT;
}

/**
  what: marks demo pre-seeded uploads Verified when submission finishes (stage enters Verification).
  how: only requirements flagged demoPreseeded that are still Pending are flipped; live uploads stay Pending.
*/
export function autoVerifyDemoPreseededRequirements(
  set: AssuranceSet,
  documents: MasterDocument[],
): { set: AssuranceSet; documents: MasterDocument[] } {
  const preseededDocIds = new Set<string>();
  const reviewedAt = new Date().toISOString();
  const requirements: AssuranceRequirement[] = set.requirements.map((req) => {
    if (!req.demoPreseeded || req.verifierStatus === 'Verified' || !req.documentId) {
      return req;
    }
    preseededDocIds.add(req.documentId);
    return {
      ...req,
      verifierStatus: 'Verified',
      isFulfilled: true,
      ocrConfidence: req.ocrConfidence || 96,
      decisionTime: reviewedAt,
      notes: req.notes || 'Demo pre-seeded upload, auto-verified when submission completed',
    };
  });

  if (preseededDocIds.size === 0) {
    return { set, documents };
  }

  const nextDocuments = documents.map((doc) =>
    preseededDocIds.has(doc.id)
      ? { ...doc, verificationStatus: 'Verified' as const }
      : doc,
  );

  return {
    set: recalculateSetReadiness({ ...set, requirements }),
    documents: nextDocuments,
  };
}
