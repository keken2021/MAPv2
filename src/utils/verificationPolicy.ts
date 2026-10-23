/*
  file summary: rules for recording a verification: how it was done, and what must pass before Verify is offered.
  responsibilities: lists the verification methods, holds the OCR threshold, and returns the reasons Verify is blocked for a document.
  role in system: used by DocumentReviewDrawer.tsx and useMapStore.ts (verifyDocument); gap review findings E6 and G1.
*/

import type { MasterDocument } from '../types/document';
import type { VerificationMethod } from '../types/assurance';

/* the methods a verifier chooses from, in the order shown (paper Table 3) */
export const VERIFICATION_METHODS: readonly VerificationMethod[] = [
  'Issuer lookup',
  'Direct link',
  'Manual review',
  'Client-provided copy',
];

/* minimum overall extraction confidence before Verify is offered without an override; pending supervisor Q25 */
export const OCR_MIN_CONFIDENCE = 90;

/* shown wherever a verification is recorded (paper P3, P4, P9) */
export const VERIFICATION_SCOPE_STATEMENT =
  'MAP records who checked this document, how and when. It does not confirm the certificate with its issuer.';

export interface VerifyGateInput {
  document: Pick<MasterDocument, 'validationRules' | 'vesselAttributes' | 'crewAttributes'>;
  overallConfidence: number;
  fullPagePassed: boolean;
  signaturePassed: boolean;
}

/**
  what: the reasons a verifier may not verify a document without an override; input is the document and the drawer's quality checks.
  how: collects a reason for low confidence, each failed quality check, rules not yet checked, a failed rule and an asset mismatch.
  with what file: src/utils/verificationPolicy.ts, used by DocumentReviewDrawer.tsx.
*/
export function getVerifyBlockReasons(input: VerifyGateInput): string[] {
  const { document, overallConfidence, fullPagePassed, signaturePassed } = input;
  const reasons: string[] = [];
  if (overallConfidence < OCR_MIN_CONFIDENCE) {
    reasons.push(`Extraction confidence ${overallConfidence}% is below ${OCR_MIN_CONFIDENCE}%.`);
  }
  if (!fullPagePassed) reasons.push('Full page not captured.');
  if (!signaturePassed) reasons.push('No signature or stamp found.');
  const rules = document.validationRules;
  if (rules?.rulesNotChecked) {
    reasons.push('Validation rules have not been checked.');
  } else if (rules && !rules.overallValid) {
    reasons.push(rules.exceptionDetails || 'A validation rule failed.');
  }
  if (document.vesselAttributes && document.vesselAttributes.assetMatchFlag === false) {
    reasons.push('Vessel name or IMO does not match the asset.');
  }
  return reasons;
}
