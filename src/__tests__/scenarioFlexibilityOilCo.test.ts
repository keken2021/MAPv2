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
import { getRequestingParty, getRespondingParty } from '../utils/setParties';
import {
  getSetAssignedSubmitter,
  getSetAssignedVerifier,
  getSetAssignedApprover,
} from '../utils/setStakeholders';

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
    assuranceObjects: [
      {
        id: 'VES-OILCO-BUNKER-BARGE',
        type: 'vessel',
        name: 'Oilco Bunker Barge Aurora Supply',
        ownerOrganization: OIL_CO_ORG,
        identifier: '9876139',
      },
    ],
    parties: [
      { organization: NORTHWIND_ORG, role: 'Requesting party' },
      { organization: OIL_CO_ORG, role: 'Responding party' },
      { organization: COASTAL_ORG, role: 'Third party' },
    ],
    createdBy: {
      userId: 'USR-235',
      name: 'T. Okada',
      persona: 'C Admin',
    },
    submitters: [{ organization: OIL_CO_ORG, assignee: 'J. Hale (Oil Company)' }],
    stakeholders: {
      submitterName: 'J. Hale (Oil Company)',
      verifierName: 'N. Brooks (Coastal Fuel Testing)',
      approverName: 'C. Almeida (Coastal Fuel Testing)',
    },
    reviewMode: 'third_party',
    startDate: '2026-11-15',
    deadline: '2026-11-15',
    endDate: '2027-05-15',
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
    assuranceObjects: [
      {
        id: OIL_CO_ENDEAVOUR_ID,
        type: 'vessel',
        name: 'OSV Meridian Endeavour',
        ownerOrganization: MERIDIAN_ORG,
        identifier: '9876501',
      },
    ],
    parties: [
      { organization: OIL_CO_ORG, role: 'Requesting party' },
      { organization: KESTREL_ORG, role: 'Responding party' },
      { organization: SENTINEL_ORG, role: 'Third party' },
    ],
    createdBy: {
      userId: 'USR-228',
      name: 'A. Okonkwo',
      persona: 'C Admin',
    },
    submitters: [{ organization: KESTREL_ORG, assignee: 'A. Petrov (Kestrel Control Systems)' }],
    stakeholders: {
      submitterName: 'A. Petrov (Kestrel Control Systems)',
      verifierName: 'R. Singh (Sentinel Cyber Assurance)',
      approverName: 'K. Adeyemi (Oil Company)',
    },
    reviewMode: 'third_party',
    startDate: '2026-11-15',
    deadline: '2026-11-15',
    endDate: '2027-05-15',
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
      requestingParty: getRequestingParty(ss01Before),
      respondingParty: getRespondingParty(ss01Before),
      assignedSubmitter: getSetAssignedSubmitter(ss01Before),
      assignedVerifier: getSetAssignedVerifier(ss01Before),
      assignedApprover: getSetAssignedApprover(ss01Before),
      stage: ss01Before.stage,
    };

    const ss02Before = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS02_ID)!;
    const ss03Before = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS03_ID)!;
    expect(ss02Before.stage).toBe('Approved');
    expect(ss03Before.stage).toBe('Approved');

    const ss04 = buildSs04();
    const ss05 = buildSs05();

    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
    expect(
      useMapStore.getState().requestAssuranceSet({
        projectId: OIL_CO_LNG_PROJECT_ID,
        recipientUserId: 'USR-235',
        suggestedScope: 'Vessel',
        senderUserId: 'USR-228',
        senderName: 'A. Okonkwo',
      }).success,
    ).toBe(true);

    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: NORTHWIND_ORG,
      activeSessionUserId: 'USR-235',
    });
    useMapStore.getState().addAssuranceSet(ss04);
    expect(useMapStore.getState().attachAssuranceSetToProject(ss04.id, OIL_CO_LNG_PROJECT_ID).success).toBe(true);

    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
    useMapStore.getState().addAssuranceSet(ss05);
    expect(useMapStore.getState().attachAssuranceSetToProject(ss05.id, OIL_CO_LNG_PROJECT_ID).success).toBe(true);

    const northwindCAdminUser = {
      id: 'USR-235',
      name: 'T. Okada',
      organization: NORTHWIND_ORG,
      roles: ['C Admin' as const],
    };
    const storedSs04 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-104')!;
    expect(getRequestingParty(storedSs04)).toBe(NORTHWIND_ORG);
    expect(getRespondingParty(storedSs04)).toBe(OIL_CO_ORG);
    expect(getSetAssignedVerifier(storedSs04)).toContain(COASTAL_ORG);
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(storedSs04, NORTHWIND_ORG)).toBe(true);
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(storedSs04, MERIDIAN_ORG)).toBe(false);
    expect(isAssuranceSetAssignedToPersona(storedSs04, 'C Admin', NORTHWIND_ORG, northwindCAdminUser)).toBe(true);

    const storedSs05 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-105')!;
    expect(storedSs05.assuranceType).toBe('Equipment');
    expect(getRespondingParty(storedSs05)).toBe(KESTREL_ORG);
    expect(getSetAssignedVerifier(storedSs05)).toContain(SENTINEL_ORG);
    expect(storedSs05.requirements.length).toBeGreaterThan(0);

    const ss01After = useMapStore.getState().assuranceSets.find((s) => s.id === OIL_CO_SS01_ID)!;
    expect(getRequestingParty(ss01After)).toBe(ss01Snapshot.requestingParty);
    expect(getRespondingParty(ss01After)).toBe(ss01Snapshot.respondingParty);
    expect(getSetAssignedSubmitter(ss01After)).toBe(ss01Snapshot.assignedSubmitter);
    expect(getSetAssignedVerifier(ss01After)).toBe(ss01Snapshot.assignedVerifier);
    expect(getSetAssignedApprover(ss01After)).toBe(ss01Snapshot.assignedApprover);
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
