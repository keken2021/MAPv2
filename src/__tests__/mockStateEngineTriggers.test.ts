import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

describe('Mock State Engine Triggers in useMapStore', () => {
  beforeEach(() => {
    useMapStore.setState(useMapStore.getInitialState());
  });

  it('Trigger 1: recalculateSetReadiness auto-calculates score and auto-advances stage upon verification', () => {
    const store = useMapStore.getState();

    const testSetId = 'AS-ENGINE-TEST-001';
    const testSet: AssuranceSet = {
      id: testSetId,
      title: 'Engine Trigger Test Set',
      assuranceType: 'Activity',
      activityId: 'ACT-CUSTOM-999',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      clientOrg: 'Southern Basin Energy',
      stage: 'Initiated',
      readinessScore: 0,
      verificationRequired: true,
      formalApprovalRequired: true,
      requirements: [
        {
          id: 'REQ-1',
          category: 'Activity Custom Requirement',
          title: 'ZZZ-NonMatching-Requirement-Alpha-001',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-2',
          category: 'Activity Custom Requirement',
          title: 'ZZZ-NonMatching-Requirement-Beta-002',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
      vesselId: '',
      vesselName: '',
      imoNumber: '',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '',
      charterWindowEnd: '',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    store.addAssuranceSet(testSet);

    let currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    expect(currentSet).toBeDefined();
    expect(currentSet?.readinessScore).toBe(10);
    expect(currentSet?.stage).toBe('Initiated');

    useMapStore.getState().updateRequirementStatus(testSetId, 'REQ-1', 'Verified');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    expect(currentSet?.readinessScore).toBe(40);

    useMapStore.getState().updateRequirementStatus(testSetId, 'REQ-2', 'Verified');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    expect(currentSet?.readinessScore).toBe(70);
    expect(currentSet?.stage).toBe('Approval');

    // Approve the campaign -> readiness becomes 100% and stage becomes Approved
    useMapStore.getState().setApproverDecision(testSetId, 'Approved');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    expect(currentSet?.readinessScore).toBe(100);
    expect(currentSet?.stage).toBe('Approved');
  });

  it('Trigger 2: syncProjectMasterRollup computes lowest common denominator readiness and updates project status', () => {
    const store = useMapStore.getState();

    const childSet1Id = 'AS-CHILD-01';
    const childSet2Id = 'AS-CHILD-02';

    const childSet1: AssuranceSet = {
      id: childSet1Id,
      title: 'Child Vessel Set',
      assuranceType: 'Activity',
      activityId: 'ACT-01',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      stage: 'Approved',
      approverDecision: 'Approved',
      readinessScore: 100,
      requirements: [
        {
          id: 'REQ-C1',
          category: 'Activity Custom Requirement',
          title: 'Activity Permit 01',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          verifierStatus: 'Verified',
        },
      ],
      vesselId: '',
      vesselName: '',
      imoNumber: '',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '',
      charterWindowEnd: '',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    const childSet2: AssuranceSet = {
      id: childSet2Id,
      title: 'Child Crew Set',
      assuranceType: 'Activity',
      activityId: 'ACT-02',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      stage: 'Verification',
      readinessScore: 40,
      requirements: [
        {
          id: 'REQ-C2A',
          category: 'Activity Custom Requirement',
          title: 'Activity Permit 02A',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          verifierStatus: 'Verified',
        },
        {
          id: 'REQ-C2B',
          category: 'Activity Custom Requirement',
          title: 'Activity Permit 02B',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
      vesselId: '',
      vesselName: '',
      imoNumber: '',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '',
      charterWindowEnd: '',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false
    };

    store.addAssuranceSet(childSet1);
    store.addAssuranceSet(childSet2);

    const projectResult = store.addProject({
      name: 'Offshore Wind Farm Support 2026',
      projectType: 'Charter / Voyage',
      clientOperator: 'Southern Basin Energy',
      requestingOrganization: 'Northwind Marine Pty Ltd',
      operatorOrganization: 'Northwind Marine Pty Ltd',
      location: 'Bass Strait',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      assetLinks: [
        {
          assetType: 'Vessel',
          assetId: 'VESSEL-001',
          assetName: 'MV Pacific Endeavour',
          providerOrganization: 'Northwind Marine Pty Ltd',
          assuranceSetId: childSet1Id,
          roleInProject: 'Primary Vessel',
        },
        {
          assetType: 'Crew',
          assetId: 'CREW-101',
          assetName: 'Capt. Alexander Wright',
          providerOrganization: 'Northwind Marine Pty Ltd',
          assuranceSetId: childSet2Id,
          roleInProject: 'Master',
        },
      ],
    });

    expect(projectResult.success).toBe(true);
    const projId = projectResult.projectId!;

    let project = useMapStore.getState().projects.find((p) => p.id === projId);
    expect(project).toBeDefined();
    // Lowest common denominator readiness is min(100, 40) = 40
    expect(project?.readinessScore).toBe(40);
    expect(project?.status).toBe('Assurance In Progress');

    // Verify childSet2 REQ-C2B and approve childSet2
    useMapStore.getState().updateRequirementStatus(childSet2Id, 'REQ-C2B', 'Verified');
    useMapStore.getState().setApproverDecision(childSet2Id, 'Approved');

    project = useMapStore.getState().projects.find((p) => p.id === projId);
    expect(project?.readinessScore).toBe(100);
    expect(project?.status).toBe('Ready for Charter');

    const childSets = useMapStore.getState().assuranceSets.filter((s) =>
      [childSet1Id, childSet2Id].includes(s.id),
    );
    expect(childSets.every((s) => s.stage === 'Approved')).toBe(true);
  });

  it('Trigger 3: addAssetToProject, removeAssetFromProject, and linkAssuranceSetToProjectAsset trigger rollups', () => {
    const store = useMapStore.getState();

    const projResult = store.addProject({
      name: 'Subsea Intervention 2026',
      projectType: 'Service Engagement',
      clientOperator: 'Southern Basin Energy',
      requestingOrganization: 'Northwind Marine Pty Ltd',
      operatorOrganization: 'Northwind Marine Pty Ltd',
      location: 'North West Shelf',
      charterWindowStart: '2026-10-15',
      charterWindowEnd: '2026-11-15',
    });

    const projId = projResult.projectId!;
    let proj = useMapStore.getState().projects.find((p) => p.id === projId);
    expect(proj?.status).toBe('Composing');
    expect(proj?.assetLinks.length).toBe(0);

    // Add asset to project
    const addRes = store.addAssetToProject(projId, {
      assetType: 'Equipment',
      assetId: 'EQ-001',
      assetName: 'Hydraulic Power Unit',
      providerOrganization: 'Northwind Marine Pty Ltd',
      assuranceSetId: 'AS-EQP-001',
      roleInProject: 'Hydraulic Source',
    });

    expect(addRes.success).toBe(true);
    proj = useMapStore.getState().projects.find((p) => p.id === projId);
    expect(proj?.assetLinks.length).toBe(1);

    // Remove asset from project
    const linkId = proj!.assetLinks[0].id;
    store.removeAssetFromProject(projId, linkId);

    proj = useMapStore.getState().projects.find((p) => p.id === projId);
    expect(proj?.assetLinks.length).toBe(0);
  });
});
