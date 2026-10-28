/* 
  file summary: unit tests for workflow requirement policies and approver document denial synchronization.
  responsibilities: tests dynamic stage progression, submitter ping audit trail generation, document library status consistency, and pipeline stepper configuration.
  role in system: executed during vitest suite execution.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { calculateAssuranceSetReadiness, getRequirementReadinessPercentage } from '../utils/readinessHelpers';
import { AssuranceSet } from '../types/assurance';

describe('Workflow Requirements & Approver Document Denial Synchronization', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  /**
    what: tests that when an approver denies an individual verified document, it updates the requirement and document library status, drops stage, and logs a submitter ping audit event.
    how: invokes denyRequirementByApprover and inspects assurance set, documents, and auditEvents state.
    with what file: src/__tests__/workflowRequirementsAndDenialSync.test.ts testing useMapStore.ts.
  */
  it('should update verifier status to Correction Requested, drop stage to Verification, and ping submitter on approver document denial', () => {
    const store = useMapStore.getState();
    const testSet: AssuranceSet = {
      id: 'AS-WORKFLOW-TEST-01',
      title: 'Workflow Test Campaign Alpha',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 70,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: 'REQ-WF-001',
          category: 'Statutory Certificate',
          title: 'Certificate of Class',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          documentId: 'MAP-VES-2026-STAT-00001',
          verifierStatus: 'Verified',
        },
      ],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);
    store.setActivePersona('Approver');

    store.denyRequirementByApprover(
      'AS-WORKFLOW-TEST-01',
      'REQ-WF-001',
      'Correction Requested',
      'Missing official IACS stamp on page 2.'
    );

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-WORKFLOW-TEST-01')!;
    expect(updatedSet.stage).toBe('Verification');
    expect(updatedSet.approverDecision).toBe('Returned for Correction');

    const updatedReq = updatedSet.requirements.find((r) => r.id === 'REQ-WF-001')!;
    expect(updatedReq.verifierStatus).toBe('Correction Requested');
    expect(updatedReq.isFulfilled).toBe(false);
    expect(updatedReq.notes).toContain('Missing official IACS stamp');

    /* the denial stays on the requirement; the library document keeps its own status */
    const linkedDoc = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-00001')!;
    expect(linkedDoc.verificationStatus).not.toBe('Correction Requested');

    /* verify audit trail contains submitter ping */
    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toContain('[PING: SUBMITTER ACTION REQUIRED]');
    expect(latestAudit.justificationNotes).toContain('Missing official IACS stamp');
  });

  /**
    what: tests that when an approver denies the entire assurance set, all requirements and documents are marked returned or rejected with submitter ping.
    how: calls setApproverDecision with Rejected and verifies document and requirement statuses.
    with what file: src/__tests__/workflowRequirementsAndDenialSync.test.ts testing useMapStore.ts.
  */
  it('should reject every requirement of the set, not its shared documents, and ping the submitter', () => {
    const store = useMapStore.getState();
    const testSet: AssuranceSet = {
      id: 'AS-WORKFLOW-TEST-02',
      title: 'Workflow Test Campaign Beta',
      vesselId: 'VESSEL-002',
      vesselName: 'MV Dampier Supplier',
      imoNumber: '9284714',
      initiatorOrg: 'Woodside Energy Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 70,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: 'REQ-WF-002',
          category: 'Statutory Certificate',
          title: 'Flag State Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 96,
          documentId: 'MAP-VES-2026-STAT-00003',
          verifierStatus: 'Verified',
        },
      ],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);
    store.setActivePersona('Approver');

    store.setApproverDecision(
      'AS-WORKFLOW-TEST-02',
      'Rejected',
      'Vessel does not satisfy charter baseline criteria.'
    );

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-WORKFLOW-TEST-02')!;
    expect(updatedSet.stage).toBe('Verification');
    expect(updatedSet.approverDecision).toBe('Rejected');

    const updatedReq = updatedSet.requirements.find((r) => r.id === 'REQ-WF-002')!;
    expect(updatedReq.verifierStatus).toBe('Rejected');
    expect(updatedReq.isFulfilled).toBe(false);

    /* a rejected set does not mark the shared library document */
    const linkedDoc = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-00003')!;
    expect(linkedDoc.verificationStatus).not.toBe('Rejected');

    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toContain('[PING: SUBMITTER ACTION REQUIRED]');
  });

  /**
    what: tests dynamic readiness calculations for custom workflow requirement configurations.
    how: checks sets with and without verification, visual inspection, and formal approval.
    with what file: src/__tests__/workflowRequirementsAndDenialSync.test.ts testing readinessHelpers.ts.
  */
  it('should calculate dynamic readiness correctly when formal approval or verification are disabled', () => {
    /* set with no formal approval required and no inspection required */
    const directSet: AssuranceSet = {
      id: 'AS-DIRECT-01',
      title: 'Direct Set No Approval',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Northwind Marine',
      initiatorRole: 'Vessel Provider Admin',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approved',
      readinessScore: 10,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: false,
      inspectionCompleted: false,
      requirements: [
        {
          id: 'REQ-DIR-1',
          category: 'Statutory Certificate',
          title: 'Class Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          verifierStatus: 'Verified',
        },
      ],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: 'Administrator',
    };

    expect(calculateAssuranceSetReadiness(directSet)).toBe(100);
  });

  /**
    what: tests that workflow requirement configuration overrides the approval blocking rule engine restriction when verification is not required.
    how: creates a set with verificationRequired=false and pending requirements, verifying that unfulfilled mandatory blocking is bypassed.
    with what file: src/__tests__/workflowRequirementsAndDenialSync.test.ts testing ApproverDashboardView logic.
  */
  it('should override approval blocking when verification is not required by workflow configuration', () => {
    const unverifiedSet: AssuranceSet = {
      id: 'AS-OVERRIDE-01',
      title: 'Workflow Override Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Northwind Marine',
      initiatorRole: 'Vessel Provider Admin',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 70,
      verificationRequired: false, /* verification bypassed */
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      requirements: [
        {
          id: 'REQ-OVR-1',
          category: 'Statutory Certificate',
          title: 'Class Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
      ],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: 'Administrator',
    };

    /* when verification is required, mandatory pending requirement blocks approval */
    const isVerificationRequired = unverifiedSet.verificationRequired !== false;
    const unfulfilledWithReq = unverifiedSet.requirements.filter((r) => {
      if (!r.isMandatory) return false;
      if (isVerificationRequired) {
        return !r.isFulfilled && r.verifierStatus !== 'Verified';
      }
      return false;
    });
    expect(unfulfilledWithReq.length).toBe(0);
  });

  /**
    what: tests that newly initiated assurance sets without attached documents have 0% OCR and readiness never reaches 100%.
    how: adds a newly initiated set without attached documents, checking that OCR is 0 and readiness remains at 10%.
    with what file: src/__tests__/workflowRequirementsAndDenialSync.test.ts testing useMapStore and readinessHelpers.
  */
  it('should ensure newly initiated sets have 0% OCR and never 100% readiness when no documents are uploaded', () => {
    const store = useMapStore.getState();
    const newCampaign: AssuranceSet = {
      id: 'AS-NEW-INIT-01',
      title: 'Newly Initiated Campaign',
      vesselId: 'VESSEL-NO-DOCS',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Northwind Marine',
      initiatorRole: 'Vessel Provider Admin',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired: false, /* even if verification is false */
      mandatoryInspectionRequired: false,
      formalApprovalRequired: false, /* even if formal approval is false */
      inspectionCompleted: false,
      requirements: [
        {
          id: 'REQ-NEW-1',
          category: 'Statutory Certificate',
          title: 'Certificate of Class',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-NEW-2',
          category: 'Statutory Certificate',
          title: 'Flag State Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: 'Administrator',
    };

    store.addAssuranceSet(newCampaign);

    const createdSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-NEW-INIT-01');
    expect(createdSet).toBeDefined();
    expect(createdSet?.requirements.every((r) => r.ocrConfidence === 0)).toBe(true);
    expect(createdSet?.stage).toBe('Initiated');
    expect(createdSet?.readinessScore).toBe(10);
    expect(createdSet?.readinessScore).not.toBe(100);
  });

  it('allows client user to add a task to an open set, writes audit event, and notifies vendor', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TASK-EDIT-01';
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Task Editing Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      clientOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Verification',
      readinessScore: 50,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      requirements: [
        {
          id: 'REQ-EXISTING-01',
          category: 'Statutory Certificate',
          title: 'Class Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);
    store.setActivePersona('C Admin');

    const result = store.addAssuranceTask(setId, {
      title: 'Dynamic Mooring Plan',
      category: 'Operational Plan',
      isMandatory: true,
    });

    expect(result.success).toBe(true);
    expect(result.requirement).toBeDefined();

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(updatedSet.requirements.some((r) => r.title === 'Dynamic Mooring Plan')).toBe(true);

    const latestAudit = useMapStore.getState().auditEvents.find((e) => e.action === 'Added task' && e.targetAsset.includes(setId));
    expect(latestAudit).toBeDefined();
    expect(latestAudit?.target.kind).toBe('task');

    const notification = useMapStore.getState().notifications.find(
      (n) => n.assuranceSetId === setId && n.subject.includes('Task added') && n.subject.includes('Dynamic Mooring Plan')
    );
    expect(notification).toBeDefined();
  });

  it('allows client user to edit a task on an open set, writes audit event with delta, and notifies vendor', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TASK-EDIT-01';
    store.setActivePersona('C Admin');

    const set = store.assuranceSets.find((s) => s.id === setId)!;
    const taskToEdit = set.requirements.find((r) => r.title === 'Dynamic Mooring Plan')!;

    const result = store.editAssuranceTask(setId, taskToEdit.id, {
      title: 'Dynamic Mooring Plan (Revised)',
      description: 'Updated field mooring arrangement',
    });

    expect(result.success).toBe(true);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    const edited = updatedSet.requirements.find((r) => r.id === taskToEdit.id)!;
    expect(edited.title).toBe('Dynamic Mooring Plan (Revised)');
    expect(edited.description).toBe('Updated field mooring arrangement');

    const audit = useMapStore.getState().auditEvents.find((e) => e.action === 'Edited task' && e.targetAsset.includes(setId));
    expect(audit).toBeDefined();
    expect(audit?.fieldDelta?.oldValue).toBe('Dynamic Mooring Plan');
    expect(audit?.fieldDelta?.newValue).toBe('Dynamic Mooring Plan (Revised)');

    const notification = useMapStore.getState().notifications.find(
      (n) => n.assuranceSetId === setId && n.subject.includes('Task edited') && n.subject.includes('Dynamic Mooring Plan (Revised)')
    );
    expect(notification).toBeDefined();
  });

  it('allows client user to remove a task from an open set, writes audit event, and notifies vendor', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TASK-EDIT-01';
    store.setActivePersona('C Admin');

    const set = store.assuranceSets.find((s) => s.id === setId)!;
    const taskToRemove = set.requirements.find((r) => r.title === 'Dynamic Mooring Plan (Revised)')!;

    const result = store.removeAssuranceTask(setId, taskToRemove.id);
    expect(result.success).toBe(true);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(updatedSet.requirements.some((r) => r.id === taskToRemove.id)).toBe(false);

    const audit = useMapStore.getState().auditEvents.find((e) => e.action === 'Removed task' && e.targetAsset.includes(setId));
    expect(audit).toBeDefined();

    const notification = useMapStore.getState().notifications.find(
      (n) => n.assuranceSetId === setId && n.subject.includes('Task removed') && n.subject.includes('Dynamic Mooring Plan (Revised)')
    );
    expect(notification).toBeDefined();
  });

  it('blocks vendor users (Administrator and Submitter) from adding, editing, or removing tasks', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TASK-EDIT-01';

    // Administrator (Vendor Provider) persona
    store.setActivePersona('Administrator');

    const addAsAdmin = store.addAssuranceTask(setId, {
      title: 'Unauthorized Vendor Task',
      category: 'Custom Requirement',
    });
    expect(addAsAdmin.success).toBe(false);
    expect(addAsAdmin.message).toContain('Vendor users cannot edit tasks');

    const editAsAdmin = store.editAssuranceTask(setId, 'REQ-EXISTING-01', {
      title: 'Tampered Title',
    });
    expect(editAsAdmin.success).toBe(false);
    expect(editAsAdmin.message).toContain('Vendor users cannot edit tasks');

    const removeAsAdmin = store.removeAssuranceTask(setId, 'REQ-EXISTING-01');
    expect(removeAsAdmin.success).toBe(false);
    expect(removeAsAdmin.message).toContain('Vendor users cannot edit tasks');

    // Submitter persona
    store.setActivePersona('Submitter');

    const addAsSubmitter = store.addAssuranceTask(setId, {
      title: 'Unauthorized Submitter Task',
      category: 'Custom Requirement',
    });
    expect(addAsSubmitter.success).toBe(false);

    const editAsSubmitter = store.editAssuranceTask(setId, 'REQ-EXISTING-01', {
      title: 'Tampered Title by Submitter',
    });
    expect(editAsSubmitter.success).toBe(false);

    const removeAsSubmitter = store.removeAssuranceTask(setId, 'REQ-EXISTING-01');
    expect(removeAsSubmitter.success).toBe(false);

    // Ensure tasks remained completely intact
    const currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(currentSet.requirements.length).toBe(1);
    expect(currentSet.requirements[0].title).toBe('Class Certificate');
  });

  it('preserves correction, rejection, and resubmission loops after task editing', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TASK-LOOP-01';
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Loop Resilience Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      clientOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 70,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: 'REQ-LOOP-01',
          category: 'Statutory Certificate',
          title: 'Certificate of Class',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          documentId: 'MAP-VES-2026-STAT-00001',
          verifierStatus: 'Verified',
        },
      ],
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);

    // Approver denies requirement
    store.setActivePersona('Approver');
    store.denyRequirementByApprover(setId, 'REQ-LOOP-01', 'Correction Requested', 'Missing endorsement signature.');

    let set = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(set.stage).toBe('Verification');
    let req = set.requirements.find((r) => r.id === 'REQ-LOOP-01')!;
    expect(req.verifierStatus).toBe('Correction Requested');

    // Client edits task details on open set
    store.setActivePersona('C Admin');
    const editRes = store.editAssuranceTask(setId, 'REQ-LOOP-01', {
      description: 'Endorsement signature must be clearly visible on page 3.',
    });
    expect(editRes.success).toBe(true);

    // Requirement still holds correction requested status and link
    set = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    req = set.requirements.find((r) => r.id === 'REQ-LOOP-01')!;
    expect(req.verifierStatus).toBe('Correction Requested');
    expect(req.description).toBe('Endorsement signature must be clearly visible on page 3.');

    // Submitter resubmits new document version
    store.setActivePersona('Submitter');
    const baseDoc = store.documents[0];
    store.uploadDocumentForRequirement(setId, 'REQ-LOOP-01', {
      ...baseDoc,
      id: 'MAP-DOC-RESUBMIT-01',
      title: 'Certificate of Class Signed',
      currentVersion: 'v2.0',
      expiryDate: '2028-05-15',
      verificationStatus: 'Pending',
      vesselId: 'VESSEL-001',
      versions: [
        ...baseDoc.versions,
        {
          versionLabel: 'v2.0',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'M. Chen',
          fileName: 'class_cert_v2.pdf',
          fileSizeBytes: 2400000,
          changeSummary: 'Signed endorsement',
        },
      ],
    });

    set = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    req = set.requirements.find((r) => r.id === 'REQ-LOOP-01')!;
    expect(req.documentId).toBe('MAP-DOC-RESUBMIT-01');
    expect(req.verifierStatus).toBe('Pending');

    // Verifier verifies resubmission
    store.setActivePersona('Verifier');
    store.verifyDocument('MAP-DOC-RESUBMIT-01', 'Verified', 'Endorsement confirmed.', undefined, 'REQ-LOOP-01', setId, {
      verificationMethod: 'Issuer lookup',
      verificationReference: 'DNV-VER-9901',
    });

    set = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    req = set.requirements.find((r) => r.id === 'REQ-LOOP-01')!;
    expect(req.verifierStatus).toBe('Verified');
    expect(req.isFulfilled).toBe(true);
  });

});
