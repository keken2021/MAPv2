/*
  file summary: tests Scenario 1 from the architecture diagram:
    "Scenario 1: Vessel Provider starts — Administrator registers the vessel and creates the project and set; another party verifies and approves"
  responsibilities: tests vessel provider onboarding flow, vessel registration in store, provider project and assurance set creation, segregation of duties, and third-party verification and approval.
  role in system: automated Vitest test suite executing under vitest run.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_USERS, MOCK_VESSELS } from '../store/mockData';
import { NORTHWIND_ORG } from '../store/oilCoLngPilotMockData';
import { getAssuranceSetRoleActions } from '../utils/rbacHelpers';
import { validateStakeholderAssignmentForSet } from '../utils/userRoleHelpers';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { VesselInformation } from '../types/vessel';

const initialState = useMapStore.getState();

describe('Scenario 1: Vessel Provider starts', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  const vesselId = 'VESSEL-SCENARIO-1';
  const newVessel: VesselInformation = {
    ...MOCK_VESSELS[0],
    id: vesselId,
    name: 'MV Northwind Pioneer',
    imoNumber: '9988771',
    officialRegNumber: 'NW-9988771',
    registeredOwner: NORTHWIND_ORG,
    technicalManager: NORTHWIND_ORG,
    ismCompany: NORTHWIND_ORG,
    status: 'Active',
    complianceReadinessScore: 100,
  };

  it('allows Administrator to register the vessel and auto-create its assurance object', () => {
    const store = useMapStore.getState();
    store.setActivePersona('Administrator');

    const result = store.addVessel(newVessel);
    expect(result.success).toBe(true);

    const registeredVessel = useMapStore.getState().vessels.find((v) => v.id === vesselId);
    expect(registeredVessel).toBeDefined();
    expect(registeredVessel?.name).toBe('MV Northwind Pioneer');
    expect(registeredVessel?.registeredOwner).toBe(NORTHWIND_ORG);

    // Assurance object catalog automatically receives the new vessel object
    const vesselObject = useMapStore.getState().assuranceObjects.find((o) => o.id === vesselId);
    expect(vesselObject).toBeDefined();
    expect(vesselObject?.type).toBe('vessel');
    expect(vesselObject?.ownerOrganization).toBe(NORTHWIND_ORG);
  });

  it('allows Administrator to create the provider project and attach an assurance set', () => {
    const store = useMapStore.getState();
    store.setActivePersona('Administrator');

    // 1. Administrator creates provider campaign project
    const projectResult = store.addProject({
      name: 'Northwind Pioneer Operations 2026',
      projectType: 'Assurance Campaign',
      requestingOrganization: NORTHWIND_ORG,
      clientOperator: NORTHWIND_ORG,
      operatorOrganization: NORTHWIND_ORG,
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-05-01',
      location: 'Fremantle Offshore Base',
    });
    expect(projectResult.success).toBe(true);
    const projectId = projectResult.projectId!;

    const createdProject = useMapStore.getState().projects.find((p) => p.id === projectId);
    expect(createdProject?.ownerOrganization).toBe(NORTHWIND_ORG);
    expect(createdProject?.name).toBe('Northwind Pioneer Operations 2026');

    // 2. Administrator creates assurance set for the vessel
    const setId = 'AS-SCENARIO-1-PIONEER';
    const requirements: AssuranceRequirement[] = [
      {
        id: 'REQ-SCEN1-01',
        category: 'Statutory Certificate',
        title: 'Class Maintenance Certificate',
        subtype: 'Vessel',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
        documentId: 'DOC-SCEN1-01',
      },
      {
        id: 'REQ-SCEN1-02',
        category: 'Statutory Certificate',
        title: 'Safety Management Certificate (SMC)',
        subtype: 'Vessel',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
        documentId: 'DOC-SCEN1-02',
      },
    ];

    const set: AssuranceSet = {
      id: setId,
      title: 'MV Northwind Pioneer — Class & Safety Vetting',
      assuranceType: 'Vessel',
      subtypes: ['Vessel'],
      projectId,
      projectName: 'Northwind Pioneer Operations 2026',
      vesselId,
      vesselName: newVessel.name,
      imoNumber: newVessel.imoNumber,
      initiatorOrg: NORTHWIND_ORG,
      initiatorRole: 'Vessel Provider Admin',
      createdByPersona: 'Administrator',
      createdByName: 'K. Osei',
      clientOrg: 'Chevron Australia Pty Ltd',
      charterer: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: NORTHWIND_ORG,
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
      assignedApprover: 'Sarah Jenkins (Chevron Australia Pty Ltd)',
      reviewMode: 'third_party',
      charterWindowStart: '2026-12-01',
      complianceDeadline: '2026-12-01',
      charterWindowEnd: '2027-05-01',
      stage: 'Initiated',
      readinessScore: 20,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements,
      visibility: 'organization',
    };

    store.addAssuranceSet(set);
    const attachResult = store.attachAssuranceSetToProject(setId, projectId);
    expect(attachResult.success).toBe(true);

    const attachedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId);
    expect(attachedSet).toBeDefined();
    expect(attachedSet?.projectId).toBe(projectId);
  });

  it('enforces segregation of duties: provider staff are blocked from self-verifying and self-approving', () => {
    const setId = 'AS-SCENARIO-1-SEGREGATION';
    const set: AssuranceSet = {
      id: setId,
      title: 'MV Northwind Pioneer — Segregation Check',
      assuranceType: 'Vessel',
      subtypes: ['Vessel'],
      vesselId,
      vesselName: newVessel.name,
      imoNumber: newVessel.imoNumber,
      initiatorOrg: NORTHWIND_ORG,
      initiatorRole: 'Vessel Provider Admin',
      clientOrg: 'Chevron Australia Pty Ltd',
      charterer: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: NORTHWIND_ORG,
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
      assignedApprover: 'Sarah Jenkins (Chevron Australia Pty Ltd)',
      reviewMode: 'third_party',
      charterWindowStart: '2026-12-01',
      complianceDeadline: '2026-12-01',
      charterWindowEnd: '2027-05-01',
      stage: 'Verification',
      readinessScore: 50,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [],
      visibility: 'organization',
    };

    useMapStore.getState().addAssuranceSet(set);

    const submitterUser = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    const adminUser = MOCK_USERS.find((u) => u.id === 'USR-101')!;

    // Submitter and Administrator cannot verify or approve their own set
    const submitterActions = getAssuranceSetRoleActions(set, 'Submitter', NORTHWIND_ORG, submitterUser);
    expect(submitterActions.canVerify).toBe(false);
    expect(submitterActions.canApprove).toBe(false);

    const adminActions = getAssuranceSetRoleActions(set, 'Administrator', NORTHWIND_ORG, adminUser);
    expect(adminActions.canVerify).toBe(false);
    expect(adminActions.canApprove).toBe(false);

    // Validator rejects provider staff as verifier
    const providerConflict = validateStakeholderAssignmentForSet(
      { ...set, assignedVerifier: undefined },
      'Verifier',
      'M. Chen (Northwind Marine Pty Ltd)',
      MOCK_USERS,
    );
    expect(providerConflict.ok).toBe(false);
    expect(!providerConflict.ok && providerConflict.message).toContain('Service provider conflict');

    // And rejects provider staff when an external assurance org is designated
    const wrongOrg = validateStakeholderAssignmentForSet(
      set,
      'Verifier',
      'M. Chen (Northwind Marine Pty Ltd)',
      MOCK_USERS,
    );
    expect(wrongOrg.ok).toBe(false);
    expect(!wrongOrg.ok && wrongOrg.message).toContain('is not in Bureau Veritas Inspectorate');
  });

  it('allows an external party to verify and approve the set to completion', () => {
    const setId = 'AS-SCENARIO-1-EXTERNAL-APPROVAL';
    const requirements: AssuranceRequirement[] = [
      {
        id: 'REQ-SCEN1-20',
        category: 'Statutory Certificate',
        title: 'International Load Line Certificate',
        subtype: 'Vessel',
        isMandatory: true,
        isFulfilled: true,
        ocrConfidence: 95,
        verifierStatus: 'Pending',
        documentId: 'DOC-SCEN1-20',
      },
    ];

    const set: AssuranceSet = {
      id: setId,
      title: 'MV Northwind Pioneer — External Verification',
      assuranceType: 'Vessel',
      subtypes: ['Vessel'],
      vesselId,
      vesselName: newVessel.name,
      imoNumber: newVessel.imoNumber,
      initiatorOrg: NORTHWIND_ORG,
      initiatorRole: 'Vessel Provider Admin',
      clientOrg: 'Chevron Australia Pty Ltd',
      charterer: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: NORTHWIND_ORG,
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
      assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
      assignedApprover: 'Sarah Jenkins (Chevron Australia Pty Ltd)',
      reviewMode: 'third_party',
      charterWindowStart: '2026-12-01',
      complianceDeadline: '2026-12-01',
      charterWindowEnd: '2027-05-01',
      stage: 'Verification',
      readinessScore: 60,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements,
      visibility: 'organization',
    };

    useMapStore.getState().addAssuranceSet(set);

    // 1. Independent third-party Verifier can verify
    const verifierUser = MOCK_USERS.find((u) => u.id === 'USR-202')!;
    const verifierActions = getAssuranceSetRoleActions(set, 'Verifier', 'Bureau Veritas Inspectorate', verifierUser);
    expect(verifierActions.canVerify).toBe(true);

    const verifiedRequirements = set.requirements.map((req) => ({
      ...req,
      verifierStatus: 'Verified' as const,
    }));
    const verifiedSet: AssuranceSet = {
      ...set,
      requirements: verifiedRequirements,
      stage: 'Approval',
      readinessScore: 90,
    };
    useMapStore.getState().updateAssuranceSet(verifiedSet);

    // 2. Client Approver can approve
    const approverUser = {
      id: 'USR-SARAH-APP',
      name: 'Sarah Jenkins',
      organization: 'Chevron Australia Pty Ltd',
      roles: ['Approver' as const],
    };
    const approverActions = getAssuranceSetRoleActions(verifiedSet, 'Approver', 'Chevron Australia Pty Ltd', approverUser);
    expect(approverActions.canApprove).toBe(true);

    const approvedSet: AssuranceSet = {
      ...verifiedSet,
      stage: 'Approved',
      approverDecision: 'Approved',
      approverNotes: 'Class certificate verified against Bureau Veritas register.',
      readinessScore: 100,
    };
    useMapStore.getState().updateAssuranceSet(approvedSet);

    const finalized = useMapStore.getState().assuranceSets.find((s) => s.id === setId);
    expect(finalized?.stage).toBe('Approved');
    expect(finalized?.approverDecision).toBe('Approved');
    expect(finalized?.readinessScore).toBe(100);
  });
});

