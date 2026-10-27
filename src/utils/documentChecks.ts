/*
  file summary: the validation rules a document gets when it is uploaded or replaced.
  responsibilities: compares the vessel name and IMO read from the document with the vessel record, and the issuing authority with the IACS member list, then records the result on the document's rules.
  role in system: used by useMapStore.ts (addDocument, uploadDocumentForRequirement, addDocumentVersion); the review drawer reads the result through verificationPolicy.ts.
*/

import type { MasterDocument, ValidationRuleStatus } from '../types/document';
import type { VesselInformation } from '../types/vessel';
import { validateImoNumber } from './validation';

/* why the checks could not run on a vessel certificate */
export const NO_VESSEL_RECORD = 'Not checked: the document is not linked to a vessel record. Link it to its vessel, or override with a reason.';

/* IACS members by full name and abbreviation; an authority matches when it names one of them */
const IACS_MEMBERS: string[][] = [
  ['american bureau of shipping', 'abs'],
  ['bureau veritas', 'bv'],
  ['china classification society', 'ccs'],
  ['croatian register of shipping', 'crs'],
  ['dnv', 'det norske veritas'],
  ['indian register of shipping', 'irs'],
  ['korean register', 'kr'],
  ["lloyd's register", 'lloyds register', 'lr'],
  ['nippon kaiji kyokai', 'classnk', 'nk'],
  ['polish register of shipping', 'prs'],
  ['rina', 'registro italiano navale'],
  ['turk loydu', 'türk loydu', 'tl'],
];

