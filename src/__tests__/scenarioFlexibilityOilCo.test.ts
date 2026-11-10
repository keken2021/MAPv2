/*
  file summary: composed Oil Co flexibility proof — five-set roll-up, role reversal, ownership isolation, and finished-set stability in one place.
  responsibilities: attaches SS-04 (Northwind client / Oil Co provider) and SS-05 (equipment) to MAP-PROJ-2026-MARINE-017, then asserts project dynamics.
  role in system: Vitest coverage for docs/scenario-flexibility-matrix.md UC-A3–A5 and UC-B1–B3/B5.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import {
  COASTAL_ORG,
  KESTREL_ORG,
  MERIDIAN_ORG,
  NORTHWIND_ORG,
  OIL_CO_ENDEAVOUR_ID,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
  SENTINEL_ORG,
} from '../store/oilCoLngPilotMockData';
import {
  calculateProjectReadiness,
  deriveProjectStatus,
  getProjectAssuranceSets,
} from '../utils/projectHelpers';
import {
  isAssuranceSetAssignedToPersona,
  isAssuranceSetOwnedOrInitiatedByOrganization,
} from '../utils/rbacHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import {
  SUBTYPE_TEMPLATES,
  customRequirementFields,
} from '../utils/assuranceTemplates';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

function requirementsFromTemplate(templateId: string, subtype: 'Vessel' | 'Equipment'): AssuranceRequirement[] {
  const template = SUBTYPE_TEMPLATES.find((t) => t.id === templateId)!;
  return (template.customRequirements ?? []).map((task, idx) => {
    const fields = customRequirementFields(task);
    return {
      id: `REQ-FLEX-${templateId}-${String(idx + 1).padStart(2, '0')}`,
      category: fields.category,
      title: task.title,
      description: task.description,
      subtype,
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending' as const,
    };
  });
}

function buildSs04(): AssuranceSet {
  return {
    id: 'AS-2026-104',
    title: 'Bunkering / Fuel Supply',
    assuranceType: 'Vessel',
    subtypes: ['Vessel'],
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: 'Oil Company LNG Field Development',
    vesselId: 'VES-OILCO-BUNKER-BARGE',
    vesselName: 'BB Oilco Bunker Barge 01',
    imoNumber: '9876139',
    initiatorOrg: NORTHWIND_ORG,
    initiatorRole: 'C Admin · Client Created',
    createdByPersona: 'C Admin',
    createdByName: 'T. Okada',
    clientOrg: NORTHWIND_ORG,
    charterer: NORTHWIND_ORG,
    serviceProviderOrg: OIL_CO_ORG,
    assignedSubmitter: 'J. Hale (Oil Company)',
    assignedVerifier: 'N. Brooks (Coastal Fuel Testing)',
    assignedApprover: 'C. Almeida (Coastal Fuel Testing)',
    reviewMode: 'third_party',
    charterWindowStart: '2026-11-15',
    complianceDeadline: '2026-11-15',
    charterWindowEnd: '2027-05-15',
    stage: 'Initiated',
    readinessScore: 10,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    requirements: requirementsFromTemplate('tmpl-pub-ss04-bunkering', 'Vessel'),
    visibility: 'organization',
  };
}

function buildSs05(): AssuranceSet {
  return {
    id: 'AS-2026-105',
    title: 'IT / Control Systems',
    assuranceType: 'Equipment',
    subtypes: ['Equipment'],
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: 'Oil Company LNG Field Development',
    initiatorOrg: OIL_CO_ORG,
    clientOrg: OIL_CO_ORG,
    charterer: OIL_CO_ORG,
    serviceProviderOrg: KESTREL_ORG,
    /* attach needs a project asset; reuse Endeavour already on the LNG project (same as finishedSetsStayApproved) */
    vesselId: OIL_CO_ENDEAVOUR_ID,
    vesselName: 'OSV Meridian Endeavour',
    imoNumber: '9876501',
    initiatorRole: 'C Admin · Client Created',
    createdByPersona: 'C Admin',
    assignedSubmitter: 'A. Petrov (Kestrel Control Systems)',
    assignedVerifier: 'R. Singh (Sentinel Cyber Assurance)',
    assignedApprover: 'K. Adeyemi (Oil Company)',
    reviewMode: 'third_party',
    charterWindowStart: '2026-11-15',
    complianceDeadline: '2026-11-15',
    charterWindowEnd: '2027-05-15',
    stage: 'Initiated',
    readinessScore: 10,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    requirements: requirementsFromTemplate('tmpl-pub-ss05-control-systems', 'Equipment'),
    visibility: 'organization',
  };
}

