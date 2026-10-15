/*
  file summary: checks the Oil Company LNG Field Development pilot seed against BRD v4.1 SS-01, SS-02 and SS-03, and the live SS-04 and SS-05 creation path.
  responsibilities: confirms the master project, parties, required evidence and segregation of submitter from verifier and approver.
  role in system: vitest coverage for the localhost demonstration data.
*/

import { describe, expect, it } from 'vitest';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { filterProjectsForPersona, getAssuranceSetRequestRecipients, withProjectVessels } from '../utils/projectHelpers';
import { SUBTYPE_TEMPLATES, customRequirementFields, getThreePillarsCategory } from '../utils/assuranceTemplates';
import { resolveAssuranceRequestSetClient } from '../utils/notificationHelpers';
import { ThreePillarsCategory } from '../types/assurance';
import { MOCK_USERS } from '../store/mockData';
import {
  AUSTRAL_ORG,
  HARBOURLINE_ORG,
  MERIDIAN_ORG,
  NORTHWIND_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
  OIL_CO_AURORA_ID,
  OIL_CO_ENDEAVOUR_ID,
  KESTREL_ORG,
  COASTAL_ORG,
  SENTINEL_ORG,
  XY_MARINE_ORG,
} from '../store/oilCoLngPilotMockData';
import { getAssuranceSetRoleActions, isAssuranceSetAssignedToPersona, orgFieldMatches } from '../utils/rbacHelpers';

