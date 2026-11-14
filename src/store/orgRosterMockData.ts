/*
  file summary: organization role roster builder ensuring every organization has an admin and fitting operational roles.
  responsibilities: holds ORGANIZATIONS table, roles by kind mapping, and buildOrgRoster generator.
  role in system: supplies supplemental user profiles for useMapStore so every organization can be assigned or requested.
*/

import { UserProfile, UserRolePersona } from '../types/user';
import { orgFieldMatches } from '../utils/rbacHelpers';

export type OrganizationKind = 'owner' | 'client' | 'third party' | 'provider';

export interface OrganizationInfo {
  readonly name: string;
  readonly kind: OrganizationKind;
  readonly shortCode: string;
  readonly emailDomain: string;
}

/**
 * 21 organizations from the design table (Owner, Client, Third party, Provider).
 * Exact names match existing mockData, projectMockData, and equipmentMockData.
 */
export const ORGANIZATIONS: readonly OrganizationInfo[] = [
  /* Owners */
  {
    name: 'Northwind Marine Pty Ltd',
    kind: 'owner',
    shortCode: 'NWM',
    emailDomain: 'northwindmarine.com',
  },
  {
    name: 'Meridian Marine Services Pty Ltd',
    kind: 'owner',
    shortCode: 'MMS',
    emailDomain: 'meridianmarine.com.au',
  },
  {
    name: 'Austral Ocean Shipping Ltd',
    kind: 'owner',
    shortCode: 'AOS',
    emailDomain: 'australocean.com.au',
  },
  {
    name: 'Oceanic Horizon Logistics Pty Ltd',
    kind: 'owner',
    shortCode: 'OHL',
    emailDomain: 'oceanichorizon.com.au',
  },

  /* Clients */
  {
    name: 'Southern Basin Energy Pty Ltd',
    kind: 'client',
    shortCode: 'SBE',
    emailDomain: 'southernbasin.com.au',
  },
  {
    name: 'Chevron Australia Pty Ltd',
    kind: 'client',
    shortCode: 'CHV',
    emailDomain: 'chevron.com',
  },
  {
    name: 'Woodside Energy Ltd',
    kind: 'client',
    shortCode: 'WDS',
    emailDomain: 'woodside.com.au',
  },
  {
    name: 'Shell Australia Pty Ltd',
    kind: 'client',
    shortCode: 'SHL',
    emailDomain: 'shell.com.au',
  },
  {
    name: 'BHP Petroleum',
    kind: 'client',
    shortCode: 'BHP',
    emailDomain: 'bhp.com',
  },
  {
    name: 'Inpex Operations Australia',
    kind: 'client',
    shortCode: 'INP',
    emailDomain: 'inpex.com.au',
  },
  {
    name: 'Santos Ltd',
    kind: 'client',
    shortCode: 'STO',
    emailDomain: 'santos.com',
  },
  {
    name: 'Beach Energy Ltd',
    kind: 'client',
    shortCode: 'BPT',
    emailDomain: 'beachenergy.com.au',
  },

  /* Third parties */
  {
    name: 'Bureau Veritas Inspectorate',
    kind: 'third party',
    shortCode: 'BVI',
    emailDomain: 'bureauveritas.com',
  },
  {
    name: 'Meridian Marine Surveyors',
    kind: 'third party',
    shortCode: 'MSV',
    emailDomain: 'meridiansurveyors.com.au',
  },
  {
    name: 'Marine Assurance Authority',
    kind: 'third party',
    shortCode: 'MAA',
    emailDomain: 'marineassurance.gov.au',
  },
  {
    name: 'Chevron Australia Vetting',
    kind: 'third party',
    shortCode: 'CAV',
    emailDomain: 'chevronvetting.com',
  },
  {
    name: 'Global Maritime Audits',
    kind: 'third party',
    shortCode: 'GMA',
    emailDomain: 'globalmaritime.com',
  },
  {
    name: 'DNV',
    kind: 'third party',
    shortCode: 'DNV',
    emailDomain: 'dnv.com',
  },
  {
    name: 'AMSA',
    kind: 'third party',
    shortCode: 'AMS',
    emailDomain: 'amsa.gov.au',
  },

  /* Providers */
  {
    name: 'AquaClean Marine Services Pty Ltd',
    kind: 'provider',
    shortCode: 'AQC',
    emailDomain: 'aquacleanmarine.com.au',
  },
  {
    name: 'Pacific Ocean Logistics Pty Ltd',
    kind: 'provider',
    shortCode: 'POL',
    emailDomain: 'pacificocean.com.au',
  },
] as const;

/**
 * Returns the admin role appropriate for the organization kind:
 * C Admin for clients, Administrator otherwise.
 */
export function adminRoleFor(kind: OrganizationKind): 'C Admin' | 'Administrator' {
  return kind === 'client' ? 'C Admin' : 'Administrator';
}

