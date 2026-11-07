/*
  file summary: tests Scenario 2 from the architecture diagram:
    "Scenario 2: Client creates — Client (C Admin) creates the project and one or more assurance sets"
    "Each assurance set has its own ID, client, groups, tasks and outcome."
  responsibilities: tests client-driven project initiation, multi-set composition across different providers and assurance groups, independent entity integrity, and requirement structures.
  role in system: automated Vitest test suite executing under vitest run.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import {
  AUSTRAL_ORG,
  HARBOURLINE_ORG,
  KESTREL_ORG,
  MERIDIAN_ORG,
  NORTHWIND_ORG,
  OIL_CO_AURORA_ID,
  OIL_CO_ENDEAVOUR_ID,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_PILOT_PROJECT,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
  SENTINEL_ORG,
  XY_MARINE_ORG,
} from '../store/oilCoLngPilotMockData';
import {
  SUBTYPE_TEMPLATES,
  customRequirementFields,
} from '../utils/assuranceTemplates';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

describe('Scenario 2: Client creates', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  const project = MOCK_PROJECTS.find((p) => p.id === OIL_CO_LNG_PROJECT_ID) ?? OIL_CO_PILOT_PROJECT;
  const seededSets = PROJECT_SEED_ASSURANCE_SETS.filter((s) => s.projectId === OIL_CO_LNG_PROJECT_ID);

  it('creates the master project owned by Client (Oil Co)', () => {
    expect(project).toBeDefined();
    expect(project.name).toBe('Oil Company LNG Field Development');
    expect(project.ownerOrganization).toBe(OIL_CO_ORG);
    expect(project.requestingOrganization).toBe(OIL_CO_ORG);
    expect(project.clientOperator).toBe(OIL_CO_ORG);
    expect(project.operatorOrganization).toBe(OIL_CO_ORG);
    expect(project.charterer).toBe(OIL_CO_ORG);
  });

  it('establishes SS-01: LNG Transport Charter with Northwind Marine', () => {
    const ss01 = seededSets.find((s) => s.id === OIL_CO_SS01_ID);
    expect(ss01).toBeDefined();
    expect(ss01?.title).toBe('LNG Transport Charter');
    expect(ss01?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss01?.serviceProviderOrg).toBe(NORTHWIND_ORG);
    expect(ss01?.vesselId).toBe(OIL_CO_AURORA_ID);
    expect(ss01?.vesselName).toBe('LNGC Northwind Aurora');
    expect(ss01?.assignedVerifier).toContain(XY_MARINE_ORG);
    expect(ss01?.assignedApprover).toContain(XY_MARINE_ORG);
    expect(ss01?.requirements).toHaveLength(20);
    expect(ss01?.stage).toBe('Verification');
    expect(ss01?.approverDecision).toBe('Pending');
  });

  it('establishes SS-02: Vessel Purchase (OSV) with Meridian Shipyards', () => {
    const ss02 = seededSets.find((s) => s.id === OIL_CO_SS02_ID);
    expect(ss02).toBeDefined();
    expect(ss02?.title).toBe('Vessel Purchase (OSV)');
    expect(ss02?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss02?.serviceProviderOrg).toBe(MERIDIAN_ORG);
    expect(ss02?.vesselId).toBe(OIL_CO_ENDEAVOUR_ID);
    expect(ss02?.vesselName).toBe('OSV Meridian Endeavour');
    expect(ss02?.assignedVerifier).toContain(AUSTRAL_ORG);
    expect(ss02?.assignedApprover).toContain(XY_MARINE_ORG);
    expect(ss02?.requirements).toHaveLength(14);
    expect(ss02?.stage).toBe('Approved');
    expect(ss02?.approverDecision).toBe('Approved');
    expect(ss02?.readinessScore).toBe(100);
  });

  it('establishes SS-03: Terminal / Loading Ops with Harbourline Terminals', () => {
    const ss03 = seededSets.find((s) => s.id === OIL_CO_SS03_ID);
    expect(ss03).toBeDefined();
    expect(ss03?.title).toBe('Terminal / Loading Operations');
    expect(ss03?.clientOrg).toBe(OIL_CO_ORG);
    expect(ss03?.serviceProviderOrg).toBe(HARBOURLINE_ORG);
    expect(ss03?.assignedVerifier).toContain(XY_MARINE_ORG);
    expect(ss03?.requirements).toHaveLength(15);
    expect(ss03?.stage).toBe('Approved');
    expect(ss03?.approverDecision).toBe('Approved');
    expect(ss03?.readinessScore).toBe(100);
  });

  it('allows Client to create SS-05: IT / Control Systems with Kestrel Control Systems', () => {
    const template = SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss05-control-systems')!;
    expect(template).toBeDefined();
    expect(template.customRequirements).toHaveLength(13);

    const ss05Requirements: AssuranceRequirement[] = (template.customRequirements ?? []).map(
      (task, idx) => {
        const fields = customRequirementFields(task);
        return {
          id: `REQ-SS05-${String(idx + 1).padStart(2, '0')}`,
          category: fields.category,
          title: fields.title,
          description: fields.description,
          subtype: 'Equipment',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 92,
          verifierStatus: 'Verified',
        };
      },
    );

    const ss05Set: AssuranceSet = {
      id: 'AS-2026-105',
      title: 'IT / Control Systems Cyber Assurance',
      assuranceType: 'Equipment',
      subtypes: ['Equipment'],
      projectId: OIL_CO_LNG_PROJECT_ID,
      projectName: project.name,
      initiatorOrg: OIL_CO_ORG,
      initiatorRole: 'C Admin · Client Created',
      createdByPersona: 'C Admin',
      clientOrg: OIL_CO_ORG,
      charterer: OIL_CO_ORG,
      serviceProviderOrg: KESTREL_ORG,
      assignedSubmitter: 'A. Petrov (Kestrel Control Systems)',
      assignedVerifier: 'R. Singh (Sentinel Cyber Assurance)',
      assignedApprover: 'K. Adeyemi (Oil Company)',
      reviewMode: 'third_party',
      charterWindowStart: '2026-11-15',
      complianceDeadline: '2026-11-15',
      stage: 'Approved',
      approverDecision: 'Approved',
      readinessScore: 100,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: ss05Requirements,
      visibility: 'organization',
    };

    useMapStore.getState().addAssuranceSet(ss05Set);
    useMapStore.getState().attachAssuranceSetToProject(ss05Set.id, OIL_CO_LNG_PROJECT_ID);

    const createdSS05 = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-105');
    expect(createdSS05).toBeDefined();
    expect(createdSS05?.serviceProviderOrg).toBe(KESTREL_ORG);
    expect(createdSS05?.assignedVerifier).toContain(SENTINEL_ORG);
    expect(createdSS05?.requirements).toHaveLength(13);
    expect(createdSS05?.stage).toBe('Approved');
  });

  it('proves each assurance set has its own ID, client, groups, tasks and outcome', () => {
    const sets = [
      seededSets.find((s) => s.id === OIL_CO_SS01_ID)!,
      seededSets.find((s) => s.id === OIL_CO_SS02_ID)!,
      seededSets.find((s) => s.id === OIL_CO_SS03_ID)!,
    ];

    // 1. Each assurance set has its own distinct ID
    const ids = sets.map((s) => s.id);
    expect(new Set(ids).size).toBe(sets.length);

    // 2. Each assurance set has its own service provider and stakeholder groups
    expect(sets[0].serviceProviderOrg).toBe(NORTHWIND_ORG);
    expect(sets[1].serviceProviderOrg).toBe(MERIDIAN_ORG);
    expect(sets[2].serviceProviderOrg).toBe(HARBOURLINE_ORG);

    // 3. Each assurance set has its own independent tasks / requirements
    expect(sets[0].requirements.length).toBe(20);
    expect(sets[1].requirements.length).toBe(14);
    expect(sets[2].requirements.length).toBe(15);

    // 4. Each assurance set has its own stage and outcome
    expect(sets[0].stage).toBe('Verification');
    expect(sets[0].approverDecision).toBe('Pending');
    expect(sets[0].readinessScore).toBeLessThan(100);

    expect(sets[1].stage).toBe('Approved');
    expect(sets[1].approverDecision).toBe('Approved');
    expect(sets[1].readinessScore).toBe(100);

    expect(sets[2].stage).toBe('Approved');
    expect(sets[2].approverDecision).toBe('Approved');
    expect(sets[2].readinessScore).toBe(100);
  });
});

