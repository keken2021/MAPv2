/*
  file summary: rules for recording a verification: how it was done, and what must pass before Verify is offered.
  responsibilities: lists the verification methods, holds the OCR threshold, and returns the reasons Verify is blocked for a document.
  role in system: used by DocumentReviewDrawer.tsx and useMapStore.ts (verifyDocument); gap review findings E6 and G1.
*/

import type { MasterDocument } from '../types/document';
import type { AssuranceSet, VerificationMethod } from '../types/assurance';
import { getValidityInContractPeriod } from './expiryPolicy';

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

/* the extracted fields a check can belong to */
export type FieldCheckKey = 'certificateNo' | 'vesselName' | 'imoNumber' | 'issuingAuthority' | 'expiryDate';

/* info: shown for context, never blocks (a field no rule checks) */
export type FieldCheckState = 'pass' | 'warn' | 'fail' | 'not_checked' | 'info';

export interface FieldCheck {
  state: FieldCheckState;
  message: string;
}

/* names of the fields in a block reason */
const FIELD_CHECK_LABELS: Record<FieldCheckKey, string> = {
  certificateNo: 'Certificate No.',
  vesselName: 'Vessel Name',
  imoNumber: 'IMO Number',
  issuingAuthority: 'Issuing Authority',
  expiryDate: 'Expiry Date',
};

export type FieldCheckDocument = Pick<
  MasterDocument,
  'certificateNo' | 'expiryDate' | 'validationRules' | 'vesselAttributes' | 'crewAttributes'
>;

/**
  what: one check result for each extracted field a check belongs to; inputs are the document, the set it is reviewed on, and today.
  how: certificate no. must be present; vessel name and IMO follow the asset match; issuing authority follows the recognised-authority rule (crew: no rule, so not checked); expiry is judged against the set's contract period, or against today without a set. A lapsed or missing expiry fails; an expiry inside the period or within the warning period warns.
  with what file: src/utils/verificationPolicy.ts, used by DocumentReviewDrawer.tsx and getVerifyBlockReasons.
*/
export function getFieldChecks(
  document: FieldCheckDocument,
  set?: Pick<AssuranceSet, 'charterWindowEnd'>,
  today: Date = new Date(),
): Partial<Record<FieldCheckKey, FieldCheck>> {
  const rules = document.validationRules;
  const notChecked = Boolean(rules?.rulesNotChecked);
  const checks: Partial<Record<FieldCheckKey, FieldCheck>> = {};
  /* each message says what is wrong and what the reviewer or submitter can do about it */
  const NOT_CHECKED =
    rules?.exceptionDetails && notChecked
      ? rules.exceptionDetails
      : 'Not checked yet. Upload a new version to run the checks, or override with a reason.';

  /* the current version's expiry comes first; the certificate details can hold an older one */
  const expiryDate = document.expiryDate || document.crewAttributes?.expiryDate || document.vesselAttributes?.expiryDate;
  const validity = getValidityInContractPeriod(expiryDate, set ?? { charterWindowEnd: '' }, today);
  checks.expiryDate =
    validity.state === 'unknown'
      ? { state: 'fail', message: 'Expiry date missing. Enter it (Edit Fields) or upload a clearer scan.' }
      : validity.state === 'lapsed'
        ? { state: 'fail', message: `Lapsed on ${expiryDate}. Upload a renewed certificate.` }
        : validity.state === 'expires_in_period'
          ? { state: 'warn', message: 'Expires during the contract period. The client decides whether to accept it.' }
          : validity.state === 'expiring_soon'
            ? { state: 'warn', message: `${validity.label}. Ask for the renewal early.` }
            : { state: 'pass', message: set ? 'Valid through the contract period.' : 'Valid.' };

  if (document.crewAttributes) {
    /* no rule checks a crew certificate's issuer; shown, never a block */
    checks.issuingAuthority = { state: 'info', message: 'No rule checks this field.' };
    return checks;
  }

  checks.certificateNo = document.certificateNo?.trim()
    ? { state: 'pass', message: 'Present.' }
    : { state: 'fail', message: 'Certificate no. missing. Enter it (Edit Fields) or upload a clearer scan.' };

  const assetMatch: FieldCheck = notChecked
    ? { state: 'not_checked', message: NOT_CHECKED }
    : document.vesselAttributes?.assetMatchFlag === false || rules?.assetMatch100Percent === false
      ? { state: 'fail', message: 'Does not match the vessel record. Check the vessel name and IMO, then upload the right certificate.' }
      : { state: 'pass', message: 'Matches the vessel record.' };
  checks.vesselName = assetMatch;
  checks.imoNumber = assetMatch;

  checks.issuingAuthority = notChecked
    ? { state: 'not_checked', message: NOT_CHECKED }
    : rules?.iacsAuthorityValid === false
      ? { state: 'fail', message: 'Not a recognised (IACS) authority. Check the issuer; override if the client accepts it.' }
      : { state: 'pass', message: 'Recognised authority.' };

  return checks;
}

export interface VerifyGateInput {
  document: FieldCheckDocument;
  /* the set the document is reviewed on; its contract period judges the expiry */
  set?: Pick<AssuranceSet, 'charterWindowEnd'>;
  overallConfidence: number;
  fullPagePassed: boolean;
  signaturePassed: boolean;
}

/**
  what: the reasons a verifier may not verify a document without an override; input is the document, its set and the drawer's quality checks.
  how: each field check that failed or was not run, named by field, then low confidence and the two page checks; a failed rule with no field to show it on is added last. The drawer shows the same field checks under each field, so the gate and the screen agree.
  with what file: src/utils/verificationPolicy.ts, used by DocumentReviewDrawer.tsx.
*/
export function getVerifyBlockReasons(input: VerifyGateInput): string[] {
  const { document, set, overallConfidence, fullPagePassed, signaturePassed } = input;
  const reasons: string[] = [];
  const fieldChecks = getFieldChecks(document, set);
  (Object.keys(FIELD_CHECK_LABELS) as FieldCheckKey[]).forEach((key) => {
    const check = fieldChecks[key];
    if (!check || check.state === 'pass' || check.state === 'warn' || check.state === 'info') return;
    /* vessel name and IMO share one asset check; name it once */
    if (key === 'imoNumber' && fieldChecks.vesselName === check) return;
    reasons.push(`${FIELD_CHECK_LABELS[key]}: ${check.message}`);
  });
  if (overallConfidence < OCR_MIN_CONFIDENCE) {
    reasons.push(
      `Extraction confidence ${overallConfidence}% is below ${OCR_MIN_CONFIDENCE}%. Correct the amber fields (Edit Fields) or upload a clearer scan.`,
    );
  }
  if (!fullPagePassed) reasons.push('Full page not captured or a required field is missing. Upload a complete, clear scan.');
  if (!signaturePassed) reasons.push('No signature or stamp found. Upload a scan that shows it.');
  const rules = document.validationRules;
  const fieldFailed = Object.values(fieldChecks).some((c) => c?.state === 'fail');
  if (rules && !rules.rulesNotChecked && !rules.overallValid && !fieldFailed) {
    reasons.push(rules.exceptionDetails || 'A validation rule failed.');
  }
  return reasons;
}
