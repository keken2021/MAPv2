/*
  file summary: tests the three numbers that measure what shared evidence saves.
  responsibilities: verifies the reused document count, the re-verification count and the average days to clearance.
  role in system: covers src/utils/valueMetrics.ts; gap review finding G8.
*/

import { describe, expect, it } from 'vitest';
import { averageDaysToClearance, countReVerifications, countReusedDocuments } from '../utils/valueMetrics';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';

const req = (documentId: string, verifierStatus: AssuranceRequirement['verifierStatus']): AssuranceRequirement => ({
  id: `req-${documentId}`,
  category: 'Statutory Certificate',
  title: documentId,
  isMandatory: true,
  isFulfilled: verifierStatus === 'Verified',
  ocrConfidence: 95,
  documentId,
  verifierStatus,
});

const set = (id: string, requirements: AssuranceRequirement[], extra: Partial<AssuranceSet> = {}) =>
  ({ id, requirements, ...extra }) as AssuranceSet;

describe('value metrics', () => {
  const sets = [
    set('A', [req('DOC-1', 'Verified'), req('DOC-2', 'Pending')], {
      sentForReviewAt: '2026-10-01T00:00:00Z',
      lockedAt: '2026-10-11T00:00:00Z',
    }),
    set('B', [req('DOC-1', 'Verified'), req('DOC-2', 'Verified')]),
    set('C', [req('DOC-1', 'Verified')], { sentForReviewAt: '2026-10-01T00:00:00Z', lockedAt: '2026-10-05T00:00:00Z' }),
  ];

  it('counts documents held by more than one set', () => {
    expect(countReusedDocuments(sets)).toBe(2);
  });

  it('counts each verification of a document after its first', () => {
    expect(countReVerifications(sets)).toBe(2);
  });

  it('averages the days from review to approval, or reports no data', () => {
    expect(averageDaysToClearance(sets)).toBe(7);
    expect(averageDaysToClearance([set('D', [])])).toBeUndefined();
  });
});
