import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ORGANIZATIONS,
  CLIENT_ORGANIZATIONS,
  getAdminRoleForOrganization,
  isCanonicalOrganization,
  canonicalizeOrganization,
} from '../utils/organizationRegistry';
import { useMapStore } from '../store/useMapStore';
import { orgFieldMatches } from '../utils/rbacHelpers';
import { defaultOrganizationVerifier } from '../utils/userRoleHelpers';
import { MOCK_PROJECTS } from '../store/projectMockData';
import {
  OIL_CO_PILOT_PROJECT,
  OIL_CO_PILOT_ASSURANCE_SETS,
  OIL_CO_PILOT_VESSELS,
  OIL_CO_PILOT_ASSURANCE_OBJECTS,
} from '../store/oilCoLngPilotMockData';
import { MOCK_ASSURANCE_SETS, MOCK_VESSELS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_ORGANIZATION_PROFILES } from '../store/organizationMockData';
import { SEEDED_ACTIVITY_OBJECTS } from '../store/assuranceObjectMockData';

describe('Organization Registry and Mock Data Consistency', () => {
  it('defines the 30 kept canonical organizations', () => {
    expect(CANONICAL_ORGANIZATIONS).toHaveLength(30);
    expect(isCanonicalOrganization('Northwind Marine Pty Ltd')).toBe(true);
    expect(isCanonicalOrganization('Southern Basin Energy Pty Ltd')).toBe(true);
    expect(isCanonicalOrganization('Oil Company')).toBe(true);
    expect(isCanonicalOrganization('Meridian Shipyards')).toBe(true);
    expect(isCanonicalOrganization('Austral Classification Society')).toBe(true);
    expect(isCanonicalOrganization('Harbourline Terminals')).toBe(true);
    expect(isCanonicalOrganization('NOPSEMA')).toBe(true);
    expect(isCanonicalOrganization('Chevron Australia Pty Ltd')).toBe(true);
    expect(isCanonicalOrganization('Bureau Veritas Inspectorate')).toBe(true);
    expect(isCanonicalOrganization('ABS')).toBe(true);
    expect(isCanonicalOrganization('AMSA')).toBe(true);
    expect(isCanonicalOrganization('DNV')).toBe(true);
    expect(isCanonicalOrganization("Lloyd's Register")).toBe(true);
    expect(isCanonicalOrganization('RINA')).toBe(true);
    expect(isCanonicalOrganization('Gard P&I Club')).toBe(true);
    expect(isCanonicalOrganization('Australian Register of Ships')).toBe(true);
  });

  it('correctly classifies client organizations for C Admin vs Administrator role', () => {
    expect(getAdminRoleForOrganization('Southern Basin Energy Pty Ltd')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Oil Company')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Chevron Australia Pty Ltd')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Inpex Operations Australia')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Shell Australia Pty Ltd')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Woodside Energy Ltd')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Santos Ltd')).toBe('C Admin');
    expect(getAdminRoleForOrganization('Beach Energy Ltd')).toBe('C Admin');

    expect(getAdminRoleForOrganization('Northwind Marine Pty Ltd')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Meridian Marine Services Pty Ltd')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Meridian Shipyards')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Austral Classification Society')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Harbourline Terminals')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Bureau Veritas Inspectorate')).toBe('Administrator');
    expect(getAdminRoleForOrganization('XY Marine Assurance')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Coastal Fuel Testing')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Kestrel Control Systems')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Sentinel Cyber Assurance')).toBe('Administrator');
    expect(getAdminRoleForOrganization('NOPSEMA')).toBe('Administrator');
    expect(getAdminRoleForOrganization('Fremantle Port Authority')).toBe('Administrator');
  });

  it('normalizes known aliases through canonicalizeOrganization', () => {
    expect(canonicalizeOrganization('Southern Basin Energy')).toBe('Southern Basin Energy Pty Ltd');
    expect(canonicalizeOrganization('Chevron Australia')).toBe('Chevron Australia Pty Ltd');
    expect(canonicalizeOrganization('Chevron Australia Vetting')).toBe('Chevron Australia Pty Ltd');
    expect(canonicalizeOrganization('Shell Australia')).toBe('Shell Australia Pty Ltd');
    expect(canonicalizeOrganization('Woodside Energy')).toBe('Woodside Energy Ltd');
    expect(canonicalizeOrganization('Bureau Veritas')).toBe('Bureau Veritas Inspectorate');
    expect(canonicalizeOrganization('DNV Technical Assurance')).toBe('DNV');
    expect(canonicalizeOrganization('DNV (IACS member)')).toBe('DNV');
  });

  it('ensures every organization string in mock projects is in CANONICAL_ORGANIZATIONS', () => {
    const allProjects = [...MOCK_PROJECTS, OIL_CO_PILOT_PROJECT];
    for (const p of allProjects) {
      const raw = p as any;
      if (raw.clientOrg) expect(isCanonicalOrganization(raw.clientOrg), `Project ${p.id} clientOrg: ${raw.clientOrg}`).toBe(true);
      if (raw.primaryContractorOrg) expect(isCanonicalOrganization(raw.primaryContractorOrg), `Project ${p.id} primaryContractorOrg: ${raw.primaryContractorOrg}`).toBe(true);
      if (p.requestingOrganization) expect(isCanonicalOrganization(p.requestingOrganization), `Project ${p.id} requestingOrganization: ${p.requestingOrganization}`).toBe(true);
      for (const cp of p.contractParties || []) {
        if (cp.organization.includes('Pending') || cp.organization.includes('Helper')) continue;
        expect(isCanonicalOrganization(cp.organization), `Project ${p.id} contractParty: ${cp.organization}`).toBe(true);
      }
      for (const inv of p.invitedOrganizations || []) {
        expect(isCanonicalOrganization(inv), `Project ${p.id} invitedOrg: ${inv}`).toBe(true);
      }
    }
  });

  it('ensures every organization string in mock assurance sets is in CANONICAL_ORGANIZATIONS', () => {
    const allSets = [...MOCK_ASSURANCE_SETS, ...OIL_CO_PILOT_ASSURANCE_SETS];
    for (const s of allSets) {
      const raw = s as any;
      if (raw.clientOrganization) expect(isCanonicalOrganization(raw.clientOrganization), `Set ${s.id} clientOrganization: ${raw.clientOrganization}`).toBe(true);
      if (s.clientOrg) expect(isCanonicalOrganization(s.clientOrg), `Set ${s.id} clientOrg: ${s.clientOrg}`).toBe(true);
      if (raw.providerOrganization) expect(isCanonicalOrganization(raw.providerOrganization), `Set ${s.id} providerOrganization: ${raw.providerOrganization}`).toBe(true);
      if (s.serviceProviderOrg) expect(isCanonicalOrganization(s.serviceProviderOrg), `Set ${s.id} serviceProviderOrg: ${s.serviceProviderOrg}`).toBe(true);
      if (s.initiatorOrg) expect(isCanonicalOrganization(s.initiatorOrg), `Set ${s.id} initiatorOrg: ${s.initiatorOrg}`).toBe(true);
      if (s.charterer) expect(isCanonicalOrganization(s.charterer), `Set ${s.id} charterer: ${s.charterer}`).toBe(true);

      for (const p of s.parties || []) {
        expect(isCanonicalOrganization(p.organization), `Set ${s.id} party: ${p.organization}`).toBe(true);
      }

      if (s.stakeholders?.submitterOrg) expect(isCanonicalOrganization(s.stakeholders.submitterOrg), `Set ${s.id} submitterOrg: ${s.stakeholders.submitterOrg}`).toBe(true);
      if (s.stakeholders?.verifierOrg) expect(isCanonicalOrganization(s.stakeholders.verifierOrg), `Set ${s.id} verifierOrg: ${s.stakeholders.verifierOrg}`).toBe(true);
      if (s.stakeholders?.inspectorOrg) expect(isCanonicalOrganization(s.stakeholders.inspectorOrg), `Set ${s.id} inspectorOrg: ${s.stakeholders.inspectorOrg}`).toBe(true);
      if (s.stakeholders?.approverOrg) expect(isCanonicalOrganization(s.stakeholders.approverOrg), `Set ${s.id} approverOrg: ${s.stakeholders.approverOrg}`).toBe(true);

      if (s.assignedStakeholders?.submitterOrg) expect(isCanonicalOrganization(s.assignedStakeholders.submitterOrg), `Set ${s.id} assigned submitterOrg: ${s.assignedStakeholders.submitterOrg}`).toBe(true);
      if (s.assignedStakeholders?.verifierOrg) expect(isCanonicalOrganization(s.assignedStakeholders.verifierOrg), `Set ${s.id} assigned verifierOrg: ${s.assignedStakeholders.verifierOrg}`).toBe(true);
      if (s.assignedStakeholders?.inspectorOrg) expect(isCanonicalOrganization(s.assignedStakeholders.inspectorOrg), `Set ${s.id} assigned inspectorOrg: ${s.assignedStakeholders.inspectorOrg}`).toBe(true);
      if (s.assignedStakeholders?.approverOrg) expect(isCanonicalOrganization(s.assignedStakeholders.approverOrg), `Set ${s.id} assigned approverOrg: ${s.assignedStakeholders.approverOrg}`).toBe(true);
    }
  });

  it('ensures every organization string in vessels is in CANONICAL_ORGANIZATIONS', () => {
    const allVessels = [...MOCK_VESSELS, ...OIL_CO_PILOT_VESSELS];
    for (const v of allVessels) {
      const raw = v as any;
      if (v.registeredOwner) expect(isCanonicalOrganization(v.registeredOwner), `Vessel ${v.id} registeredOwner: ${v.registeredOwner}`).toBe(true);
      if (v.technicalManager) expect(isCanonicalOrganization(v.technicalManager), `Vessel ${v.id} technicalManager: ${v.technicalManager}`).toBe(true);
      if (v.ismCompany) expect(isCanonicalOrganization(v.ismCompany), `Vessel ${v.id} ismCompany: ${v.ismCompany}`).toBe(true);
      if (raw.operator) expect(isCanonicalOrganization(raw.operator), `Vessel ${v.id} operator: ${raw.operator}`).toBe(true);
      for (const ch of v.clientHistory || []) {
        if (ch.clientOrganization) expect(isCanonicalOrganization(ch.clientOrganization), `Vessel ${v.id} clientHistory: ${ch.clientOrganization}`).toBe(true);
      }
    }
  });

  it('ensures every organization string in equipment is in CANONICAL_ORGANIZATIONS', () => {
    for (const eq of MOCK_EQUIPMENT) {
      const raw = eq as any;
      if (eq.owningOrganization) expect(isCanonicalOrganization(eq.owningOrganization), `Equipment ${eq.id} owningOrg: ${eq.owningOrganization}`).toBe(true);
      if (raw.providerOrg) expect(isCanonicalOrganization(raw.providerOrg), `Equipment ${eq.id} providerOrg: ${raw.providerOrg}`).toBe(true);
    }
  });

  it('ensures every organization string in crew is in CANONICAL_ORGANIZATIONS', () => {
    for (const cr of MOCK_CREW) {
      if (cr.organization) expect(isCanonicalOrganization(cr.organization), `Crew ${cr.id} organization: ${cr.organization}`).toBe(true);
    }
  });

  it('ensures every organization string in operational/activity objects is in CANONICAL_ORGANIZATIONS', () => {
    const allObjects = [...SEEDED_ACTIVITY_OBJECTS, ...OIL_CO_PILOT_ASSURANCE_OBJECTS];
    for (const obj of allObjects) {
      if (obj.ownerOrganization) expect(isCanonicalOrganization(obj.ownerOrganization), `Object ${obj.id} ownerOrg: ${obj.ownerOrganization}`).toBe(true);
    }
  });

  it('ensures every organization profile is in CANONICAL_ORGANIZATIONS', () => {
    for (const prof of MOCK_ORGANIZATION_PROFILES) {
      expect(isCanonicalOrganization(prof.name), `Profile ${prof.id} name: ${prof.name}`).toBe(true);
    }
  });

  it('ensures each of the 7 certificate issuers has exactly one active Administrator and one active Verifier', () => {
    const storeUsers = useMapStore.getState().users;
    const issuers = [
      'ABS',
      'AMSA',
      'DNV',
      "Lloyd's Register",
      'RINA',
      'Gard P&I Club',
      'Australian Register of Ships',
    ];

    for (const issuer of issuers) {
      const admins = storeUsers.filter(
        (u) =>
          u.status === 'Active' &&
          Boolean(u.organization) &&
          orgFieldMatches(issuer, u.organization) &&
          u.roles.includes('Administrator'),
      );
      expect(admins, `Expected exactly 1 Administrator for issuer "${issuer}"`).toHaveLength(1);

      const verifiers = storeUsers.filter(
        (u) =>
          u.status === 'Active' &&
          Boolean(u.organization) &&
          orgFieldMatches(issuer, u.organization) &&
          u.roles.includes('Verifier'),
      );
      expect(verifiers, `Expected exactly 1 Verifier for issuer "${issuer}"`).toHaveLength(1);

      const otherRoles = storeUsers.filter(
        (u) =>
          u.status === 'Active' &&
          Boolean(u.organization) &&
          orgFieldMatches(issuer, u.organization) &&
          (u.roles.includes('Inspector') || u.roles.includes('Approver') || u.roles.includes('Submitter')),
      );
      expect(otherRoles, `Expected no other roles for issuer "${issuer}"`).toHaveLength(0);
    }
  });

  it('allows each certificate issuer to be chosen as the verifier organization and defaults their active verifier', () => {
    const storeUsers = useMapStore.getState().users;
    const issuers = [
      'ABS',
      'AMSA',
      'DNV',
      "Lloyd's Register",
      'RINA',
      'Gard P&I Club',
      'Australian Register of Ships',
    ];

    for (const issuer of issuers) {
      const verifier = defaultOrganizationVerifier(storeUsers, issuer);
      expect(verifier, `Expected default verifier for issuer "${issuer}"`).toBeDefined();
      expect(verifier?.roles).toContain('Verifier');
      expect(verifier?.organization).toBe(issuer);
      expect(verifier?.status).toBe('Active');
    }
  });
});

