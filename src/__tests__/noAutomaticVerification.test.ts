/*
  file summary: tests that attaching or uploading a document never counts as verifying it.
  responsibilities: verifies that an auto-attached requirement is submitted (40), not verified (70), and that a crew upload sent in as Verified is stored as Pending.
  role in system: covers documentMatchingHelpers.ts (autoAttachDocumentsToRequirements), readinessHelpers.ts and useMapStore.ts (addCrewDocument); gap review finding E3.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { autoAttachDocumentsToRequirements } from '../utils/documentMatchingHelpers';
import { getRequirementReadinessPercentage, STAGE_READINESS_WEIGHTS } from '../utils/readinessHelpers';
import type { AssuranceRequirement } from '../types/assurance';

const initialState = useMapStore.getState();

describe('no automatic verification', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('scores an attached but unreviewed requirement as submitted, not verified', () => {
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
    expect(getRequirementReadinessPercentage(attached, { stage: 'Validation' })).toBe(STAGE_READINESS_WEIGHTS.submitted);
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
