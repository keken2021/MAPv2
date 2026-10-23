/*
  file summary: the validation rules a document gets when it is uploaded or replaced.
  responsibilities: compares the vessel name and IMO read from the document with the vessel record, and the issuing authority with the IACS member list, then records the result on the document's rules.
  role in system: used by useMapStore.ts (addDocument, uploadDocumentForRequirement, addDocumentVersion); the review drawer reads the result through verificationPolicy.ts.
*/

import type { MasterDocument, ValidationRuleStatus } from '../types/document';
import type { VesselInformation } from '../types/vessel';

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
  const imoMatches = imoDigits(doc.vesselAttributes.imoNumber) !== '' && imoDigits(doc.vesselAttributes.imoNumber) === imoDigits(vessel.imoNumber);
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