/* lower case, apostrophes and punctuation as spaces, single spaces */
function normalise(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'ü ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* digits of an IMO number, without an "IMO" prefix or spaces */
function imoDigits(value: string | undefined): string {
  return (value || '').replace(/[^0-9]/g, '');
}

/**
  what: true when an issuing authority is an IACS member; input is the authority as read from the document.
  how: matches a member's full name anywhere in the text, or an abbreviation as a whole word.
  with what file: src/utils/documentChecks.ts used by runDocumentChecks.
*/
export function isIacsAuthority(authority: string | undefined): boolean {
  const text = ` ${normalise(authority)} `;
  if (!text.trim()) return false;
  return IACS_MEMBERS.some((names) =>
    names.some((name) => (name.length <= 3 ? text.includes(` ${name} `) : text.includes(name))),
  );
}

/**
  what: the validation rules of a document after its checks run; inputs are the document and the vessel registry.
  how: asset match compares the vessel name and IMO read from the document with the vessel record of doc.vesselId (no record: not checked);
    the authority must be an IACS member; overall valid when both pass and the buffer rule has not failed. Crew certificates keep their rules, with rulesNotChecked cleared, as no crew rule exists.
  with what file: src/utils/documentChecks.ts used by useMapStore.ts.
*/
export function runDocumentChecks(
  doc: Pick<MasterDocument, 'vesselId' | 'issuingAuthority' | 'vesselAttributes' | 'crewAttributes' | 'validationRules'>,
  vessels: Pick<VesselInformation, 'id' | 'name' | 'imoNumber'>[],
): ValidationRuleStatus {
  const previous = doc.validationRules;
  if (doc.crewAttributes || !doc.vesselAttributes) {
    return { ...previous, rulesNotChecked: false };
  }

  const vessel = vessels.find((v) => v.id === doc.vesselId);
  if (!vessel) {
    /* without a vessel record there is nothing to match against; the reason tells the reviewer what to fix */
    return { ...previous, rulesNotChecked: true, exceptionDetails: NO_VESSEL_RECORD };
  }

  const nameMatches = normalise(doc.vesselAttributes.vesselName) === normalise(vessel.name);
  const docImo = imoDigits(doc.vesselAttributes.imoNumber);
  const vesselImo = imoDigits(vessel.imoNumber);
  const imoCheckDigitValid = validateImoNumber(docImo);
  const imoMatches = docImo !== '' && docImo === vesselImo && imoCheckDigitValid;
  const assetMatch100Percent = nameMatches && imoMatches;
  const iacsAuthorityValid = isIacsAuthority(doc.issuingAuthority || doc.vesselAttributes.issuingBody);
  const charterBufferPassed = previous?.charterBufferPassed ?? true;

  return {
    charterBufferPassed,
    assetMatch100Percent,
    iacsAuthorityValid,
    overallValid: assetMatch100Percent && iacsAuthorityValid,
    exceptionDetails: undefined,
    rulesNotChecked: false,
  };
}

/**
  what: a document with its checks run; inputs are the document and the vessel registry.
  how: replaces the rules with runDocumentChecks and keeps the asset match flag in step with them.
  with what file: src/utils/documentChecks.ts used by useMapStore.ts.
*/
export function withDocumentChecks<T extends MasterDocument>(doc: T, vessels: Pick<VesselInformation, 'id' | 'name' | 'imoNumber'>[]): T {
  const validationRules = runDocumentChecks(doc, vessels);
  return {
    ...doc,
    validationRules,
    vesselAttributes:
      doc.vesselAttributes && !validationRules.rulesNotChecked
        ? { ...doc.vesselAttributes, assetMatchFlag: validationRules.assetMatch100Percent }
        : doc.vesselAttributes,
  };
}

export interface CrossCertificateCheckResult {
  checkId: 'gt_consistency' | 'smc_doc_company_match' | 'smc_doc_validity_bound';
  label: string;
  state: 'pass' | 'fail' | 'warn' | 'not_applicable';
  message: string;
  details?: string;
}

/**
 * Cross-certificate consistency checks (gap review R2-G2, R2-S7).
 * Top 3 cheapest automated checks:
 * 1. Gross Tonnage (GT) Consistency: printed GT matches registered vessel GT
 * 2. DOC & SMC Company Match: ISM Company on SMC matches company on DOC
 * 3. SMC Validity Bound: SMC expiry <= parent DOC expiry
 */
export function runCrossCertificateChecks(
  doc: MasterDocument,
  allDocuments: MasterDocument[],
  vessels: Pick<VesselInformation, 'id' | 'name' | 'imoNumber' | 'grossTonnageGT' | 'ismCompany' | 'docNumber'>[],
): CrossCertificateCheckResult[] {
  const results: CrossCertificateCheckResult[] = [];
  const vessel = vessels.find((v) => v.id === doc.vesselId);
  const isVesselDoc = Boolean(doc.vesselAttributes || doc.entityType === 'Vessel Certificate');

  // Check 1: Gross Tonnage (GT) Consistency
  const printedGt = doc.grossTonnagePrinted ?? doc.vesselAttributes?.grossTonnagePrinted;
  if (!isVesselDoc || printedGt == null) {
    results.push({
      checkId: 'gt_consistency',
      label: 'Gross Tonnage (GT) Consistency',
      state: 'not_applicable',
      message: 'Gross tonnage not printed on this certificate.',
    });
  } else if (!vessel || vessel.grossTonnageGT == null) {
    results.push({
      checkId: 'gt_consistency',
      label: 'Gross Tonnage (GT) Consistency',
      state: 'warn',
      message: 'Vessel gross tonnage record is not available for comparison.',
    });
  } else if (printedGt === vessel.grossTonnageGT) {
    results.push({
      checkId: 'gt_consistency',
      label: 'Gross Tonnage (GT) Consistency',
      state: 'pass',
      message: `Printed GT (${printedGt.toLocaleString()}) matches vessel registry GT.`,
    });
  } else {
    results.push({
      checkId: 'gt_consistency',
      label: 'Gross Tonnage (GT) Consistency',
      state: 'fail',
      message: `Printed GT (${printedGt.toLocaleString()}) does not match vessel registry GT (${vessel.grossTonnageGT.toLocaleString()}).`,
      details: 'Check if vessel was modified or if wrong certificate was uploaded.',
    });
  }

  // Identify whether this doc is SMC or DOC
  const titleNorm = (doc.title + ' ' + (doc.vesselAttributes?.certType || '')).toLowerCase();
  const isSmc = titleNorm.includes('safety management certificate') || titleNorm.includes('smc');
  const isDoc = titleNorm.includes('document of compliance') || titleNorm.includes('doc');

  const companionDocs = allDocuments.filter((d) => d.vesselId === doc.vesselId && d.id !== doc.id);

  // Check 2: DOC & SMC Company Match
  if (!isSmc && !isDoc) {
    results.push({
      checkId: 'smc_doc_company_match',
      label: 'DOC & SMC Company Match',
      state: 'not_applicable',
      message: 'Applies to Safety Management Certificate (SMC) and Document of Compliance (DOC).',
    });
  } else if (isSmc) {
    // Find parent DOC
    const parentDoc = companionDocs.find((d) => {
      const t = (d.title + ' ' + (d.vesselAttributes?.certType || '')).toLowerCase();
      return t.includes('document of compliance') || t.includes('doc');
    });

    const smcCompanyImo = doc.companyImoNumber || doc.vesselAttributes?.companyImoNumber;

    if (!parentDoc) {
      if (vessel?.ismCompany) {
        results.push({
          checkId: 'smc_doc_company_match',
          label: 'DOC & SMC Company Match',
          state: 'warn',
          message: `Parent DOC not on file. SMC company compared against vessel record (${vessel.ismCompany}).`,
        });
      } else {
        results.push({
          checkId: 'smc_doc_company_match',
          label: 'DOC & SMC Company Match',
          state: 'warn',
          message: 'Parent Document of Compliance (DOC) not found in vessel document register.',
        });
      }
    } else {
      const docCompanyImo = parentDoc.companyImoNumber || parentDoc.vesselAttributes?.companyImoNumber;
      if (smcCompanyImo && docCompanyImo) {
        if (smcCompanyImo === docCompanyImo) {
          results.push({
            checkId: 'smc_doc_company_match',
            label: 'DOC & SMC Company Match',
            state: 'pass',
            message: `ISM Company IMO (${smcCompanyImo}) matches parent Document of Compliance.`,
          });
        } else {
          results.push({
            checkId: 'smc_doc_company_match',
            label: 'DOC & SMC Company Match',
            state: 'fail',
            message: `ISM Company IMO (${smcCompanyImo}) does not match parent DOC (${docCompanyImo}).`,
          });
        }
      } else {
        results.push({
          checkId: 'smc_doc_company_match',
          label: 'DOC & SMC Company Match',
          state: 'pass',
          message: 'Parent Document of Compliance is present on file for this vessel.',
        });
      }
    }
  } else {
    // isDoc
    const docCompanyImo = doc.companyImoNumber || doc.vesselAttributes?.companyImoNumber;
    const companionSmc = companionDocs.find((d) => {
      const t = (d.title + ' ' + (d.vesselAttributes?.certType || '')).toLowerCase();
      return t.includes('safety management certificate') || t.includes('smc');
    });

    if (!companionSmc) {
      results.push({
        checkId: 'smc_doc_company_match',
        label: 'DOC & SMC Company Match',
        state: 'not_applicable',
        message: 'No vessel Safety Management Certificate (SMC) currently on file.',
      });
    } else {
      const smcCompanyImo = companionSmc.companyImoNumber || companionSmc.vesselAttributes?.companyImoNumber;
      if (docCompanyImo && smcCompanyImo) {
        if (docCompanyImo === smcCompanyImo) {
          results.push({
            checkId: 'smc_doc_company_match',
            label: 'DOC & SMC Company Match',
            state: 'pass',
            message: `Operating company IMO (${docCompanyImo}) matches vessel Safety Management Certificate.`,
          });
        } else {
          results.push({
            checkId: 'smc_doc_company_match',
            label: 'DOC & SMC Company Match',
            state: 'fail',
            message: `DOC Company IMO (${docCompanyImo}) does not match vessel SMC (${smcCompanyImo}).`,
          });
        }
      } else {
        results.push({
          checkId: 'smc_doc_company_match',
          label: 'DOC & SMC Company Match',
          state: 'pass',
          message: 'Vessel Safety Management Certificate is present on file.',
        });
      }
    }
  }

  // Check 3: SMC Validity Bound
  if (!isSmc && !isDoc) {
    results.push({
      checkId: 'smc_doc_validity_bound',
      label: 'SMC Validity Bound',
      state: 'not_applicable',
      message: 'Applies to Safety Management Certificate (SMC) and Document of Compliance (DOC).',
    });
  } else if (isSmc) {
    const parentDoc = companionDocs.find((d) => {
      const t = (d.title + ' ' + (d.vesselAttributes?.certType || '')).toLowerCase();
      return t.includes('document of compliance') || t.includes('doc');
    });

    if (!parentDoc || !parentDoc.expiryDate) {
      results.push({
        checkId: 'smc_doc_validity_bound',
        label: 'SMC Validity Bound',
        state: 'warn',
        message: 'Parent DOC not on file or has no expiry date; cannot verify SMC validity boundary.',
      });
    } else if (!doc.expiryDate) {
      results.push({
        checkId: 'smc_doc_validity_bound',
        label: 'SMC Validity Bound',
        state: 'warn',
        message: 'SMC has no expiry date recorded.',
      });
    } else {
      const smcTime = new Date(doc.expiryDate).getTime();
      const docTime = new Date(parentDoc.expiryDate).getTime();
      if (isNaN(smcTime) || isNaN(docTime)) {
        results.push({
          checkId: 'smc_doc_validity_bound',
          label: 'SMC Validity Bound',
          state: 'warn',
          message: 'Could not parse certificate expiry dates for validity bound check.',
        });
      } else if (smcTime <= docTime) {
        results.push({
          checkId: 'smc_doc_validity_bound',
          label: 'SMC Validity Bound',
          state: 'pass',
          message: `SMC expiry (${doc.expiryDate}) is within parent DOC expiry (${parentDoc.expiryDate}).`,
        });
      } else {
        results.push({
          checkId: 'smc_doc_validity_bound',
          label: 'SMC Validity Bound',
          state: 'fail',
          message: `SMC expiry date (${doc.expiryDate}) exceeds parent DOC expiry (${parentDoc.expiryDate}). Under ISM Code, SMC cannot outlast DOC.`,
        });
      }
    }
  } else {
    // isDoc
    const smcDocs = companionDocs.filter((d) => {
      const t = (d.title + ' ' + (d.vesselAttributes?.certType || '')).toLowerCase();
      return t.includes('safety management certificate') || t.includes('smc');
    });

    if (smcDocs.length === 0 || !doc.expiryDate) {
      results.push({
        checkId: 'smc_doc_validity_bound',
        label: 'SMC Validity Bound',
        state: 'not_applicable',
        message: 'No companion SMC certificates or DOC has no expiry recorded.',
      });
    } else {
      const docTime = new Date(doc.expiryDate).getTime();
      const exceedingSmc = smcDocs.find((smc) => smc.expiryDate && new Date(smc.expiryDate).getTime() > docTime);
      if (exceedingSmc) {
        results.push({
          checkId: 'smc_doc_validity_bound',
          label: 'SMC Validity Bound',
          state: 'fail',
          message: `Companion SMC (${exceedingSmc.certificateNo || exceedingSmc.title}) expiry (${exceedingSmc.expiryDate}) exceeds this DOC expiry (${doc.expiryDate}).`,
        });
      } else {
        results.push({
          checkId: 'smc_doc_validity_bound',
          label: 'SMC Validity Bound',
          state: 'pass',
          message: `All vessel SMC certificates fall within this DOC expiry (${doc.expiryDate}).`,
        });
      }
    }
  }

  return results;
}

