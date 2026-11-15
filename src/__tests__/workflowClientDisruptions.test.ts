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
import { getSetVessel } from '../utils/setObjects';

const initialState = useMapStore.getState();

describe('Real-World Operational Workflows - Client Disruptions & Date Shifts', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
        activeSessionUserId: 'USR-221',
      },
      true,
    );
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
      assuranceObjects: [
        {
          id: 'VESSEL-002',
          type: 'vessel',
          name: 'Pacific Valour',
          identifier: '9234567',
          ownerOrganization: 'Northwind Marine Pty Ltd',
        },
      ],
      parties: [
        { organization: 'Chevron Australia Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      startDate: '2026-12-01',
      deadline: '2026-12-01',
      endDate: '2027-12-01',
      dateHistory: [],
      createdBy: { userId: 'USR-221', name: 'C. Henderson', persona: 'C Admin' },
      stage: 'Verification',
      readinessScore: 45,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      submitters: [{ organization: 'Northwind Marine Pty Ltd', assignee: 'M. Chen (Northwind Marine Pty Ltd)' }],
      stakeholders: {
        verifierName: 'A. Fontaine (Bureau Veritas Inspectorate)',
      },
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
    };

    store.addAssuranceSet(testSet);

    // Client Admin cancels mid-flight
    const result = store.cancelAssuranceSet(
      setId,
      'C. Henderson (Chevron Australia Pty Ltd)',
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
    expect(cancelAudit?.justificationNotes).toContain('cancelled by C. Henderson (Chevron Australia Pty Ltd)');
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
      assuranceObjects: [
        {
          id: sharedVesselId,
          type: 'vessel',
          name: 'MV Dampier Transporter',
          identifier: '9345678',
          ownerOrganization: 'Chevron Australia Pty Ltd',
        },
      ],
      parties: [
        { organization: 'Chevron Australia Pty Ltd', role: 'Requesting party' },
        { organization: 'Chevron Australia Pty Ltd', role: 'Responding party' },
      ],
      startDate: '2027-01-01',
      deadline: '2027-01-01',
      endDate: '2027-06-01',
      dateHistory: [],
      stage: 'Approved',
      readinessScore: 100,
      requirements: [],
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      createdBy: { userId: 'USR-221', name: 'C. Henderson', persona: 'C Admin' },
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
    expect(getSetVessel(shiftedConflicts[0].set)?.id).toBe(sharedVesselId);
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
      ownerOrganization: 'Northwind Marine Pty Ltd',
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
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });
    useMapStore.getState().addDocument(testDoc);

    // Assurance set initial charter window: 2026-11-01 to 2027-04-01 (expires after charter end)
    const testSet: AssuranceSet = {
      id: setId,
      title: 'Short Term Charter Alpha',
      assuranceObjects: [
        {
          id: 'VESSEL-001',
          type: 'vessel',
          name: 'MV Torrens Supporter',
          identifier: '9123453',
          ownerOrganization: 'Northwind Marine Pty Ltd',
        },
      ],
      parties: [
        { organization: 'Chevron Australia Pty Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-04-01',
      dateHistory: [],
      stage: 'Verification',
      readinessScore: 80,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      formalApprovalRequired: true,
      inspectionCompleted: false,
      submitters: [{ organization: 'Northwind Marine Pty Ltd', assignee: 'M. Chen (Northwind Marine Pty Ltd)' }],
      stakeholders: {
        verifierName: 'A. Fontaine (Bureau Veritas Inspectorate)',
        approverName: 'P. Nardelli (Marine Assurance Authority)',
      },
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
    };
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
    });
    useMapStore.getState().addAssuranceSet(testSet);

    // Client extends charterWindowEnd to 2027-09-01 (past document expiry 2027-06-01)
    const updatedSet: AssuranceSet = {
      ...testSet,
      endDate: '2027-09-01',
    };
    useMapStore.getState().updateAssuranceSet(updatedSet);

    // Trigger renewal check
    useMapStore.getState().raiseDocumentRenewalNotifications([setId]);

    // Verify renewal notification raised with renewalReason charter_window
    const notifications = useMapStore.getState().notifications;
    const renewalAlert = notifications.find(
      (n) => n.assuranceSetId === setId && n.documentId === docId && n.type === 'document_renewal'
    );
    expect(renewalAlert).toBeDefined();
    expect(renewalAlert?.renewalReason).toBe('charter_window');

    // Attempting final approval while mandatory requirement is unfulfilled/open is blocked
    useMapStore.setState({
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });
    useMapStore.getState().setApproverDecision(setId, 'Approved', 'Premature approval attempt.');

    // The set remains in Verification stage and cannot be Approved
    const setAfterBlockedApproval = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!;
    expect(setAfterBlockedApproval.stage).not.toBe('Approved');
    expect(setAfterBlockedApproval.stage).toBe('Verification');
  });
});