describe('Oil Co LNG Field Development pilot', () => {
  const project = MOCK_PROJECTS.find((item) => item.id === OIL_CO_LNG_PROJECT_ID);
  const sets = PROJECT_SEED_ASSURANCE_SETS.filter((set) => set.projectId === OIL_CO_LNG_PROJECT_ID);

  it('places SS-01, SS-02 and SS-03 on the Oil Company master project', () => {
    expect(project?.name).toBe('Oil Company LNG Field Development');
    expect(project?.ownerOrganization).toBe(OIL_CO_ORG);
    expect(sets.map((set) => set.id).sort()).toEqual(
      [OIL_CO_SS01_ID, OIL_CO_SS02_ID, OIL_CO_SS03_ID].sort(),
    );
    expect(sets.some((set) => set.title.startsWith('SS-04') || set.title.startsWith('SS-05'))).toBe(false);
    expect(
      filterProjectsForPersona(MOCK_PROJECTS, 'C Admin', MOCK_USERS, [], NORTHWIND_ORG).some(
        (item) => item.id === OIL_CO_LNG_PROJECT_ID,
      ),
    ).toBe(true);
    expect(
      filterProjectsForPersona(MOCK_PROJECTS, 'Submitter', MOCK_USERS, [], OIL_CO_ORG).some(
        (item) => item.id === OIL_CO_LNG_PROJECT_ID,
      ),
    ).toBe(true);
  });

  it('names the BRD client, provider and assurance parties', () => {
    const ss01 = sets.find((set) => set.id === OIL_CO_SS01_ID);
    const ss02 = sets.find((set) => set.id === OIL_CO_SS02_ID);
    const ss03 = sets.find((set) => set.id === OIL_CO_SS03_ID);

    expect(ss01?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss01?.serviceProviderOrg).toBe(NORTHWIND_ORG);
    expect(ss01?.assignedVerifier).toContain(XY_MARINE_ORG);
    expect(ss01?.assignedApprover).toContain(XY_MARINE_ORG);

    expect(ss02?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss02?.serviceProviderOrg).toBe(MERIDIAN_ORG);
    expect(ss02?.assignedVerifier).toContain(AUSTRAL_ORG);
    expect(ss02?.assignedApprover).toContain(XY_MARINE_ORG);

    expect(ss03?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss03?.serviceProviderOrg).toBe(HARBOURLINE_ORG);
    expect(ss03?.assignedVerifier).toContain(XY_MARINE_ORG);
    expect(ss03?.requirements.some((req) => req.notes === 'Issuing-authority review')).toBe(true);
  });

  it('carries the BRD required evidence and keeps providers off review', () => {
    expect(sets.find((set) => set.id === OIL_CO_SS01_ID)?.requirements).toHaveLength(20);
    expect(sets.find((set) => set.id === OIL_CO_SS02_ID)?.requirements).toHaveLength(14);
    expect(sets.find((set) => set.id === OIL_CO_SS03_ID)?.requirements).toHaveLength(15);

    const solas = sets
      .find((set) => set.id === OIL_CO_SS01_ID)
      ?.requirements.find((req) => req.id === 'REQ-SS01-10');
    expect(solas?.verifierStatus).toBe('Verified');
    expect(solas?.documentId).toBeTruthy();
    sets.forEach((set) => {
      expect(set.stage, set.id).toBe('Approved');
      expect(set.approverDecision, set.id).toBe('Approved');
      expect(set.readinessScore, set.id).toBe(100);
      expect(set.requirements.every((req) => req.verifierStatus === 'Verified' && req.documentId)).toBe(true);
    });

    sets.forEach((set) => {
      expect(orgFieldMatches(set.serviceProviderOrg || '', set.assignedVerifier || '')).toBe(false);
      expect(orgFieldMatches(set.serviceProviderOrg || '', set.assignedApprover || '')).toBe(false);
      [set.assignedSubmitter, set.assignedVerifier, set.assignedInspector, set.assignedApprover]
        .filter(Boolean)
        .forEach((assignee) => {
          const org = assignee!.slice(assignee!.indexOf('(') + 1, assignee!.lastIndexOf(')'));
          expect(MOCK_USERS.some((user) => user.status === 'Active' && assignee!.startsWith(user.name) && user.organization === org)).toBe(true);
        });
    });
  });

  it('keeps the SS-04 and SS-05 appointees available and the seeded parties on their own actions', () => {
    const ss01 = sets.find((set) => set.id === OIL_CO_SS01_ID)!;

    expect(MOCK_USERS.some((user) => user.name === 'T. Okada' && user.organization === NORTHWIND_ORG && user.roles.includes('C Admin') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'J. Hale' && user.organization === OIL_CO_ORG && user.roles.includes('Submitter') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'N. Brooks' && user.organization === COASTAL_ORG && user.roles.includes('Verifier') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'F. Ibarra' && user.organization === COASTAL_ORG && user.roles.includes('Inspector') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'C. Almeida' && user.organization === COASTAL_ORG && user.roles.includes('Approver') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'A. Petrov' && user.organization === KESTREL_ORG && user.roles.includes('Submitter') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'R. Singh' && user.organization === SENTINEL_ORG && user.roles.includes('Verifier') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'M. Laurent' && user.organization === SENTINEL_ORG && user.roles.includes('Inspector') && user.status === 'Active')).toBe(true);
    expect(MOCK_USERS.some((user) => user.name === 'K. Adeyemi' && user.organization === OIL_CO_ORG && user.roles.includes('Approver') && user.status === 'Active')).toBe(true);

    expect(isAssuranceSetAssignedToPersona(ss01, 'Submitter', OIL_CO_ORG)).toBe(false);
    expect(getAssuranceSetRoleActions(ss01, 'C Admin', NORTHWIND_ORG).canVerify).toBe(false);
  });

  it('lets Oil Company ask Northwind to create SS-04 as the client', () => {
    const recipients = getAssuranceSetRequestRecipients(
      MOCK_USERS,
      OIL_CO_ORG,
      project?.invitedOrganizations,
      'USR-228',
    );
    expect(recipients.some((user) => user.name === 'T. Okada' && user.organization === NORTHWIND_ORG)).toBe(true);
    expect(recipients.some((user) => user.id === 'USR-228')).toBe(false);
    expect(resolveAssuranceRequestSetClient(NORTHWIND_ORG, {
      clientOrganization: OIL_CO_ORG,
      project: project!,
    })).toBe(NORTHWIND_ORG);
    expect(resolveAssuranceRequestSetClient(OIL_CO_ORG, {
      clientOrganization: OIL_CO_ORG,
      project: project!,
    })).toBe(OIL_CO_ORG);
  });

  it('offers Aurora and Endeavour on the project and the BRD evidence templates', () => {
    const choices = withProjectVessels([], [{ id: OIL_CO_AURORA_ID }, { id: OIL_CO_ENDEAVOUR_ID }, { id: 'other' }], project);
    expect(choices.map((vessel) => vessel.id)).toEqual([OIL_CO_AURORA_ID, OIL_CO_ENDEAVOUR_ID]);

    const pillarsOf = (templateId: string) => {
      const template = SUBTYPE_TEMPLATES.find((item) => item.id === templateId);
      expect(template?.recommendedDocIds).toEqual([]);
      return (template?.customRequirements ?? []).map((task) => {
        const fields = customRequirementFields(task);
        return getThreePillarsCategory(fields.requirementSubtype ?? undefined, fields.category);
      });
    };
    const count = (pillars: ThreePillarsCategory[], pillar: ThreePillarsCategory) =>
      pillars.filter((item) => item === pillar).length;

    const bunker = pillarsOf('tmpl-pub-ss04-bunkering');
    expect(bunker).toHaveLength(11);
    expect(count(bunker, 'People')).toBe(2);
    expect(count(bunker, 'Plant')).toBe(3);
    expect(count(bunker, 'Process')).toBe(6);

    const control = pillarsOf('tmpl-pub-ss05-control-systems');
    expect(control).toHaveLength(13);
    expect(count(control, 'People')).toBe(3);
    expect(count(control, 'Plant')).toBe(4);
    expect(count(control, 'Process')).toBe(6);
  });
});
