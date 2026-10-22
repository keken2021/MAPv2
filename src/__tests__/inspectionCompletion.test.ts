/*
  file summary: tests that a submitted inspection outcome completes the inspection stage of a vessel's assurance sets.
  responsibilities: runs a client charter of MV Northwind Resolute through verify, inspect and approve, and checks the stage, the project rollup and the approver notification.
  role in system: guards completeVesselInspection in src/store/useMapStore.ts, called by InspectionChecklistView.tsx.
*/

import { describe, it, expect } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

const CLIENT = 'Southern Basin Energy Pty Ltd';
const VESSEL_NAME = 'MV Northwind Resolute';

const getSet = (id: string) => useMapStore.getState().assuranceSets.find((s) => s.id === id)!;

/* creates a client charter set on the vessel with two requirements, and returns its stored id */
function charterVessel(title: string): string {
  const store = useMapStore.getState();
  const newSet: AssuranceSet = {
    id: `AS-TEST-${title.replace(/\s+/g, '-')}`,
    title,
    assuranceType: 'Vessel',
    subtypes: ['Vessel'],
    vesselId: 'VESSEL-012',
    vesselName: VESSEL_NAME,
    imoNumber: '9871232',
    initiatorOrg: CLIENT,
    initiatorRole: 'C Admin · Client Created',
    charterer: CLIENT,
    clientOrg: CLIENT,
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-12-01',
    complianceDeadline: '2026-12-01',
    charterWindowEnd: '2027-06-01',
    stage: 'Initiated',
    readinessScore: 10,
    verificationRequired: true,
    mandatoryInspectionRequired: true,
    formalApprovalRequired: true,
    inspectionCompleted: false,
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'D. Harrison (Harrison Marine Vetting Services)',
    assignedInspector: 'N. Technical (Meridian Marine Surveyors)',
    assignedApprover: 'Elena Gomez (Southern Basin Energy Pty Ltd)',
    createdByPersona: 'C Admin',
    requirements: [
      {
        id: `REQ-${title}-1`,
        subtype: 'Vessel',
        category: 'Statutory Certificate',
        title: 'Certificate of Class',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      },
      {
        id: `REQ-${title}-2`,
        subtype: 'Vessel',
        category: 'Statutory Certificate',
        title: 'Safety Construction & Equipment (SOLAS)',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      },
    ],
  };
  store.addAssuranceSet(newSet);
  return useMapStore.getState().assuranceSets.find((s) => s.title === title)!.id;
}

function verifyAll(setId: string) {
  getSet(setId).requirements.forEach((r) =>
    useMapStore.getState().updateRequirementStatus(setId, r.id, 'Verified', 'Verified.'),
  );
}

describe('Inspection outcome completes the inspection stage', () => {
  it('attaches the vessel own library certificates when the set is created', () => {
    const setId = charterVessel('Inspection Completion Attach');
    const documentIds = getSet(setId).requirements.map((r) => r.documentId);
    expect(documentIds).toEqual(['MAP-VES-2026-STAT-00020', 'MAP-VES-2026-STAT-00021']);
    expect(getSet(setId).stage).toBe('Verification');
  });

  it('moves a verified set from inspection to approval and on to approved', () => {
    const setId = charterVessel('Inspection Completion Pass');
    const project = useMapStore.getState().addProject({
      name: 'Inspection Completion Project',
      projectType: 'Charter / Voyage',
      clientOperator: CLIENT,
      requestingOrganization: CLIENT,
      location: 'Carnarvon Basin',
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-06-01',
      operatorOrganization: CLIENT,
      charterer: CLIENT,
      routeDescription: 'Dampier Port to Platform Beta',
      assetLinks: [
        {
          assetType: 'Vessel',
          assetId: 'VESSEL-012',
          assetName: VESSEL_NAME,
          providerOrganization: 'Northwind Marine Pty Ltd',
          assuranceSetId: setId,
        },
      ],
    });
    const getProject = () => useMapStore.getState().projects.find((p) => p.id === project.projectId)!;

    verifyAll(setId);
    expect(getSet(setId).stage).toBe('Inspection');

    const completed = useMapStore.getState().completeVesselInspection(VESSEL_NAME, 'Pass with observations');
    expect(completed).toContain(setId);
    expect(getSet(setId).inspectionCompleted).toBe(true);
    expect(getSet(setId).stage).toBe('Approval');
    expect(
      useMapStore
        .getState()
        .notifications.some((n) => n.assuranceSetId === setId && n.type === 'approval_requested'),
    ).toBe(true);

    useMapStore.getState().setApproverDecision(setId, 'Approved', 'Approved for charter.');
    expect(getSet(setId).stage).toBe('Approved');
    expect(getSet(setId).readinessScore).toBe(100);
    expect(getProject().status).toBe('Ready for Charter');
    expect(getProject().readinessScore).toBe(100);
  });

  it('leaves the set at inspection when the outcome is Fail', () => {
    const setId = charterVessel('Inspection Completion Fail');
    verifyAll(setId);

    expect(useMapStore.getState().completeVesselInspection(VESSEL_NAME, 'Fail')).toEqual([]);
    expect(getSet(setId).inspectionCompleted).toBe(false);
    expect(getSet(setId).stage).toBe('Inspection');
  });

  it('does not complete the inspection of a set whose documents are not verified yet', () => {
    const setId = charterVessel('Inspection Completion Unverified');

    expect(useMapStore.getState().completeVesselInspection(VESSEL_NAME, 'Pass')).not.toContain(setId);
    expect(getSet(setId).inspectionCompleted).toBe(false);
    expect(getSet(setId).stage).toBe('Verification');
  });
});
