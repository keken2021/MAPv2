/* 
  file summary: automated integration tests for real-world workflow approver rejection and remediation loop.
  responsibilities: tests approver requirement denial, correction pings, multi-party task status, document version remediation, scoped re-verification, and final approval locking.
  role in system: validates approver rejection and multi-party remediation workflows via Vitest.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

describe('Real-World Operational Workflows - Approver Rejection & Remediation', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  /**
    what: tests full lifecycle of approver rejection, multi-party remediation, scoped re-verification, and final sign-off.
    how: seeds set in Approval stage, executes denyRequirementByApprover, verifies state/notifications/audit, uploads new document version, performs re-verification, re-submits and executes final approval.
    with what file: src/__tests__/workflowRejectionAndRemediation.test.ts testing useMapStore.ts.
  */
  it('should execute end-to-end rejection, remediation upload, scoped re-verification, and final approval lock', () => {
    const store = useMapStore.getState();
    const setId = 'AS-REMED-TEST-5508';
    const req1Id = 'REQ-REMED-01';
    const req2Id = 'REQ-REMED-02';
    const doc1Id = 'MAP-VES-2026-STAT-00001';
    const doc2Id = 'MAP-VES-2026-STAT-00002';

    const testSet: AssuranceSet = {
      id: setId,
      title: 'Remediation Workflow Campaign',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Approval',
      readinessScore: 90,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      assignedApprover: 'P. Nardelli (Chevron)',
      requirements: [
        {
          id: req1Id,
          category: 'Statutory Certificate',
          title: 'Certificate of Class',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 98,
          documentId: doc1Id,
          verifierStatus: 'Verified',
          verifiedVersion: {
            documentId: doc1Id,
            versionLabel: 'v1.0',
            fileName: 'class_cert_v1.pdf',
            uploadedAt: '2026-10-01T08:00:00Z',
            verifiedAt: '2026-10-05T10:00:00Z',
            verifiedBy: 'A. Fontaine (DNV)',
            verificationStatus: 'Verified',
            expiryDate: '2028-11-01',
          },
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
        {
          id: req2Id,
          category: 'Safety Management',
          title: 'Safety Management Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 95,
          documentId: doc2Id,
          verifierStatus: 'Verified',
          verifiedVersion: {
            documentId: doc2Id,
            versionLabel: 'v1.0',
            fileName: 'smc_v1.pdf',
            uploadedAt: '2026-10-01T08:00:00Z',
            verifiedAt: '2026-10-05T10:00:00Z',
            verifiedBy: 'A. Fontaine (DNV)',
            verificationStatus: 'Verified',
            expiryDate: '2028-11-01',
          },
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
      ],
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);

    // 1. Approver requirement denial
    store.setActivePersona('Approver');
    store.denyRequirementByApprover(
      setId,
      req1Id,
      'Correction Requested',
      'Annual class survey endorsement stamp is missing or illegible on page 2.'
    );

    let currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(currentSet.stage).toBe('Verification');
    expect(currentSet.approverDecision).toBe('Returned for Correction');

    const deniedReq = currentSet.requirements.find((r) => r.id === req1Id)!;
    expect(deniedReq.verifierStatus).toBe('Correction Requested');
    expect(deniedReq.isFulfilled).toBe(false);
    expect(deniedReq.notes).toContain('Annual class survey endorsement stamp');

    // Uncontested requirement REQ-REMED-02 remains verified
    const unaffectedReq = currentSet.requirements.find((r) => r.id === req2Id)!;
    expect(unaffectedReq.verifierStatus).toBe('Verified');
    expect(unaffectedReq.isFulfilled).toBe(true);

    // Check audit trail ping
    const auditEvents = useMapStore.getState().auditEvents;
    const denialAudit = auditEvents.find(
      (e) => e.targetAsset.includes(setId) && e.action.includes('[PING: SUBMITTER ACTION REQUIRED]')
    );
    expect(denialAudit).toBeDefined();
    expect(denialAudit?.justificationNotes).toContain('Annual class survey endorsement stamp');

    // Check correction notification
    const notifications = useMapStore.getState().notifications;
    const correctionNotif = notifications.find(
      (n) => n.assuranceSetId === setId && n.type === 'document_correction'
    );
    expect(correctionNotif).toBeDefined();
    expect(correctionNotif?.subject).toContain('Certificate of Class');
    expect(correctionNotif?.message).toContain('Annual class survey endorsement stamp');

    // 2. Multi-party task status check & Submitter remediation upload
    const completionBeforeUpload = useMapStore.getState().getRequirementCompletionStatus(setId, req1Id);
    expect(completionBeforeUpload.isDone).toBe(false);
    expect(completionBeforeUpload.partyStatuses.some((p) => p.status === 'Correction Requested')).toBe(true);

    store.setActivePersona('Submitter');
    // Upload updated document version v2.0
    store.addDocumentVersion(
      doc1Id,
      'v2.0',
      'class_cert_endorsement_v2.pdf',
      2450000,
      'Endorsed annual survey page appended.',
      '2028-11-01',
      { assuranceSetId: setId, requirementId: req1Id }
    );

    // Verify document record reflects new version
    const updatedDoc = useMapStore.getState().documents.find((d) => d.id === doc1Id)!;
    expect(updatedDoc.currentVersion).toBe('v2.0');
    expect(updatedDoc.versions.some((v) => v.versionLabel === 'v2.0')).toBe(true);

    // 3. Scoped Re-Verification Gate
    store.setActivePersona('Verifier');
    store.verifyDocument(
      doc1Id,
      'Verified',
      'Annual survey stamp confirmed valid by DNV verifier.',
      undefined,
      req1Id,
      setId,
      {
        verificationMethod: 'Issuer lookup',
        verificationReference: 'DNV-REV-88219',
      }
    );

    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    const reVerifiedReq = currentSet.requirements.find((r) => r.id === req1Id)!;
    expect(reVerifiedReq.verifierStatus).toBe('Verified');
    expect(reVerifiedReq.isFulfilled).toBe(true);

    // Requirement completion status is now done
    const completionAfterVerify = useMapStore.getState().getRequirementCompletionStatus(setId, req1Id);
    expect(completionAfterVerify.isDone).toBe(true);
    expect(useMapStore.getState().isRequirementDone(setId, req1Id)).toBe(true);

    // 4. Re-submission & Final Sign-Off
    store.setActivePersona('Submitter');
    store.sendAssuranceForReview(setId);

    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(currentSet.clientWorkflowStage).toBe('in_review');

    // Approver signs off
    store.setActivePersona('Approver');
    store.setApproverDecision(setId, 'Approved', 'All requirements verified and endorsed.');

    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(currentSet.stage).toBe('Approved');
    expect(currentSet.approverDecision).toBe('Approved');
    expect(currentSet.lockedAt).toBeDefined();

    // Audit trail records final approval
    const finalAudit = useMapStore.getState().auditEvents.find(
      (e) => e.targetAsset.includes(setId) && e.action === 'Approver Final Decision: Approved'
    );
    expect(finalAudit).toBeDefined();
    expect(finalAudit?.justificationNotes).toContain('All requirements verified and endorsed.');
  });
});
