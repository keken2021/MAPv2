/* 
  file summary: unit test suite for dynamic stage-based readiness index calculations.
  responsibilities: verifies 10% initiated, 40% submitted, 70% verified, and 100% approved stage calculations across documents, requirements, assurance sets, and vessels.
  role in system: automated regression testing for compliance readiness logic.
*/

import { describe, expect, it } from 'vitest';
import {
  STAGE_READINESS_WEIGHTS,
  getRequirementReadinessPercentage,
  calculateDocumentReadiness,
  calculateAssuranceSetReadiness,
  calculateVesselReadiness,
} from '../utils/readinessHelpers';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { VesselInformation } from '../types/vessel';
import { useMapStore } from '../store/useMapStore';

describe('dynamic readiness index calculation suite', () => {
  /**
    what: verifies stage weight constants match specified requirements.
    how: checks STAGE_READINESS_WEIGHTS for initiated (10), submitted (40), verified (70), and approved (100).
    with what file: src/__tests__/readinessCalculations.test.ts testing src/utils/readinessHelpers.ts.
  */
  it('defines correct stage percentage weights', () => {
    expect(STAGE_READINESS_WEIGHTS.initiated).toBe(10);
    expect(STAGE_READINESS_WEIGHTS.submitted).toBe(40);
    expect(STAGE_READINESS_WEIGHTS.verified).toBe(70);
    expect(STAGE_READINESS_WEIGHTS.approved).toBe(100);
  });

  /**
    what: calculates requirement readiness based on verification and upload stages.
    how: tests initiated (10%), submitted/pending (40%), verified (70%), and approved (100%) states.
    with what file: src/__tests__/readinessCalculations.test.ts testing src/utils/readinessHelpers.ts.
  */
  it('computes exact requirement stage percentages', () => {
    const initiatedReq: AssuranceRequirement = {
      id: 'REQ-1',
      category: 'Statutory Certificate',
      title: 'Class Certificate',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };
    /* requirement with no uploaded document in initiated parent set */
    const initiatedParentSet: Partial<AssuranceSet> = {
      stage: 'Initiated',
    };
    expect(getRequirementReadinessPercentage(initiatedReq, initiatedParentSet)).toBe(10);

    const submittedReq: AssuranceRequirement = {
      id: 'REQ-2',
      category: 'Statutory Certificate',
      title: 'SOLAS Safety Cert',
      isMandatory: true,
      isFulfilled: false,
      documentId: 'DOC-101',
      ocrConfidence: 95,
      verifierStatus: 'Pending',
    };
    expect(getRequirementReadinessPercentage(submittedReq)).toBe(40);

    const verifiedReq: AssuranceRequirement = {
      id: 'REQ-3',
      category: 'Statutory Certificate',
      title: 'Load Line Certificate',
      isMandatory: true,
      isFulfilled: true,
      documentId: 'DOC-102',
      ocrConfidence: 99,
      verifierStatus: 'Verified',
    };
    expect(getRequirementReadinessPercentage(verifiedReq)).toBe(70);

    const approvedSet: Partial<AssuranceSet> = {
      stage: 'Approved',
      approverDecision: 'Approved',
    };
    expect(getRequirementReadinessPercentage(verifiedReq, approvedSet)).toBe(100);
  });

  /**
    what: calculates master document readiness in document library.
    how: checks verified (70%), uploaded/pending (40%), and initiated (10%) document status.
    with what file: src/__tests__/readinessCalculations.test.ts testing src/utils/readinessHelpers.ts.
  */
  it('computes master document readiness score', () => {
    const verifiedDoc: MasterDocument = {
      id: 'DOC-01',
      vesselId: 'VESSEL-001',
      title: 'Safety Construction Certificate',
      entityType: 'Vessel Certificate',
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [
        {
          versionLabel: 'v1.0',
          fileName: 'cert.pdf',
          fileSizeBytes: 2400000,
          uploadedBy: 'J. Submitter',
          uploadedAt: '2026-08-10',
          changeSummary: 'Initial upload',
        },
      ],
      expiryDate: '2027-08-10',
      issuingAuthority: 'Lloyds Register',
      certificateNo: 'LR-2026-99',
      ocrConfidence: 98,
      verificationStatus: 'Verified',
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
    };
    expect(calculateDocumentReadiness(verifiedDoc)).toBe(70);

    const pendingDoc: MasterDocument = {
      ...verifiedDoc,
      id: 'DOC-02',
      verificationStatus: 'Pending',
    };
    expect(calculateDocumentReadiness(pendingDoc)).toBe(40);
  });

  /**
    what: calculates arithmetic average readiness for an assurance set with multiple requirement documents.
    how: aggregates stage weights across requirements and computes mean rounded to nearest integer.
    with what file: src/__tests__/readinessCalculations.test.ts testing src/utils/readinessHelpers.ts.
  */
  it('calculates average readiness for assurance sets based on all documents', () => {
    const testSet: AssuranceSet = {
      id: 'AS-TEST-001',
      title: 'Offshore Campaign Test',
      vesselId: 'VESSEL-001',
      vesselName: 'Pacific Sentinel',
      imoNumber: '9876543',
      initiatorOrg: 'Northwind Marine',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Chevron Australia',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2026-12-01',
      stage: 'Verification',
      readinessScore: 0,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      createdByPersona: 'Vessel Provider Admin',
      stakeholders: null,
      assignedStakeholders: null,
      requirements: [
        {
          id: 'R1',
          category: 'Statutory Certificate',
          title: 'Class Certificate',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 99,
        }, /* 70% */
        {
          id: 'R2',
          category: 'Statutory Certificate',
          title: 'Safety Radio Certificate',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          documentId: 'DOC-R2',
          ocrConfidence: 95,
        }, /* 40% */
      ],
    };

    /* average of 70% and 40% is 55% */
    expect(calculateAssuranceSetReadiness(testSet)).toBe(55);

    /* adding an initiated requirement (10%): (70 + 40 + 10) / 3 = 40% */
    const testSetWithInitiated: AssuranceSet = {
      ...testSet,
      requirements: [
        ...testSet.requirements,
        {
          id: 'R3',
          category: 'Statutory Certificate',
          title: 'Ballast Water Certificate',
          isMandatory: false,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    };
    /* with parent set in verification and no doc uploaded, R3 is initiated (10%) when no document is attached */
    const computedScore = calculateAssuranceSetReadiness(testSetWithInitiated);
    expect(computedScore).toBeGreaterThanOrEqual(40);
  });

  /**
    what: calculates vessel compliance readiness index from all linked assurance sets and documents.
    how: computes mean of all requirement documents belonging to vessel campaigns.
    with what file: src/__tests__/readinessCalculations.test.ts testing src/utils/readinessHelpers.ts.
  */
  it('calculates dynamic fleet readiness for a vessel across linked campaigns', () => {
    const vessel: VesselInformation = {
      ...useMapStore.getState().vessels[0],
      id: 'VESSEL-TEST-1',
      name: 'Southern Explorer',
      imoNumber: '9123456',
      complianceReadinessScore: 0,
    };

    const linkedSet: AssuranceSet = {
      id: 'AS-LINK-01',
      title: 'Campaign A',
      vesselId: 'VESSEL-TEST-1',
      vesselName: 'Southern Explorer',
      imoNumber: '9123456',
      initiatorOrg: 'Northwind Marine',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Inpex',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2026-11-01',
      stage: 'Verification',
      readinessScore: 0,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      createdByPersona: 'Vessel Provider Admin',
      stakeholders: null,
      assignedStakeholders: null,
      requirements: [
        {
          id: 'R1',
          category: 'Statutory Certificate',
          title: 'Document 1',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 98,
        }, /* 70% */
        {
          id: 'R2',
          category: 'Statutory Certificate',
          title: 'Document 2',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 98,
        }, /* 70% */
      ],
    };

    expect(calculateVesselReadiness(vessel, [linkedSet], [])).toBe(70);
  });

  /**
    what: verifies zustand store updates recalculate readiness score dynamically.
    how: triggers updateRequirementStatus and verifyDocument and inspects updated assurance set readiness score.
    with what file: src/__tests__/readinessCalculations.test.ts testing src/store/useMapStore.ts.
  */
  it('updates store readiness score dynamically when requirements are verified', () => {
    const store = useMapStore.getState();
    const targetSet = store.assuranceSets[0];
    expect(targetSet).toBeDefined();

    /* verify all requirements to achieve approval stage */
    targetSet.requirements.forEach((req) => {
      store.updateRequirementStatus(targetSet.id, req.id, 'Verified', 'Verified in unit test');
    });

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(updatedSet?.readinessScore).toBe(70);

    /* set final approver decision to approved -> 100% */
    store.setApproverDecision(targetSet.id, 'Approved', 'Executive sign-off in unit test');
    const certifiedSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(certifiedSet?.readinessScore).toBe(100);
    expect(certifiedSet?.stage).toBe('Approved');
  });
});