describe('Scenario flexibility: Oil Co five-set spine', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('keeps SS-01 parties stable while adding role-reversed SS-04 and equipment SS-05, then rolls up to Ready', () => {
    const ss01Before = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS01_ID)!;
    const ss01Snapshot = {
      clientOrg: ss01Before.clientOrg,
      serviceProviderOrg: ss01Before.serviceProviderOrg,
      assignedSubmitter: ss01Before.assignedSubmitter,
      assignedVerifier: ss01Before.assignedVerifier,
      assignedApprover: ss01Before.assignedApprover,
      stage: ss01Before.stage,
    };

    const ss02Before = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS02_ID)!;
    const ss03Before = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS03_ID)!;
    expect(ss02Before.stage).toBe('Approved');
    expect(ss03Before.stage).toBe('Approved');

    const ss04 = buildSs04();
    const ss05 = buildSs05();

    useMapStore.getState().addAssuranceSet(ss04);
    expect(useMapStore.getState().attachAssuranceSetToProject(ss04.id, OIL_CO_LNG_PROJECT_ID).success).toBe(true);

    useMapStore.getState().addAssuranceSet(ss05);
    expect(useMapStore.getState().attachAssuranceSetToProject(ss05.id, OIL_CO_LNG_PROJECT_ID).success).toBe(true);

    const storedSs04 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-104')!;
    expect(storedSs04.clientOrg).toBe(NORTHWIND_ORG);
    expect(storedSs04.serviceProviderOrg).toBe(OIL_CO_ORG);
    expect(storedSs04.assignedVerifier).toContain(COASTAL_ORG);
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(storedSs04, NORTHWIND_ORG)).toBe(true);
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(storedSs04, MERIDIAN_ORG)).toBe(false);
    expect(isAssuranceSetAssignedToPersona(storedSs04, 'C Admin', NORTHWIND_ORG)).toBe(true);

    const storedSs05 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-105')!;
    expect(storedSs05.assuranceType).toBe('Equipment');
    expect(storedSs05.serviceProviderOrg).toBe(KESTREL_ORG);
    expect(storedSs05.assignedVerifier).toContain(SENTINEL_ORG);
    expect(storedSs05.requirements.length).toBeGreaterThan(0);

    const ss01After = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS01_ID)!;
    expect(ss01After.clientOrg).toBe(ss01Snapshot.clientOrg);
    expect(ss01After.serviceProviderOrg).toBe(ss01Snapshot.serviceProviderOrg);
    expect(ss01After.assignedSubmitter).toBe(ss01Snapshot.assignedSubmitter);
    expect(ss01After.assignedVerifier).toBe(ss01Snapshot.assignedVerifier);
    expect(ss01After.assignedApprover).toBe(ss01Snapshot.assignedApprover);
    expect(ss01After.stage).toBe(ss01Snapshot.stage);

    const ss02After = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS02_ID)!;
    const ss03After = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS03_ID)!;
    expect(ss02After.stage).toBe('Approved');
    expect(ss02After.approverDecision).toBe('Approved');
    expect(ss03After.stage).toBe('Approved');
    expect(ss03After.approverDecision).toBe('Approved');

    const allSets = useMapStore.getState().assuranceSets;
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    const projectSets = getProjectAssuranceSets(project, allSets);
    expect(projectSets.map((s) => s.id).sort()).toEqual(
      [OIL_CO_SS01_ID, OIL_CO_SS02_ID, OIL_CO_SS03_ID, 'AS-2026-104', 'AS-2026-105'].sort(),
    );
    expect(projectSets).toHaveLength(5);

    const scores = projectSets.map((s) => calculateAssuranceSetReadiness(s, allSets));
    const expectedAverage = Math.round(scores.reduce((a, b) => a + b, 0) / 5);
    expect(calculateProjectReadiness(project, allSets)).toBe(expectedAverage);
    expect(deriveProjectStatus(project, allSets)).toBe('Assurance In Progress');

    const approvedSets = allSets.map((s) =>
      s.projectId === OIL_CO_LNG_PROJECT_ID
        ? {
            ...s,
            stage: 'Approved' as const,
            approverDecision: 'Approved' as const,
            readinessScore: 100,
            requirements: (s.requirements || []).map((r) => ({
              ...r,
              isFulfilled: true,
              verifierStatus: 'Verified' as const,
            })),
          }
        : s,
    );
    expect(calculateProjectReadiness(project, approvedSets)).toBe(100);
    expect(deriveProjectStatus(project, approvedSets)).toBe('Ready for Charter');

    // seed baseline still present for the three durable sets
    expect(PROJECT_SEED_ASSURANCE_SETS.some((s) => s.id === OIL_CO_SS01_ID)).toBe(true);
    expect(PROJECT_SEED_ASSURANCE_SETS.some((s) => s.id === OIL_CO_SS02_ID)).toBe(true);
    expect(PROJECT_SEED_ASSURANCE_SETS.some((s) => s.id === OIL_CO_SS03_ID)).toBe(true);
  });
});