/**
 * Operational non-admin roles appropriate for each organization kind per design table.
 */
export const ROLES_BY_KIND: Record<OrganizationKind, readonly UserRolePersona[]> = {
  owner: ['Submitter', 'Verifier', 'Inspector', 'Approver'],
  client: ['Verifier', 'Inspector', 'Approver'],
  'third party': ['Verifier', 'Inspector', 'Approver'],
  provider: ['Submitter'],
};

/**
 * Abbreviated role code for stable user ID generation (USR-<ORG>-<ROLE>).
 */
export const ROLE_CODE_MAP: Record<UserRolePersona, string> = {
  Administrator: 'ADM',
  'C Admin': 'ADM',
  Submitter: 'SUB',
  Verifier: 'VER',
  Inspector: 'INS',
  Approver: 'APP',
};

const DEPARTMENT_BY_ROLE: Record<UserRolePersona, string> = {
  Administrator: 'Organization Governance & Administration',
  'C Admin': 'Chartering & Assurance Governance',
  Submitter: 'Technical Documentation & Submissions',
  Verifier: 'Statutory Verification & Compliance',
  Inspector: 'Marine Inspection & Survey Audits',
  Approver: 'Executive Sign-Off & Approvals',
};

/** Curated, authentic personnel names per organization and role for deterministic mock data */
const PERSONNEL_NAMES: Record<string, Record<string, { name: string; username: string }>> = {
  NWM: {
    APP: { name: 'A. Campbell', username: 'a.campbell' },
  },
  MMS: {
    VER: { name: 'E. Vance', username: 'e.vance' },
    INS: { name: 'N. Ross', username: 'n.ross' },
    APP: { name: 'G. Sterling', username: 'g.sterling' },
  },
  AOS: {
    ADM: { name: 'Capt. T. Lindholm', username: 't.lindholm' },
    SUB: { name: 'H. Jansen', username: 'h.jansen' },
    VER: { name: 'R. Dahl', username: 'r.dahl' },
    INS: { name: 'P. Sorensen', username: 'p.sorensen' },
    APP: { name: 'K. Mikkelsen', username: 'k.mikkelsen' },
  },
  OHL: {
    ADM: { name: 'C. Vane', username: 'c.vane' },
    SUB: { name: 'M. Gallagher', username: 'm.gallagher' },
    VER: { name: 'T. Brennan', username: 't.brennan' },
    INS: { name: 'D. O\'Connor', username: 'd.oconnor' },
    APP: { name: 'S. Callahan', username: 's.callahan' },
  },
  SBE: {
    VER: { name: 'A. Miller', username: 'a.miller' },
    INS: { name: 'L. Patel', username: 'l.patel' },
  },
  CHV: {
    INS: { name: 'J. Fraser', username: 'j.fraser' },
  },
  WDS: {
    ADM: { name: 'M. Taylor', username: 'm.taylor' },
    VER: { name: 'C. Drummond', username: 'c.drummond' },
    INS: { name: 'P. Fitzpatrick', username: 'p.fitzpatrick' },
  },
  SHL: {
    INS: { name: 'R. Van Dyke', username: 'r.vandyke' },
  },
  BHP: {
    ADM: { name: 'V. Langford', username: 'v.langford' },
    VER: { name: 'K. Holloway', username: 'k.holloway' },
    INS: { name: 'B. Whitmore', username: 'b.whitmore' },
    APP: { name: 'J. Kensington', username: 'j.kensington' },
  },
  INP: {
    INS: { name: 'M. Takahashi', username: 'm.takahashi' },
  },
  STO: {
    VER: { name: 'D. Macarthur', username: 'd.macarthur' },
    INS: { name: 'B. Sutherland', username: 'b.sutherland' },
    APP: { name: 'E. Montgomery', username: 'e.montgomery' },
  },
  BPT: {
    VER: { name: 'T. Redman', username: 't.redman' },
    INS: { name: 'A. Connolly', username: 'a.connolly' },
    APP: { name: 'S. Fairbairn', username: 's.fairbairn@beachenergy.com.au' },
  },
  BVI: {
    APP: { name: 'G. Delacroix', username: 'g.delacroix' },
  },
  MSV: {
    ADM: { name: 'Capt. R. Thorne', username: 'r.thorne' },
    VER: { name: 'H. Bishop', username: 'h.bishop' },
    INS: { name: 'M. Sinclair', username: 'm.sinclair' },
    APP: { name: 'D. Calder', username: 'd.calder' },
  },
  MAA: {
    VER: { name: 'C. Kingsley', username: 'c.kingsley' },
    INS: { name: 'R. Thornton', username: 'r.thornton' },
  },
  CAV: {
    ADM: { name: 'G. Vance', username: 'g.vance' },
    VER: { name: 'W. Sterling', username: 'w.sterling' },
    INS: { name: 'L. Cartwright', username: 'l.cartwright' },
    APP: { name: 'M. Lockhart', username: 'm.lockhart' },
  },
  GMA: {
    VER: { name: 'J. Crawford', username: 'j.crawford' },
    INS: { name: 'R. McAllister', username: 'r.mcallister' },
    APP: { name: 'E. Douglas', username: 'e.douglas' },
  },
  DNV: {
    ADM: { name: 'K. Holst', username: 'k.holst' },
    VER: { name: 'A. Berg', username: 'a.berg' },
    INS: { name: 'T. Nielsen', username: 't.nielsen' },
    APP: { name: 'O. Lindqvist', username: 'o.lindqvist' },
  },
  AMS: {
    ADM: { name: 'D. Carmichael', username: 'd.carmichael' },
    VER: { name: 'J. Wentworth', username: 'j.wentworth' },
    INS: { name: 'K. Murdoch', username: 'k.murdoch' },
    APP: { name: 'H. Abercrombie', username: 'h.abercrombie' },
  },
  AQC: {
    ADM: { name: 'P. Harrington', username: 'p.harrington' },
    SUB: { name: 'L. Morrison', username: 'l.morrison' },
  },
  POL: {
    ADM: { name: 'Capt. E. Hayes', username: 'e.hayes' },
    SUB: { name: 'T. Jenkins', username: 't.jenkins' },
  },
};

