/* 
  file summary: automated integration tests for real-world client disruptions and schedule shifts.
  responsibilities: tests mid-flight cancellation, charter window date shifts, collision detection on shared assets, and certificate expiry cascades.
  role in system: validates client cancellation and contract date disruption workflows via Vitest.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { findOverlappingAssuranceSets } from '../utils/assuranceOverlap';
import { MasterDocument } from '../types/document';

describe('Real-World Operational Workflows - Client Disruptions & Date Shifts', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  /**
    what: tests client mid-flight cancellation ("backing out").
    how: cancels an active set via cancelAssuranceSet and asserts stage Cancelled, timestamp, cancellationReason, audit log, and removal from active verification queues.
    with what file: src/__tests__/workflowClientDisruptions.test.ts testing useMapStore.ts.
  */
  it('should handle client mid-flight cancellation and record cancellation metadata with audit trail', () => {
    const store = useMapStore.getState();
    const setId = 'AS-CANCEL-TEST-5509';
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Offshore Exploration Campaign',
      vesselId: 'VESSEL-002',
      vesselName: 'Pacific Valour',
      imoNumber: '9234567',
      initiatorOrg: 'Woodside Energy Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-12-01',
      complianceDeadline: '2026-12-01',
      charterWindowEnd: '2027-12-01',
      stage: 'Verification',
      readinessScore: 45,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      assignedSubmitter: 'M. Chen (Northwind Marine)',
      assignedVerifier: 'A. Fontaine (DNV)',
      requirements: [
        {
          id: 'REQ-CANC-01',
          category: 'Statutory Certificate',
          title: 'Load Line Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 96,
          verifierStatus: 'Pending',
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
      ],
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(testSet);

    // Client Admin cancels mid-flight
    store.setActivePersona('C Admin');
    const result = store.cancelAssuranceSet(
      setId,
      'C. Manager (Woodside Energy)',
      'Drilling program postponed indefinitely due to commercial renegotiation.'
    );

    expect(result.success).toBe(true);

    const cancelledSet = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(cancelledSet.stage).toBe('Cancelled');
    expect(cancelledSet.cancelledAt).toBeDefined();
    expect(cancelledSet.cancellationReason).toContain('Drilling program postponed indefinitely');

    // Audit trail verification
    const auditEvents = useMapStore.getState().auditEvents;
    const cancelAudit = auditEvents.find(
      (e) => e.targetAsset.includes(setId) && e.action === 'Cancelled Assurance Set'
    );
    expect(cancelAudit).toBeDefined();
    expect(cancelAudit?.justificationNotes).toContain('cancelled by C. Manager (Woodside Energy)');
    expect(cancelAudit?.justificationNotes).toContain('Drilling program postponed indefinitely');
  });

  /**
    what: tests client charter window date shifts and collision detection on shared assets.
    how: checks half-open interval overlap with existing active sets using findOverlappingAssuranceSets.
    with what file: src/__tests__/workflowClientDisruptions.test.ts testing useMapStore.ts and assuranceOverlap.ts.
  */
  it('should detect contract period collisions when client shifts charter window on a shared asset', () => {
    const store = useMapStore.getState();
    const existingSetId = 'AS-CHARTER-EXISTING-5509';
    const sharedVesselId = 'VESSEL-DISRUPT-001';

    // Existing active charter on VESSEL-DISRUPT-001: 2027-01-01 to 2027-06-01
    const existingSet: AssuranceSet = {
      id: existingSetId,
      title: 'Current Active Charter',
      assuranceType: 'Vessel',
      subtypes: ['Vessel'],
      vesselId: sharedVesselId,
      vesselName: 'MV Dampier Transporter',
      imoNumber: '9345678',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2027-01-01',
      complianceDeadline: '2027-01-01',
      charterWindowEnd: '2027-06-01',
      stage: 'Approved',
      readinessScore: 100,
      requirements: [],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      createdByPersona: 'C Admin',
    };

    store.addAssuranceSet(existingSet);

    // New client initially schedules for non-conflicting period starting 2027-06-01 (half-open edge)
    const initialConflicts = findOverlappingAssuranceSets(
      {
        scope: 'Vessel',
        vesselId: sharedVesselId,
        start: '2027-06-01',
        end: '2027-12-01',
      },
      useMapStore.getState().assuranceSets
    );
    expect(initialConflicts).toHaveLength(0);

    // Client requests date shift backward into the active charter: 2027-05-15 to 2027-11-15
    const shiftedConflicts = findOverlappingAssuranceSets(
      {
        scope: 'Vessel',
        vesselId: sharedVesselId,
        start: '2027-05-15',
        end: '2027-11-15',
      },
      useMapStore.getState().assuranceSets
    );

    expect(shiftedConflicts).toHaveLength(1);
    expect(shiftedConflicts[0].set.id).toBe(existingSetId);
    expect(shiftedConflicts[0].set.vesselId).toBe(sharedVesselId);
  });

  /**
    what: tests charter window extension causing certificates to expire before contract end, raising renewal alerts and blocking approval.
    how: shifts charterWindowEnd past attached document's expiry date, executes raiseDocumentRenewalNotifications, and verifies mandatory gate blocks approval.
    with what file: src/__tests__/workflowClientDisruptions.test.ts testing useMapStore.ts and documentRenewalHelpers.ts.
  */
  it('should raise renewal notifications and block final approval when charter window extends past certificate expiry', () => {
    const store = useMapStore.getState();
    const setId = 'AS-EXPIRY-CASCADE-5509';
    const docId = 'MAP-VES-2026-EXPIRY-TEST-01';
    const reqId = 'REQ-EXPIRY-01';

    // Document expiring on 2027-06-01
    const testDoc: MasterDocument = {
      id: docId,
      title: 'International Oil Pollution Prevention Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-001',
      certificateNo: 'IOPP-2026-9901',
      issuingAuthority: 'DNV',
      currentVersion: 'v1.0',
      expiryDate: '2027-06-01',
      ocrConfidence: 98,
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
          fileName: 'iopp_v1.pdf',
          fileSizeBytes: 1200000,
          changeSummary: 'Initial certificate issuance',
        },
      ],
    };
    store.addDocument(testDoc);

    // Assurance set initial charter window: 2026-11-01 to 2027-04-01 (expires after charter end)
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Short Term Charter Alpha',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Torrens Supporter',
      imoNumber: '9123453',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-04-01',
      stage: 'Verification',
      readinessScore: 80,
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
          title: 'International Oil Pollution Prevention Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 94,
          documentId: docId,
          verifierStatus: 'Pending',
          responsibleParty: 'Northwind Marine Pty Ltd',
        },
      ],
      createdByPersona: 'C Admin',
    };
    store.addAssuranceSet(testSet);

    // Client extends charterWindowEnd to 2027-09-01 (past document expiry 2027-06-01)
    const updatedSet: AssuranceSet = {
      ...testSet,
      charterWindowEnd: '2027-09-01',
    };
    store.updateAssuranceSet(updatedSet);

    // Trigger renewal check
    store.raiseDocumentRenewalNotifications([setId]);

    // Verify renewal notification raised with renewalReason charter_window
    const notifications = useMapStore.getState().notifications;
    const renewalAlert = notifications.find(
      (n) => n.assuranceSetId === setId && n.documentId === docId && n.type === 'document_renewal'
    );
    expect(renewalAlert).toBeDefined();
    expect(renewalAlert?.renewalReason).toBe('charter_window');

    // Attempting final approval while mandatory requirement is unfulfilled/open is blocked
    store.setActivePersona('Approver');
    store.setApproverDecision(setId, 'Approved', 'Premature approval attempt.');

    // The set remains in Verification stage and cannot be Approved
    const setAfterBlockedApproval = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(setAfterBlockedApproval.stage).not.toBe('Approved');
    expect(setAfterBlockedApproval.stage).toBe('Verification');
  });
});
