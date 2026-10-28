import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MasterDocument } from '../types/document';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { CapaItem } from '../types/capa';
import {
  isRequirementLate,
  getAssuranceSetOnTimeStatus,
  getAssuranceSetOpenFindings,
  getAssuranceSetOpenFindingsCount,
  getAssuranceSetRemainingItems,
  getFleetPerformanceSummary,
} from '../utils/readinessHelpers';

describe('Performance Data Capture (Task 5201 / BRD V4.2 change 12)', () => {
  const sampleDoc: MasterDocument = {
    id: 'DOC-PERF-01',
    title: 'Cargo Ship Safety Construction Certificate',
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-PERF-01',
    certificateNo: 'DNV-PERF-2026',
    issuingAuthority: 'DNV',
    expiryDate: '2027-12-31',
    ocrConfidence: 98,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    versions: [
      {
        versionLabel: 'v1.0',
        uploadedAt: '2026-10-01T10:00:00.000Z',
        uploadedBy: 'CREW-001',
        fileSizeBytes: 1200000,
        fileName: 'safety_construction_v1.pdf',
        changeSummary: 'Initial upload',
        attemptNumber: 1,
      },
    ],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Pending',
  };

  const sampleSet: AssuranceSet = {
    id: 'AS-PERF-001',
    title: 'Performance Test Assurance Set',
    assuranceType: 'Vessel',
    vesselId: 'VESSEL-PERF-01',
    vesselName: 'MV Performance Pioneer',
    imoNumber: '9988776',
    initiatorOrg: 'Chevron Australia Pty Ltd',
    initiatorRole: 'C Admin · Client Created',
    charterer: 'Chevron Australia Pty Ltd',
    clientOrg: 'Chevron Australia Pty Ltd',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-11-01',
    complianceDeadline: '2026-11-01',
    charterWindowEnd: '2027-11-01',
    stage: 'Verification',
    readinessScore: 40,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    requirements: [
      {
        id: 'REQ-PERF-01',
        category: 'Statutory Certificate',
        title: 'Cargo Ship Safety Construction',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 98,
        documentId: 'DOC-PERF-01',
        documentVersion: 'v1.0',
        verifierStatus: 'Pending',
        targetDate: '2026-11-01',
        attemptNumber: 1,
      },
      {
        id: 'REQ-PERF-02',
        category: 'Inspection Report',
        title: 'OVID Annual Inspection Report',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 95,
        verifierStatus: 'Pending',
        targetDate: '2026-10-15', // Past date
      },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({
      assuranceSets: [sampleSet],
      documents: [sampleDoc],
      capaItems: [
        {
          id: 'CAPA-PERF-01',
          vesselName: 'MV Performance Pioneer',
          vesselId: 'VESSEL-PERF-01',
          checklistItemTitle: 'Liferaft inspection',
          title: 'Servicing of liferaft',
          findingDescription: 'Needs annual check',
          owner: 'Northwind Marine',
          dueDate: '2026-10-30',
          status: 'Open',
          createdDate: '2026-10-01',
          evidences: [],
        },
      ],
    });
  });

  describe('Submission attempt numbers and review decision times', () => {
    it('increases attempt number on resubmission of an existing requirement', () => {
      const store = useMapStore.getState();

      const newDoc: MasterDocument = {
        ...sampleDoc,
        id: 'DOC-PERF-02',
        title: 'Updated Cargo Ship Safety Construction',
        currentVersion: 'v2.0',
        versions: [
          {
            versionLabel: 'v2.0',
            uploadedAt: '2026-10-28T10:00:00.000Z',
            uploadedBy: 'CREW-001',
            fileSizeBytes: 1300000,
            fileName: 'safety_construction_v2.pdf',
            changeSummary: 'Resubmitted after correction',
          },
        ],
      };

      store.uploadDocumentForRequirement('AS-PERF-001', 'REQ-PERF-01', newDoc);

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-PERF-001');
      const updatedReq = updatedSet?.requirements.find((r) => r.id === 'REQ-PERF-01');

      expect(updatedReq?.attemptNumber).toBe(2);
      expect(updatedReq?.documentId).toBe('DOC-PERF-02');
      expect(updatedReq?.verifierStatus).toBe('Pending');
      expect(updatedReq?.decisionTime).toBeUndefined();
    });

    it('increases attempt number when adding a new document version', () => {
      const store = useMapStore.getState();

      store.addDocumentVersion(
        'DOC-PERF-01',
        'v2.0',
        'safety_construction_v2.0.pdf',
        1400000,
        'Corrected typo in IMO',
        '2027-12-31',
        { assuranceSetId: 'AS-PERF-001', requirementId: 'REQ-PERF-01' },
      );

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-PERF-001');
      const updatedReq = updatedSet?.requirements.find((r) => r.id === 'REQ-PERF-01');

      expect(updatedReq?.attemptNumber).toBe(2);
      expect(updatedReq?.documentVersion).toBe('v2.0');
      expect(updatedReq?.verifierStatus).toBe('Pending');
      expect(updatedReq?.decisionTime).toBeUndefined();
    });

    it('stamps decision time when requirement status is updated by verifier', () => {
      const store = useMapStore.getState();

      store.updateRequirementStatus('AS-PERF-001', 'REQ-PERF-01', 'Verified', 'Looks good');

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-PERF-001');
      const updatedReq = updatedSet?.requirements.find((r) => r.id === 'REQ-PERF-01');

      expect(updatedReq?.verifierStatus).toBe('Verified');
      expect(updatedReq?.decisionTime).toBeDefined();
      expect(typeof updatedReq?.decisionTime).toBe('string');
      expect(new Date(updatedReq!.decisionTime!).getTime()).toBeGreaterThan(0);
    });

    it('stamps decision time when requirement is returned for correction', () => {
      const store = useMapStore.getState();

      store.updateRequirementStatus('AS-PERF-001', 'REQ-PERF-01', 'Correction Requested', 'Need stamp');

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-PERF-001');
      const updatedReq = updatedSet?.requirements.find((r) => r.id === 'REQ-PERF-01');

      expect(updatedReq?.verifierStatus).toBe('Correction Requested');
      expect(updatedReq?.decisionTime).toBeDefined();
    });
  });

  describe('Finding closedDate lifecycle', () => {
    it('sets closedDate when finding status changes to Verified & Closed', () => {
      const store = useMapStore.getState();

      const findingBefore = store.capaItems.find((c) => c.id === 'CAPA-PERF-01');
      expect(findingBefore?.closedDate).toBeUndefined();

      store.updateCapaStatus('CAPA-PERF-01', 'Verified & Closed', 'Verified on-site');

      const findingAfter = useMapStore.getState().capaItems.find((c) => c.id === 'CAPA-PERF-01');
      expect(findingAfter?.status).toBe('Verified & Closed');
      expect(findingAfter?.closedDate).toBeDefined();
      expect(new Date(findingAfter!.closedDate!).getTime()).toBeGreaterThan(0);
    });

    it('clears closedDate when finding is flagged for re-inspection', () => {
      const store = useMapStore.getState();

      store.updateCapaStatus('CAPA-PERF-01', 'Verified & Closed');
      let finding = useMapStore.getState().capaItems.find((c) => c.id === 'CAPA-PERF-01');
      expect(finding?.closedDate).toBeDefined();

      store.flagCapaForReinspection('CAPA-PERF-01', 'New issue spotted');
      finding = useMapStore.getState().capaItems.find((c) => c.id === 'CAPA-PERF-01');

      expect(finding?.status).toBe('Under Re-Inspection');
      expect(finding?.closedDate).toBeUndefined();
    });
  });

  describe('Delivery performance metrics helpers', () => {
    const today = new Date('2026-10-28T00:00:00Z');

    it('flags late requirements when target date is before comparison date', () => {
      const onTimeTask: AssuranceRequirement = {
        id: 'T1',
        category: 'Statutory Certificate',
        title: 'Class',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 90,
        verifierStatus: 'Pending',
        targetDate: '2026-11-01',
      };
      const lateTask: AssuranceRequirement = {
        id: 'T2',
        category: 'Statutory Certificate',
        title: 'Safety',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 90,
        verifierStatus: 'Pending',
        targetDate: '2026-10-20',
      };
      const verifiedLateTask: AssuranceRequirement = {
        ...lateTask,
        isFulfilled: true,
        verifierStatus: 'Verified',
      };

      expect(isRequirementLate(onTimeTask, today)).toBe(false);
      expect(isRequirementLate(lateTask, today)).toBe(true);
      expect(isRequirementLate(verifiedLateTask, today)).toBe(false);
    });

    it('evaluates on-time status of assurance set with a late item', () => {
      const status = getAssuranceSetOnTimeStatus(sampleSet, today);

      expect(status.isOnTime).toBe(false);
      expect(status.statusLabel).toBe('Late');
      expect(status.lateItemsCount).toBe(1);
    });

    it('evaluates on-time status of assurance set with no late items', () => {
      const onTimeSet: AssuranceSet = {
        ...sampleSet,
        requirements: [
          {
            ...sampleSet.requirements[0],
            targetDate: '2026-11-10',
          },
          {
            ...sampleSet.requirements[1],
            targetDate: '2026-11-15',
          },
        ],
      };

      const status = getAssuranceSetOnTimeStatus(onTimeSet, today);
      expect(status.isOnTime).toBe(true);
      expect(status.statusLabel).toBe('On time');
      expect(status.lateItemsCount).toBe(0);
    });

    it('counts open findings and remaining items for an assurance set', () => {
      const capaItems: CapaItem[] = [
        {
          id: 'C1',
          vesselName: 'MV Performance Pioneer',
          vesselId: 'VESSEL-PERF-01',
          checklistItemTitle: 'Item 1',
          title: 'Open Finding 1',
          findingDescription: 'Desc',
          owner: 'Owner',
          dueDate: '2026-11-01',
          status: 'Open',
          createdDate: '2026-10-01',
          evidences: [],
        },
        {
          id: 'C2',
          vesselName: 'MV Performance Pioneer',
          vesselId: 'VESSEL-PERF-01',
          checklistItemTitle: 'Item 2',
          title: 'Closed Finding',
          findingDescription: 'Desc',
          owner: 'Owner',
          dueDate: '2026-10-15',
          status: 'Verified & Closed',
          closedDate: '2026-10-20T10:00:00.000Z',
          createdDate: '2026-10-01',
          evidences: [],
        },
        {
          id: 'C3',
          vesselName: 'Other Vessel',
          vesselId: 'VESSEL-OTHER',
          checklistItemTitle: 'Item 3',
          title: 'Other Finding',
          findingDescription: 'Desc',
          owner: 'Owner',
          dueDate: '2026-11-01',
          status: 'Open',
          createdDate: '2026-10-01',
          evidences: [],
        },
      ];

      const findings = getAssuranceSetOpenFindings(sampleSet, capaItems);
      expect(findings.length).toBe(1);
      expect(findings[0].id).toBe('C1');

      const count = getAssuranceSetOpenFindingsCount(sampleSet, capaItems);
      expect(count).toBe(1);

      const remaining = getAssuranceSetRemainingItems(sampleSet);
      expect(remaining.remainingTasks).toBe(2);
      expect(remaining.remainingCertificates).toBe(1); // REQ-PERF-01 is 'Statutory Certificate'
    });

    it('aggregates fleet performance summary accurately', () => {
      const capaList: CapaItem[] = [
        {
          id: 'C1',
          vesselName: 'MV Performance Pioneer',
          vesselId: 'VESSEL-PERF-01',
          checklistItemTitle: 'Item 1',
          title: 'Open Finding 1',
          findingDescription: 'Desc',
          owner: 'Owner',
          dueDate: '2026-11-01',
          status: 'Open',
          createdDate: '2026-10-01',
          evidences: [],
        },
      ];

      const summary = getFleetPerformanceSummary([sampleSet], capaList, today);

      expect(summary.totalSets).toBe(1);
      expect(summary.onTimeSets).toBe(0);
      expect(summary.lateSets).toBe(1);
      expect(summary.openFindings).toBe(1);
      expect(summary.remainingTasks).toBe(2);
      expect(summary.remainingCertificates).toBe(1);
    });
  });
});
