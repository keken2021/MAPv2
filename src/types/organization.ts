/*
  file summary: organization contact profile and vessel manager date-of-effect types.
  responsibilities: shapes the Organization profile Settings record and manager appointment dates on vessels.
  role in system: consumed by organizationMockData, organizationProfileStore, OrganizationProfileView, marketplaceHelpers, and vessel Management rows.
*/

/** shown wherever an organization contact field has no recorded value */
export const ORGANIZATION_FIELD_NOT_RECORDED = 'Not recorded';

export interface OrganizationProfile {
  id: string;
  /** legal or trading name; matches vessel owner / manager / marketplace providerOrg strings */
  name: string;
  email: string;
  phone: string;
  fax: string;
  website: string;
  address: string;
}

export type VesselManagerRole = 'registeredOwner' | 'ismCompany' | 'technicalManager';

/** date the named manager role took effect on one vessel (ISO date; empty when not recorded) */
export interface VesselManagerEffectDate {
  vesselId: string;
  role: VesselManagerRole;
  dateOfEffect: string;
}

/**
  what: returns the recorded value or Not recorded when blank.
*/
export function displayOrganizationField(value?: string | null): string {
  const trimmed = (value || '').trim();
  return trimmed || ORGANIZATION_FIELD_NOT_RECORDED;
}

export const VESSEL_MANAGER_ROLE_LABELS: Record<VesselManagerRole, string> = {
  registeredOwner: 'Registered Owner',
  ismCompany: 'ISM Manager',
  technicalManager: 'Ship Manager',
};

export function vesselManagerRoleFromLabel(label: string): VesselManagerRole | undefined {
  const entry = (Object.entries(VESSEL_MANAGER_ROLE_LABELS) as [VesselManagerRole, string][]).find(
    ([, text]) => text === label,
  );
  return entry?.[0];
}