function resolvePersonnel(
  shortCode: string,
  roleCode: string,
  emailDomain: string,
): { name: string; email: string } {
  const curated = PERSONNEL_NAMES[shortCode]?.[roleCode];
  if (curated) {
    const username = curated.username.includes('@')
      ? curated.username.split('@')[0]
      : curated.username;
    return {
      name: curated.name,
      email: `${username}@${emailDomain}`,
    };
  }
  return {
    name: `${roleCode} Officer (${shortCode})`,
    email: `${roleCode.toLowerCase()}.${shortCode.toLowerCase()}@${emailDomain}`,
  };
}

/**
 * Builds supplemental user profiles for all organizations in the table.
 * For each organization:
 * 1. Adds the admin role first (C Admin for clients, Administrator otherwise) if missing from existing.
 * 2. Adds each other role of the organization's kind if missing from existing.
 *
 * Existing matches use `orgFieldMatches`.
 * Non-admin users have createdBy and invitedBy set to their organization's admin role.
 */
export function buildOrgRoster(existing: UserProfile[] = []): UserProfile[] {
  const roster: UserProfile[] = [];

  for (const org of ORGANIZATIONS) {
    const adminRole = adminRoleFor(org.kind);
    const userType: UserProfile['userType'] =
      org.kind === 'owner' || org.kind === 'client' ? 'Organization' : 'Third-Party';

    // Check if an existing user already covers the admin role for this organization
    const hasAdmin =
      existing.some(
        (u) =>
          u.status === 'Active' &&
          Boolean(u.organization) &&
          orgFieldMatches(org.name, u.organization) &&
          u.roles.includes(adminRole),
      ) ||
      roster.some(
        (u) =>
          orgFieldMatches(org.name, u.organization) &&
          u.roles.includes(adminRole),
      );

    if (!hasAdmin) {
      const roleCode = ROLE_CODE_MAP[adminRole];
      const person = resolvePersonnel(org.shortCode, roleCode, org.emailDomain);
      roster.push({
        id: `USR-${org.shortCode}-${roleCode}`,
        name: person.name,
        email: person.email,
        roles: [adminRole],
        userType,
        organization: org.name,
        departmentOrScope: DEPARTMENT_BY_ROLE[adminRole],
        status: 'Active',
        lastActive: '2026-11-14 00:00 UTC',
      });
    }

    // Now process non-admin roles of its kind
    const otherRoles = ROLES_BY_KIND[org.kind];
    for (const role of otherRoles) {
      const isRoleCovered =
        existing.some(
          (u) =>
            u.status === 'Active' &&
            Boolean(u.organization) &&
            orgFieldMatches(org.name, u.organization) &&
            u.roles.includes(role),
        ) ||
        roster.some(
          (u) =>
            orgFieldMatches(org.name, u.organization) &&
            u.roles.includes(role),
        );

      if (!isRoleCovered) {
        const roleCode = ROLE_CODE_MAP[role];
        const person = resolvePersonnel(org.shortCode, roleCode, org.emailDomain);
        roster.push({
          id: `USR-${org.shortCode}-${roleCode}`,
          name: person.name,
          email: person.email,
          roles: [role],
          userType,
          organization: org.name,
          departmentOrScope: DEPARTMENT_BY_ROLE[role],
          status: 'Active',
          lastActive: '2026-11-14 00:00 UTC',
          createdBy: adminRole,
          invitedBy: adminRole,
        });
      }
    }
  }

  return roster;
}

