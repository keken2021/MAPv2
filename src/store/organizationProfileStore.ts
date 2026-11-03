/*
  file summary: standalone zustand store for organization contact profiles and vessel manager dates.
  responsibilities: seed profiles, look up by organization name, let Administrator update their own org, expose manager dates of effect.
  role in system: kept out of useMapStore; consumed by OrganizationProfileView, marketplaceHelpers, and vessel Management rows.
*/

import { create } from 'zustand';
import {
  OrganizationProfile,
  VesselManagerEffectDate,
  VesselManagerRole,
  displayOrganizationField,
} from '../types/organization';
import {
  MOCK_ORGANIZATION_PROFILES,
  MOCK_VESSEL_MANAGER_EFFECT_DATES,
} from './organizationMockData';

export type OrganizationProfilePatch = Partial<
  Pick<OrganizationProfile, 'email' | 'phone' | 'fax' | 'website' | 'address'>
>;

interface OrganizationProfileState {
  profiles: OrganizationProfile[];
  managerEffectDates: VesselManagerEffectDate[];
  getProfileByName: (organizationName?: string | null) => OrganizationProfile | undefined;
  updateProfileForOrganization: (organizationName: string, patch: OrganizationProfilePatch) => boolean;
  getManagerDateOfEffect: (vesselId: string, role: VesselManagerRole) => string;
  getManagerDateOfEffectForOrganization: (
    vesselId: string,
    organizationName: string,
    vessel: {
      registeredOwner?: string;
      ismCompany?: string;
      technicalManager?: string;
    },
  ) => string;
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const useOrganizationProfileStore = create<OrganizationProfileState>((set, get) => ({
  profiles: MOCK_ORGANIZATION_PROFILES.map((p) => ({ ...p })),
  managerEffectDates: MOCK_VESSEL_MANAGER_EFFECT_DATES.map((d) => ({ ...d })),

  getProfileByName: (organizationName) => {
    const name = (organizationName || '').trim();
    if (!name) return undefined;
    return get().profiles.find((p) => namesMatch(p.name, name));
  },

  updateProfileForOrganization: (organizationName, patch) => {
    const name = organizationName.trim();
    if (!name) return false;
    let updated = false;
    set((state) => ({
      profiles: state.profiles.map((profile) => {
        if (!namesMatch(profile.name, name)) return profile;
        updated = true;
        return {
          ...profile,
          email: patch.email !== undefined ? patch.email.trim() : profile.email,
          phone: patch.phone !== undefined ? patch.phone.trim() : profile.phone,
          fax: patch.fax !== undefined ? patch.fax.trim() : profile.fax,
          website: patch.website !== undefined ? patch.website.trim() : profile.website,
          address: patch.address !== undefined ? patch.address.trim() : profile.address,
        };
      }),
    }));
    return updated;
  },

  getManagerDateOfEffect: (vesselId, role) => {
    const row = get().managerEffectDates.find((d) => d.vesselId === vesselId && d.role === role);
    return row?.dateOfEffect || '';
  },

  getManagerDateOfEffectForOrganization: (vesselId, organizationName, vessel) => {
    const name = organizationName.trim().toLowerCase();
    if (!name) return '';
    const roles: VesselManagerRole[] = [];
    if ((vessel.registeredOwner || '').trim().toLowerCase() === name) roles.push('registeredOwner');
    if ((vessel.ismCompany || '').trim().toLowerCase() === name) roles.push('ismCompany');
    if ((vessel.technicalManager || '').trim().toLowerCase() === name) roles.push('technicalManager');
    for (const role of roles) {
      const date = get().getManagerDateOfEffect(vesselId, role);
      if (date.trim()) return date;
    }
    return roles.length > 0 ? get().getManagerDateOfEffect(vesselId, roles[0]) : '';
  },
}));

/**
  what: marketplace / Management contact fields from the organization profile, never invented from the name.
*/
export function organizationContactFields(organizationName?: string | null): {
  email: string;
  phone: string;
  fax: string;
  website: string;
  address: string;
} {
  const profile = useOrganizationProfileStore.getState().getProfileByName(organizationName);
  return {
    email: displayOrganizationField(profile?.email),
    phone: displayOrganizationField(profile?.phone),
    fax: displayOrganizationField(profile?.fax),
    website: displayOrganizationField(profile?.website),
    address: displayOrganizationField(profile?.address),
  };
}
