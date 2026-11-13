/*
  file summary: tests that attaching or uploading a document never counts as verifying it, narrowed by ADR 0041 for reused documents.
  responsibilities: verifies that a hand-attached or uploaded requirement is submitted (40), not verified (70), whereas a reused verified document on file starts Verified (70) and fulfilled, and that a crew upload sent in as Verified is stored as Pending.
  role in system: covers documentMatchingHelpers.ts (autoAttachDocumentsToRequirements), readinessHelpers.ts and useMapStore.ts (addCrewDocument); gap review finding E3 narrowed by ADR 0041.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { autoAttachDocumentsToRequirements } from '../utils/documentMatchingHelpers';
import { getRequirementReadinessPercentage, STAGE_READINESS_WEIGHTS } from '../utils/readinessHelpers';
import type { AssuranceRequirement } from '../types/assurance';
import type { MasterDocument } from '../types/document';

const initialState = useMapStore.getState();

describe('no automatic verification (gap review E3, narrowed for reused documents)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('scores a hand-attached or unreviewed slot as submitted, not verified', () => {
    const req: AssuranceRequirement = {
      id: 'req-e3',
      category: 'Statutory Certificate',
      title: 'Class Certificate',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      documentId: useMapStore.getState().documents[0].id,
      verifierStatus: 'Pending',
    };
    const [attached] = autoAttachDocumentsToRequirements([req], {
      vessels: [],
      documents: useMapStore.getState().documents,
      crew: [],
    } as never);

    expect(attached.isFulfilled).toBe(false);
    expect(attached.verifierStatus).toBe('Pending');
    expect(attached.reusedDocument).toBeUndefined();
    expect(getRequirementReadinessPercentage(attached, { stage: 'Validation' })).toBe(STAGE_READINESS_WEIGHTS.submitted);
  });

  it('marks a reused verified document on file as Verified and fulfilled', () => {
    const vessel = useMapStore.getState().vessels[0];
    const verifiedDoc: MasterDocument = {
      ...useMapStore.getState().documents[0],
      id: 'DOC-VERIFIED-REUSE-001',
      vesselId: vessel.id,
      targetObjectType: 'Vessel',
      targetObjectId: vessel.id,
      docTypeId: 'vessel-class-cert',
      verificationStatus: 'Verified',
      complianceState: 'Valid',
      expiryDate: '2028-12-31',
    };

    const req: AssuranceRequirement = {
      id: 'req-reuse',
      docTypeId: 'vessel-class-cert',
      category: 'Statutory Certificate',
      title: 'Certificate of Class',
      subtype: 'Vessel',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    const [attached] = autoAttachDocumentsToRequirements([req], {
      vessel,
      vessels: [vessel],
      documents: [verifiedDoc],
    });

    expect(attached.documentId).toBe('DOC-VERIFIED-REUSE-001');
    expect(attached.reusedDocument).toBe(true);
    expect(attached.isFulfilled).toBe(true);
    expect(attached.verifierStatus).toBe('Verified');
    expect(getRequirementReadinessPercentage(attached, { stage: 'Validation' })).toBe(STAGE_READINESS_WEIGHTS.verified);
  });

  it('stores a crew upload sent in as Verified as Pending', () => {
    const crew = useMapStore.getState().crew[0];
    useMapStore.getState().addCrewDocument(crew.id, {
      id: 'MAP-CRW-2026-STCW-E3001',
      title: 'Basic Safety Training',
      layer: 'Layer 1 - Universal Core',
      stcwRegulation: 'STCW Reg VI/1',
      certificateNo: 'BST-E3',
      issuingAuthority: 'AMSA',
      issueDate: '2026-01-01',
      expiryDate: '2031-01-01',
      verificationStatus: 'Verified',
    });

    const stored = useMapStore
      .getState()
      .crew.find((c) => c.id === crew.id)!
      .layer1CoreDocuments.find((d) => d.id === 'MAP-CRW-2026-STCW-E3001');
    expect(stored?.verificationStatus).toBe('Pending');
    expect(useMapStore.getState().documents.find((d) => d.id === 'MAP-CRW-2026-STCW-E3001')?.verificationStatus).toBe('Pending');
  });
});
