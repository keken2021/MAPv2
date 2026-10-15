/*
  file summary: finished Oil Company sets must stay approved when later sets are created on the same vessels.
  responsibilities: reproduces the SS-04 and SS-05 creation path and a verification of a shared library document.
  role in system: vitest coverage for the live demonstration.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { SUBTYPE_TEMPLATES, customRequirementFields } from '../utils/assuranceTemplates';
import { calculateProjectReadiness } from '../utils/projectHelpers';
import { calculateAssuranceSetReadiness, calculateVesselReadiness } from '../utils/readinessHelpers';
import {
  OIL_CO_AURORA_ID,
  OIL_CO_ENDEAVOUR_ID,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_SS01_ID,
  OIL_CO_SS02_ID,
  OIL_CO_SS03_ID,
} from '../store/oilCoLngPilotMockData';

const initialState = useMapStore.getState();
const FINISHED = [OIL_CO_SS01_ID, OIL_CO_SS02_ID, OIL_CO_SS03_ID];

function requirementsFromTemplate(templateId: string): AssuranceRequirement[] {
  const template = SUBTYPE_TEMPLATES.find((item) => item.id === templateId);
  return (template?.customRequirements ?? []).map((task, index) => {
    const fields = customRequirementFields(task);
    return {
      id: `req-${templateId}-${index}`,
      category: fields.category,
      title: task.title,
      description: task.description,
      subtype: fields.requirementSubtype ?? undefined,
      isMandatory: true,
      isSpecialized: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending' as const,
    };
  });
}

function buildLiveSet(
  id: string,
  title: string,
  vesselId: string,
  vesselName: string,
  templateId: string,
): AssuranceSet {
  return {
    id,
    title,
    assuranceType: 'Vessel',
    subtypes: ['Vessel'],
    vesselId,
    vesselName,
    imoNumber: vesselId === OIL_CO_AURORA_ID ? '9694417' : '9941186',
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: 'Oil Company LNG Field Development',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    initiatorRole: 'C Admin · Client Created',
    charterWindowStart: '2026-11-18',
    charterWindowEnd: '2026-11-20',
    stage: 'Initiated',
    readinessScore: 10,
    mandatoryInspectionRequired: true,
    inspectionCompleted: false,
    verificationRequired: true,
    formalApprovalRequired: true,
    requirements: requirementsFromTemplate(templateId),
    visibility: 'organization',
    clientOrg: 'Northwind Marine Pty Ltd',
    serviceProviderOrg: 'Oil Company',
    assignedSubmitter: 'J. Hale (Oil Company)',
    assignedVerifier: 'N. Brooks (Coastal Fuel Testing)',
    assignedInspector: 'F. Ibarra (Coastal Fuel Testing)',
    assignedApprover: 'C. Almeida (Coastal Fuel Testing)',
  };
}

function finishedSnapshot() {
  const state = useMapStore.getState();
  const project = state.projects.find((item) => item.id === OIL_CO_LNG_PROJECT_ID)!;
  return {
    sets: FINISHED.map((id) => {
      const set = state.assuranceSets.find((item) => item.id === id)!;
      return {
        id,
        stage: set.stage,
        decision: set.approverDecision,
        score: calculateAssuranceSetReadiness(set, state.assuranceSets),
        verified: set.requirements.filter((req) => req.verifierStatus === 'Verified').length,
        total: set.requirements.length,
      };
    }),
    project: calculateProjectReadiness(project, state.assuranceSets),
    aurora: calculateVesselReadiness(
      state.vessels.find((vessel) => vessel.id === OIL_CO_AURORA_ID)!,
      state.assuranceSets,
      state.documents,
    ),
    endeavour: calculateVesselReadiness(
      state.vessels.find((vessel) => vessel.id === OIL_CO_ENDEAVOUR_ID)!,
      state.assuranceSets,
      state.documents,
    ),
  };
}

describe('finished pilot sets stay approved', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('keeps SS-01, SS-02 and SS-03 at 100 after SS-04 and SS-05 are created and a shared document is verified', () => {
    const before = finishedSnapshot();
    expect(before.sets.map((set) => set.score)).toEqual([100, 100, 100]);

    useMapStore.getState().addAssuranceSet(
      buildLiveSet(
        'AS-2026-104',
        'SS-04 Fuel Supply and Bunkering',
        OIL_CO_AURORA_ID,
        'LNGC Northwind Aurora',
        'tmpl-pub-ss04-bunkering',
      ),
    );
    useMapStore.getState().attachAssuranceSetToProject('AS-2026-104', OIL_CO_LNG_PROJECT_ID);

    useMapStore.getState().addAssuranceSet(
      buildLiveSet(
        'AS-2026-105',
        'SS-05 Control Systems Cyber Assurance',
        OIL_CO_ENDEAVOUR_ID,
        'OSV Meridian Endeavour',
        'tmpl-pub-ss05-control-systems',
      ),
    );
    useMapStore.getState().attachAssuranceSetToProject('AS-2026-105', OIL_CO_LNG_PROJECT_ID);

    const afterCreate = finishedSnapshot();
    expect(afterCreate.sets).toEqual(before.sets);

    const created = useMapStore.getState().assuranceSets.find((set) => set.id === 'AS-2026-104')!;
    const shared = created.requirements.find((req) => req.documentId);
    const libraryDocument = useMapStore
      .getState()
      .assuranceSets.find((set) => set.id === OIL_CO_SS01_ID)!
      .requirements.find((req) => req.documentId);

    if (shared?.documentId) {
      useMapStore.getState().verifyDocument(shared.documentId, 'Verified', 'Verified on SS-04.', undefined, shared.id);
    }
    if (libraryDocument?.documentId) {
      useMapStore
        .getState()
        .verifyDocument(libraryDocument.documentId, 'Verified', 'Verified without a requirement id.');
    }

    const afterVerify = finishedSnapshot();
    expect(afterVerify.sets).toEqual(before.sets);
  });
});
