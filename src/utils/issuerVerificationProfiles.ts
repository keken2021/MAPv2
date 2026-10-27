/* 
  file summary: verified issuer verification profiles and authority lookup guidance.
  responsibilities: provides confirmed digital verification routes for recognized organisations and flag administrations (gap review R2-G4, R2-S8).
  role in system: used by DocumentReviewDrawer.tsx to display confirmed verification methods to verifiers.
*/

export interface IssuerVerificationProfile {
  issuerKey: string;
  name: string;
  type: 'Recognised Organisation' | 'Flag Administration' | 'Classification Society';
  confirmedMethod: string;
  verificationSteps: string[];
  referenceLabel: string; // e.g. "Unique Tracking Number (UTN)", "Tracking ID (TID)"
  portalUrl?: string;
  notes?: string;
}

export const CONFIRMED_ISSUER_PROFILES: Record<string, IssuerVerificationProfile> = {
  dnv: {
    issuerKey: 'dnv',
    name: 'DNV (Det Norske Veritas)',
    type: 'Recognised Organisation',
    confirmedMethod: 'Digital signature panel verification & DNV Trust form lookup',
    verificationSteps: [
      'Inspect digital signature panel in Adobe Acrobat / PDF viewer for valid DNV digital signature.',
      'Navigate to DNV Trust online portal and query certificate verification number / UTN.',
      'Confirm certificate status, vessel IMO match, and endorsements directly from the electronic register.',
    ],
    referenceLabel: 'UTN / Verification ID',
    notes: 'Electronic certificates issued by DNV conform to IMO FAL.5/Circ.39/Rev.2.',
  },
  lr: {
    issuerKey: 'lr',
    name: "Lloyd's Register (LR)",
    type: 'Recognised Organisation',
    confirmedMethod: "Lloyd's Register UTN (Unique Tracking Number) portal",
    verificationSteps: [
      "Locate the Unique Tracking Number (UTN) printed in the footer or header of the Lloyd's Register certificate.",
      'Access the LR Class Direct verification page.',
      'Input the UTN and verify that the issued document details match the submitted certificate.',
    ],
    referenceLabel: 'Unique Tracking Number (UTN)',
    notes: "UTN format follows LR international standard tracking scheme.",
  },
  abs: {
    issuerKey: 'abs',
    name: 'American Bureau of Shipping (ABS)',
    type: 'Recognised Organisation',
    confirmedMethod: 'ABS Eagle Validation Portal (IMO or certificate number)',
    verificationSteps: [
      'Access ABS Eagle Validation system online.',
      'Enter the vessel IMO number or ABS Certificate Number.',
      'Verify certificate validity, survey endorsements, and class status.',
    ],
    referenceLabel: 'ABS Certificate No. / IMO',
    notes: 'Requires IMO number or ABS certificate tracking number.',
  },
  liberia: {
    issuerKey: 'liberia',
    name: 'Liberian Maritime Authority (LISCR)',
    type: 'Flag Administration',
    confirmedMethod: 'Liberian Tracking ID (TID) verification portal',
    verificationSteps: [
      'Locate the Tracking Identification (TID) printed on the Liberian statutory certificate.',
      'Enter the TID in the official LISCR verification portal.',
      'Confirm the certificate was authenticated and signed by the administration.',
    ],
    referenceLabel: 'Tracking ID (TID)',
    notes: 'LISCR validates certificates exclusively via the official TID ledger.',
  },
  rmi: {
    issuerKey: 'rmi',
    name: 'Republic of the Marshall Islands (RMI)',
    type: 'Flag Administration',
    confirmedMethod: 'RMI QR Code or Online Verification Portal',
    verificationSteps: [
      'Scan the authenticated QR code on the certificate using a secure device, or input the UTN.',
      'Verify that the Marshall Islands Maritime Administrator database confirms the document status as Active.',
    ],
    referenceLabel: 'RMI UTN / QR Payload',
    notes: 'Electronic certificates carry embedded validation tokens.',
  },
  hongkong: {
    issuerKey: 'hongkong',
    name: 'Hong Kong Marine Department (HKMD)',
    type: 'Flag Administration',
    confirmedMethod: 'HKMD Electronic Certificate Verification Portal',
    verificationSteps: [
      'Access HKMD e-Certificate Verification system.',
      'Enter the certificate tracking code and complete the visual security captcha.',
      'Verify record matching the vessel name, IMO, and expiry.',
    ],
    referenceLabel: 'HKMD Certificate Tracking Code',
    notes: 'Access requires manual captcha resolution.',
  },
};

/**
  what: resolves an issuer verification profile for a given issuing authority string.
  how: checks whether the normalized authority text contains the identifier of any confirmed issuer.
*/
export function getIssuerVerificationProfile(authority: string | undefined): IssuerVerificationProfile | null {
  if (!authority) return null;
  const norm = authority.toLowerCase();
  if (norm.includes('dnv') || norm.includes('det norske veritas')) return CONFIRMED_ISSUER_PROFILES.dnv;
  if (norm.includes('lloyd') || norm.includes(' lr ')) return CONFIRMED_ISSUER_PROFILES.lr;
  if (norm.includes('abs') || norm.includes('american bureau of shipping')) return CONFIRMED_ISSUER_PROFILES.abs;
  if (norm.includes('liberia') || norm.includes('liscr')) return CONFIRMED_ISSUER_PROFILES.liberia;
  if (norm.includes('marshall') || norm.includes('rmi')) return CONFIRMED_ISSUER_PROFILES.rmi;
  if (norm.includes('hong kong') || norm.includes('hkmd')) return CONFIRMED_ISSUER_PROFILES.hongkong;
  return null;
}
