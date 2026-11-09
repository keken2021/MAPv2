/*
  file summary: tests Scenario 3 and Master Project Roll-up from the architecture diagram:
    "Scenario 3: Multi-party project — Other parties add sets to the same project and own the sets they start"
    "MASTER PROJECT: Oil Co LNG Field Development — Roll-up progress across all assurance sets (SS-01 to SS-05)"
    "SS-04: Bunkering / Fuel Supply (Client: Northwind Marine, Service Provider: Oil Co, Assurance: Coastal Fuel Testing)"
  responsibilities: tests multi-party set addition by non-project owners, role reversal semantics, ownership isolation, 5-set aggregate readiness calculations, and status progression.
  role in system: automated Vitest test suite executing under vitest run.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import {
  COASTAL_ORG,
  KESTREL_ORG,
  MERIDIAN_ORG,
  NORTHWIND_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
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

describe('Scenario 3: Multi-party project and Master Project Roll-Up', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('allows another party (Northwind Marine) to add SS-04 to Oil Co master project with role reversal', () => {
    const template = SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss04-bunkering')!;
    expect(template).toBeDefined();
    expect(template.customRequirements).toHaveLength(11);

    const ss04Requirements: AssuranceRequirement[] = (template.customRequirements ?? []).map(
      (task, idx) => {
        const fields = customRequirementFields(task);
        return {
          id: `REQ-SS04-${String(idx + 1).padStart(2, '0')}`,
          category: fields.category,
          title: task.title,
          description: task.description,
          subtype: 'Vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        };
      },
    );

    // In SS-04: Northwind Marine is the Client (purchasing fuel); Oil Co is the Service Provider (fuel supplier)
    const ss04Set: AssuranceSet = {
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
      requirements: ss04Requirements,
      visibility: 'organization',
    };

    // 1. Non-project owner adds set to the project
    useMapStore.getState().addAssuranceSet(ss04Set);
    const attachResult = useMapStore.getState().attachAssuranceSetToProject(ss04Set.id, OIL_CO_LNG_PROJECT_ID);
    expect(attachResult.success).toBe(true);

    const storedSS04 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-104');
    expect(storedSS04).toBeDefined();

    // 2. Role reversal verified: Northwind is the Client, Oil Company is the Service Provider
    expect(storedSS04?.clientOrg).toBe(NORTHWIND_ORG);
    expect(storedSS04?.serviceProviderOrg).toBe(OIL_CO_ORG);
    expect(storedSS04?.assignedVerifier).toContain(COASTAL_ORG);
    expect(storedSS04?.assignedApprover).toContain(COASTAL_ORG);
  });

  it('enforces ownership isolation: Northwind owns the set it started, not other parties', () => {
    const ss04Set: AssuranceSet = {
      id: 'AS-2026-104',
      title: 'Bunkering / Fuel Supply',
      assuranceType: 'Vessel',
      subtypes: ['Vessel'],
      projectId: OIL_CO_LNG_PROJECT_ID,
      initiatorOrg: NORTHWIND_ORG,
      clientOrg: NORTHWIND_ORG,
      serviceProviderOrg: OIL_CO_ORG,
      vesselId: 'VES-OILCO-BUNKER-BARGE',
      vesselName: 'BB Oilco Bunker Barge 01',
      imoNumber: '9876139',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-15',
      charterWindowEnd: '2027-05-15',
      complianceDeadline: '2026-11-15',
      stage: 'Initiated',
      readinessScore: 10,
      requirements: [],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
    };

    useMapStore.getState().addAssuranceSet(ss04Set);

    // Northwind initiated and is client -> Northwind owns the set
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(ss04Set, NORTHWIND_ORG)).toBe(true);

    // Meridian Shipyards is on the project (SS-02) but does not own SS-04
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(ss04Set, MERIDIAN_ORG)).toBe(false);

    // Northwind user can view and manage their initiated set
    expect(isAssuranceSetAssignedToPersona(ss04Set, 'C Admin', NORTHWIND_ORG)).toBe(true);
  });

  it('rolls up progress across all 5 assurance sets on Master Project Oil Co LNG Field Development', () => {
    const store = useMapStore.getState();

    // SS-01, SS-02, SS-03 already seeded
    const ss01 = PROJECT_SEED_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS01_ID)!;
    const ss02 = PROJECT_SEED_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS02_ID)!;
    const ss03 = PROJECT_SEED_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS03_ID)!;

    // Attach SS-04 (Bunkering, 10% readiness)
    const ss04: AssuranceSet = {
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
      clientOrg: NORTHWIND_ORG,
      serviceProviderOrg: OIL_CO_ORG,
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-15',
      charterWindowEnd: '2027-05-15',
      complianceDeadline: '2026-11-15',
      stage: 'Initiated',
      readinessScore: 10,
      requirements: [],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
    };

    // Attach SS-05 (IT / Control Systems, 100% readiness)
    const ss05: AssuranceSet = {
      id: 'AS-2026-105',
      title: 'IT / Control Systems',
      assuranceType: 'Equipment',
      subtypes: ['Equipment'],
      projectId: OIL_CO_LNG_PROJECT_ID,
      projectName: 'Oil Company LNG Field Development',
      initiatorOrg: OIL_CO_ORG,
      clientOrg: OIL_CO_ORG,
      serviceProviderOrg: KESTREL_ORG,
      vesselId: '',
      vesselName: '',
      imoNumber: '',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-15',
      charterWindowEnd: '2027-05-15',
      complianceDeadline: '2026-11-15',
      stage: 'Approved',
      approverDecision: 'Approved',
      readinessScore: 100,
      requirements: [],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
    };

    store.addAssuranceSet(ss04);
    store.attachAssuranceSetToProject(ss04.id, OIL_CO_LNG_PROJECT_ID);

    store.addAssuranceSet(ss05);
    store.attachAssuranceSetToProject(ss05.id, OIL_CO_LNG_PROJECT_ID);

    const allSets = useMapStore.getState().assuranceSets;
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;

    // 1. Confirm all 5 sets are linked to the master project
    const projectSets = getProjectAssuranceSets(project, allSets);
    const setIds = projectSets.map((s) => s.id);
    expect(setIds).toContain(OIL_CO_SS01_ID);
    expect(setIds).toContain(OIL_CO_SS02_ID);
    expect(setIds).toContain(OIL_CO_SS03_ID);
    expect(setIds).toContain('AS-2026-104');
    expect(setIds).toContain('AS-2026-105');
    expect(projectSets.length).toBe(5);

    // 2. Confirm mathematical average roll-up progress across all 5 sets
    const individualScores = projectSets.map((s) => calculateAssuranceSetReadiness(s, allSets));
    const expectedAverage = Math.round(individualScores.reduce((a, b) => a + b, 0) / 5);

    const rolledUpScore = calculateProjectReadiness(project, allSets);
    expect(rolledUpScore).toBe(expectedAverage);

    // 3. Confirm project status evaluates to Assurance In Progress while any set is pending
    expect(deriveProjectStatus(project, allSets)).toBe('Assurance In Progress');

    // 4. Confirm project status evaluates to Ready for Charter once all 5 sets reach Approved
    const approvedSets = allSets.map((s) =>
      s.projectId === OIL_CO_LNG_PROJECT_ID
        ? {
            ...s,
            stage: 'Approved' as const,
            approverDecision: 'Approved' as const,
            readinessScore: 100,
          }
        : s,
    );

    const finalRollup = calculateProjectReadiness(project, approvedSets);
    expect(finalRollup).toBe(100);

    const finalStatus = deriveProjectStatus(project, approvedSets);
    expect(finalStatus).toBe('Ready for Charter');
  });
});

