import { describe, expect, it } from 'vitest';
import {
  OIL_CO_ORG,
  NORTHWIND_ORG,
  XY_MARINE_ORG,
  MERIDIAN_ORG,
  AUSTRAL_ORG,
  HARBOURLINE_ORG,
  COASTAL_ORG,
  KESTREL_ORG,
  SENTINEL_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
  OIL_CO_PILOT_ASSURANCE_SETS,
  OIL_CO_PILOT_PROJECT,
  OIL_CO_PILOT_USERS,
} from '../store/oilCoLngPilotMockData';
import { MOCK_USERS } from '../store/mockData';
import {
  defaultProviderSubmitter,
  canAssignStakeholderRole,
} from '../utils/userRoleHelpers';
import { canEditAssuranceSetStakeholders } from '../utils/rbacHelpers';
import { getAdminRoleForOrganization } from '../utils/organizationRegistry';
import { UserProfile } from '../types/user';
import { AssuranceSet } from '../types/assurance';

describe('Oil project walk-through (Step 4)', () => {
  const userMap = new Map<string, UserProfile>();
  for (const u of [...MOCK_USERS, ...OIL_CO_PILOT_USERS]) {
    userMap.set(u.id, u);
  }
  const allUsers = Array.from(userMap.values());

  const oilProjectOrgs = [
    OIL_CO_ORG,
    NORTHWIND_ORG,
    XY_MARINE_ORG,
    MERIDIAN_ORG,
    AUSTRAL_ORG,
    HARBOURLINE_ORG,
    COASTAL_ORG,
    KESTREL_ORG,
    SENTINEL_ORG,
    'NOPSEMA',
  ] as const;

  it('verifies all 10 Oil project organizations have an active Administrator (or C Admin for clients)', () => {
    for (const org of oilProjectOrgs) {
      const expectedRole = getAdminRoleForOrganization(org);
      const admin = allUsers.find(
        (u) =>
          u.status === 'Active' &&
          u.organization?.trim().toLowerCase() === org.trim().toLowerCase() &&
          u.roles.includes(expectedRole),
      );
      expect(admin, `Organization "${org}" must have an active ${expectedRole}`).toBeDefined();
      expect(admin?.status).toBe('Active');
    }
  });

  it('verifies defaultProviderSubmitter falls back to Administrator (or C Admin) when no Submitter exists', () => {
    for (const org of oilProjectOrgs) {
      const expectedRole = getAdminRoleForOrganization(org);
      const adminUser = allUsers.find(
        (u) =>
          u.status === 'Active' &&
          u.organization?.trim().toLowerCase() === org.trim().toLowerCase() &&
          u.roles.includes(expectedRole),
      )!;

      // Filter users to exclude any Submitter for this organization
      const usersWithoutSubmitter = allUsers.filter(
        (u) =>
          !(
            u.organization?.trim().toLowerCase() === org.trim().toLowerCase() &&
            u.roles.includes('Submitter')
          ),
      );

      const fallback = defaultProviderSubmitter(usersWithoutSubmitter, org);
      expect(
        fallback,
        `defaultProviderSubmitter for "${org}" should fall back to its ${expectedRole}`,
      ).toBeDefined();
      expect(fallback?.organization).toBe(org);
      expect(fallback?.roles).toContain(expectedRole);
      expect(fallback?.id).toBe(adminUser.id);
    }
  });

  it('verifies Northwind Marine Pty Ltd Administrator can edit their role slot on AS-2026-101 but not another slot', () => {
    const ss01 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS01_ID)!;
    const admin = allUsers.find((u) => u.organization === NORTHWIND_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(ss01, 'Administrator', NORTHWIND_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Submitter', NORTHWIND_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Verifier', NORTHWIND_ORG)).toBe(false);
    expect(canAssignStakeholderRole(ss01, 'Inspector', NORTHWIND_ORG)).toBe(false);
    expect(canAssignStakeholderRole(ss01, 'Approver', NORTHWIND_ORG)).toBe(false);
  });

  it('verifies XY Marine Assurance Administrator can edit their role slots on AS-2026-101 but not Submitter', () => {
    const ss01 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS01_ID)!;
    const admin = allUsers.find((u) => u.organization === XY_MARINE_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(ss01, 'Administrator', XY_MARINE_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Verifier', XY_MARINE_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Inspector', XY_MARINE_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Approver', XY_MARINE_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss01, 'Submitter', XY_MARINE_ORG)).toBe(false);
  });

  it('verifies Meridian Shipyards Administrator can edit their role slot on AS-2026-102 but not Verifier', () => {
    const ss02 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS02_ID)!;
    const editableSs02: AssuranceSet = { ...ss02, stage: 'Verification', approverDecision: undefined };
    const admin = allUsers.find((u) => u.organization === MERIDIAN_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(editableSs02, 'Administrator', MERIDIAN_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss02, 'Submitter', MERIDIAN_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss02, 'Verifier', MERIDIAN_ORG)).toBe(false);
  });

  it('verifies Austral Classification Society Administrator can edit their role slot on AS-2026-102 but not Submitter', () => {
    const ss02 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS02_ID)!;
    const editableSs02: AssuranceSet = { ...ss02, stage: 'Verification', approverDecision: undefined };
    const admin = allUsers.find((u) => u.organization === AUSTRAL_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(editableSs02, 'Administrator', AUSTRAL_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss02, 'Verifier', AUSTRAL_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss02, 'Submitter', AUSTRAL_ORG)).toBe(false);
  });

  it('verifies Harbourline Terminals Administrator can edit their role slot on AS-2026-103 but not Verifier', () => {
    const ss03 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS03_ID)!;
    const editableSs03: AssuranceSet = { ...ss03, stage: 'Verification', approverDecision: undefined };
    const admin = allUsers.find((u) => u.organization === HARBOURLINE_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(editableSs03, 'Administrator', HARBOURLINE_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss03, 'Submitter', HARBOURLINE_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss03, 'Verifier', HARBOURLINE_ORG)).toBe(false);
  });

  it('verifies Coastal Fuel Testing Administrator can edit their role slots on SS-04 but not Submitter', () => {
    const ss04 = {
      id: 'AS-2026-104',
      title: 'Bunkering / Fuel Supply',
      assuranceType: 'Vessel',
      projectId: OIL_CO_LNG_PROJECT_ID,
      clientOrg: NORTHWIND_ORG,
      serviceProviderOrg: OIL_CO_ORG,
      stakeholders: {
        submitterOrg: OIL_CO_ORG,
        verifierOrg: COASTAL_ORG,
        approverOrg: COASTAL_ORG,
      },
      stage: 'Initiated',
      requirements: [],
    } as unknown as AssuranceSet;
    const admin = allUsers.find((u) => u.organization === COASTAL_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(ss04, 'Administrator', COASTAL_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss04, 'Verifier', COASTAL_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss04, 'Approver', COASTAL_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss04, 'Submitter', COASTAL_ORG)).toBe(false);
  });

  it('verifies Kestrel Control Systems Administrator can edit their role slot on SS-05 but not Verifier', () => {
    const ss05 = {
      id: 'AS-2026-105',
      title: 'IT / Control Systems',
      assuranceType: 'Equipment',
      projectId: OIL_CO_LNG_PROJECT_ID,
      clientOrg: OIL_CO_ORG,
      serviceProviderOrg: KESTREL_ORG,
      stakeholders: {
        submitterOrg: KESTREL_ORG,
        verifierOrg: SENTINEL_ORG,
        approverOrg: OIL_CO_ORG,
      },
      stage: 'Initiated',
      requirements: [],
    } as unknown as AssuranceSet;
    const admin = allUsers.find((u) => u.organization === KESTREL_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(ss05, 'Administrator', KESTREL_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss05, 'Submitter', KESTREL_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss05, 'Verifier', KESTREL_ORG)).toBe(false);
  });

  it('verifies Sentinel Cyber Assurance Administrator can edit their role slot on SS-05 but not Submitter', () => {
    const ss05 = {
      id: 'AS-2026-105',
      title: 'IT / Control Systems',
      assuranceType: 'Equipment',
      projectId: OIL_CO_LNG_PROJECT_ID,
      clientOrg: OIL_CO_ORG,
      serviceProviderOrg: KESTREL_ORG,
      stakeholders: {
        submitterOrg: KESTREL_ORG,
        verifierOrg: SENTINEL_ORG,
        approverOrg: OIL_CO_ORG,
      },
      stage: 'Initiated',
      requirements: [],
    } as unknown as AssuranceSet;
    const admin = allUsers.find((u) => u.organization === SENTINEL_ORG && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(ss05, 'Administrator', SENTINEL_ORG, admin)).toBe(true);
    expect(canAssignStakeholderRole(ss05, 'Verifier', SENTINEL_ORG)).toBe(true);
    expect(canAssignStakeholderRole(ss05, 'Submitter', SENTINEL_ORG)).toBe(false);
  });

  it('verifies NOPSEMA Administrator can edit their role slot when assigned on a project set but not another organization slot', () => {
    const setWithNopsema = {
      id: 'AS-2026-106',
      title: 'Environmental Safety Case',
      assuranceType: 'Vessel',
      projectId: OIL_CO_LNG_PROJECT_ID,
      clientOrg: OIL_CO_ORG,
      serviceProviderOrg: NORTHWIND_ORG,
      stakeholders: {
        submitterOrg: NORTHWIND_ORG,
        inspectorOrg: 'NOPSEMA',
        approverOrg: OIL_CO_ORG,
      },
      stage: 'Initiated',
      requirements: [],
    } as unknown as AssuranceSet;
    const admin = allUsers.find((u) => u.organization === 'NOPSEMA' && u.roles.includes('Administrator'))!;

    expect(canEditAssuranceSetStakeholders(setWithNopsema, 'Administrator', 'NOPSEMA', admin)).toBe(true);
    expect(canAssignStakeholderRole(setWithNopsema, 'Inspector', 'NOPSEMA')).toBe(true);
    expect(canAssignStakeholderRole(setWithNopsema, 'Submitter', 'NOPSEMA')).toBe(false);
  });

  it('verifies Oil Company C Admin can edit stakeholders as set creator / client on AS-2026-101', () => {
    const ss01 = OIL_CO_PILOT_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS01_ID)!;
    const admin = allUsers.find((u) => u.organization === OIL_CO_ORG && u.roles.includes('C Admin'))!;

    expect(canEditAssuranceSetStakeholders(ss01, 'C Admin', OIL_CO_ORG, admin)).toBe(true);
  });
});
