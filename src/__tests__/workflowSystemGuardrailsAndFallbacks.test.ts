/* 
  file summary: automated integration tests for real-world system guardrails, segregation of duties, and fallbacks.
  responsibilities: tests terminal hard rejection, segregation of duties and RBAC breaches, and post-approval tamper protection.
  role in system: validates system guardrails and tamper resistance workflows via Vitest.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { getAssuranceSetRoleActions } from '../utils/rbacHelpers';
import { validateStakeholderAssignmentForSet } from '../utils/userRoleHelpers';
import { getAssuranceSetStatus } from '../utils/assuranceSetStatus';
import { MasterDocument } from '../types/document';

describe('Real-World Operational Workflows - System Guardrails & Fallbacks', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  /**
    what: tests terminal hard rejection by Approver and subsequent terminal closure.
    how: invokes setApproverDecision with Rejected, asserts approverDecision, requirements flipped to Rejected, status derives to No-go, audit trail logged, and terminal cancellation.
    with what file: src/__tests__/workflowSystemGuardrailsAndFallbacks.test.ts testing useMapStore.ts and assuranceSetStatus.ts.
  */
  it('should handle terminal hard rejection, derive No-go status, log audit trail, and allow terminal closure', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TERM-REJECT-5510';
    const reqId = 'REQ-TERM-01';

    const testSet: AssuranceSet = {
      id: setId,
      title: 'High Risk Offshore Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 75,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: reqId,
          category: 'Statutory Certificate',
          title: 'Safety Construction Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          documentId: 'MAP-VES-2026-STAT-00001',
          verifierStatus: 'Verified',
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
      ],
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);

    // Approver executes hard terminal rejection
    store.setActivePersona('Approver');
    store.setApproverDecision(
      setId,
      'Rejected',
      'Structural defects identified during class audit cannot be mitigated within project timeframe.'
    );

    let rejectedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(rejectedSet.approverDecision).toBe('Rejected');
    expect(rejectedSet.approverNotes).toContain('Structural defects identified');

    // Requirements flipped to Rejected
    const rejectedReq = rejectedSet.requirements.find((r) => r.id === reqId)!;
    expect(rejectedReq.verifierStatus).toBe('Rejected');
    expect(rejectedReq.isFulfilled).toBe(false);

    // Derives No-go status under ASSURANCE_SET_STATUS_RULES
    const statusResult = getAssuranceSetStatus(rejectedSet, store.documents, store.capaItems);
    expect(statusResult.status).toBe('No-go');
    expect(statusResult.blockingItems).toBeGreaterThan(0);

    // Audit trail logs approver final decision
    const auditEvents = useMapStore.getState().auditEvents;
    const rejectAudit = auditEvents.find(
      (e) => e.targetAsset.includes(setId) && e.action.includes('Approver Final Decision: Rejected')
    );
    expect(rejectAudit).toBeDefined();
    expect(rejectAudit?.justificationNotes).toContain('Structural defects identified');

    // Terminal set closure via cancellation
    const cancelRes = store.cancelAssuranceSet(
      setId,
      'P. Nardelli (Chevron)',
      'Campaign permanently terminated following structural rejection.'
    );
    expect(cancelRes.success).toBe(true);

    rejectedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(rejectedSet.stage).toBe('Cancelled');
    expect(rejectedSet.cancelledAt).toBeDefined();
  });

  /**
    what: tests segregation of duties and RBAC guardrails against unauthorized actions.
    how: tests Submitter self-verification/approval blockage via getAssuranceSetRoleActions, and cross-tenant stakeholder assignment rejection via validateStakeholderAssignmentForSet.
    with what file: src/__tests__/workflowSystemGuardrailsAndFallbacks.test.ts testing rbacHelpers.ts and userRoleHelpers.ts.
  */
  it('should enforce segregation of duties by blocking Submitter self-verification/approval and cross-tenant roles', () => {
    const store = useMapStore.getState();
    const setId = 'AS-RBAC-GUARD-5510';
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Segregation Verification Set',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Verification',
      readinessScore: 60,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [],
      createdByPersona: 'C Admin',
    };

    // Submitter actions on this set
    const submitterActions = getAssuranceSetRoleActions(
      testSet,
      'Submitter',
      'Northwind Marine Pty Ltd'
    );

    // Submitter cannot verify and cannot approve
    expect(submitterActions.canVerify).toBe(false);
    expect(submitterActions.canApprove).toBe(false);
    expect(submitterActions.canUpload).toBe(true);

    // Service provider user attempting to take Approver role
    const invalidApproverValidation = validateStakeholderAssignmentForSet(
      testSet,
      'Approver',
      'M. Chen (Northwind Marine)',
      store.users
    );
    expect(invalidApproverValidation.ok).toBe(false);
    if (!invalidApproverValidation.ok) {
      expect(invalidApproverValidation.message).toContain('not in');
    }

    // Service provider user attempting to take Verifier role
    const invalidVerifierValidation = validateStakeholderAssignmentForSet(
      testSet,
      'Verifier',
      'M. Chen (Northwind Marine)',
      store.users
    );
    expect(invalidVerifierValidation.ok).toBe(false);
    if (!invalidVerifierValidation.ok) {
      expect(invalidVerifierValidation.message).toContain('not in');
    }
  });

  /**
    what: tests post-approval tamper protection ensuring approved sets preserve immutable version snapshots.
    how: approves a set with verifiedVersion snapshot, modifies master document in library, and asserts approved set snapshot remains intact.
    with what file: src/__tests__/workflowSystemGuardrailsAndFallbacks.test.ts testing useMapStore.ts.
  */
  it('should protect approved assurance sets by preserving frozen document version snapshots against library changes', () => {
    const store = useMapStore.getState();
    const setId = 'AS-TAMPER-PROTECT-5510';
    const docId = 'MAP-VES-2026-TAMPER-01';
    const reqId = 'REQ-TAMPER-01';

    const testDoc: MasterDocument = {
      id: docId,
      title: 'Safety Equipment Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-001',
      certificateNo: 'SEC-2026-101',
      issuingAuthority: 'DNV',
      currentVersion: 'v1.0',
      expiryDate: '2028-01-01',
      ocrConfidence: 99,
      complianceState: 'Valid',
      verificationStatus: 'Verified',
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      versions: [
        {
          versionLabel: 'v1.0',
          uploadedAt: '2026-01-01T00:00:00Z',
          uploadedBy: 'M. Chen',
          fileName: 'sec_v1.0.pdf',
          fileSizeBytes: 1500000,
          changeSummary: 'Original certified release',
        },
      ],
    };
    store.addDocument(testDoc);

    const testSet: AssuranceSet = {
      id: setId,
      title: 'Tamper Protection Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 100,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: reqId,
          category: 'Statutory Certificate',
          title: 'Safety Equipment Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 99,
          documentId: docId,
          verifierStatus: 'Verified',
          verifiedVersion: {
            documentId: docId,
            versionLabel: 'v1.0',
            fileName: 'sec_v1.0.pdf',
            uploadedAt: '2026-01-01T00:00:00Z',
            verifiedAt: '2026-01-05T00:00:00Z',
            verifiedBy: 'A. Fontaine (DNV)',
            verificationStatus: 'Verified',
            expiryDate: '2028-01-01',
          },
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
      ],
      createdByPersona: 'C Admin',
    };
    store.addAssuranceSet(testSet);

    // Approver approves and locks the set
    store.setActivePersona('Approver');
    store.setApproverDecision(setId, 'Approved', 'Approved and locked for charter execution.');

    let approvedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(approvedSet.stage).toBe('Approved');
    expect(approvedSet.lockedAt).toBeDefined();

    // Later, document in the master library is updated to v2.0 with a new file
    store.setActivePersona('Submitter');
    store.addDocumentVersion(
      docId,
      'v2.0',
      'sec_amended_v2.0.pdf',
      1900000,
      'Amended liferaft capacity notes.',
      '2028-06-01'
    );

    // Verify master library has advanced to v2.0
    const masterDoc = useMapStore.getState().documents.find((d) => d.id === docId)!;
    expect(masterDoc.currentVersion).toBe('v2.0');

    // Verify that the approved assurance set remains version-locked to v1.0
    approvedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    const lockedReq = approvedSet.requirements.find((r) => r.id === reqId)!;
    expect(lockedReq.verifiedVersion?.versionLabel).toBe('v1.0');
    expect(lockedReq.verifiedVersion?.fileName).toBe('sec_v1.0.pdf');
    expect(lockedReq.verifiedVersion?.expiryDate).toBe('2028-01-01');
  });
});
