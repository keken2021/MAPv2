/*
  file summary: rules for restricted crew data: what is masked, how it is masked, and who may reveal it.
  responsibilities: names restricted crew documents, masks a value, and decides whether the signed-in role may reveal it.
  role in system: used by MaskedValue.tsx, CrewDetailView.tsx and DocumentReviewDrawer.tsx; gap review finding G12 (paper 15.10, P12).
*/

import type { UserRolePersona } from '../types/audit';

/* passport, identity and medical records are personal data under several regimes at once (paper P6, P12) */
const RESTRICTED_CREW_DOCUMENT = /passport|medical|eng1|identity/i;

/**
  what: true when a crew document holds restricted personal data; input is the document title.
  how: matches passport, medical and identity documents by title.
  with what file: src/utils/restrictedData.ts used by CrewDetailView.tsx.
*/
export function isRestrictedCrewDocument(title: string | undefined): boolean {
  return Boolean(title && RESTRICTED_CREW_DOCUMENT.test(title));
}

/**
  what: the masked form of a restricted value; input is the value.
  how: hides every character but the last two; an empty value stays empty.
  with what file: src/utils/restrictedData.ts used by MaskedValue.tsx, CrewDetailView.tsx exports and DocumentReviewDrawer.tsx.
*/
export function maskRestrictedValue(value: string | undefined): string {
  if (!value) return '';
  const visible = value.length > 4 ? value.slice(-2) : '';
  return `••••••${visible}`;
}

/**
  what: whether the signed-in role may reveal a crew member's restricted data; inputs are the role, the session organization and the crew member's organization.
  how: only an administrator of the organization that owns the crew record; every other role sees the masked value.
  with what file: src/utils/restrictedData.ts used by MaskedValue.tsx.
*/
export function canRevealCrewData(
  persona: UserRolePersona,
  sessionOrganization: string | undefined,
  crewOrganization: string | undefined,
): boolean {
  return (
    persona === 'Administrator' &&
    Boolean(sessionOrganization && crewOrganization) &&
    sessionOrganization!.trim().toLowerCase() === crewOrganization!.trim().toLowerCase()
  );
}
