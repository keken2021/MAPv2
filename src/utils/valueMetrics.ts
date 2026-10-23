/*
  file summary: the three numbers that start to measure what shared evidence saves.
  responsibilities: counts documents reused across sets and repeated verifications of one document, and averages the days from review to approval.
  role in system: used by DashboardView.tsx; gap review finding G8 (paper P14, 18.2: the cost of repeated checks is unmeasured).
*/

import type { AssuranceSet } from '../types/assurance';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/* the documents each set's requirements hold */
function documentIdsBySet(sets: AssuranceSet[]): Map<string, Set<string>> {
  const setsByDocument = new Map<string, Set<string>>();
  sets.forEach((set) =>
    set.requirements.forEach((r) => {
      const docId = r.documentId || r.linkedDocumentId;
      if (!docId) return;
      if (!setsByDocument.has(docId)) setsByDocument.set(docId, new Set());
      setsByDocument.get(docId)!.add(set.id);
    }),
  );
  return setsByDocument;
}

/**
  what: how many library documents are held by more than one set; input is all sets.
  how: groups requirement documents by document id and counts those on two sets or more.
  with what file: src/utils/valueMetrics.ts used by DashboardView.tsx.
*/
export function countReusedDocuments(sets: AssuranceSet[]): number {
  return [...documentIdsBySet(sets).values()].filter((setIds) => setIds.size > 1).length;
}

/**
  what: how many times a document was verified again on another set; input is all sets.
  how: for each document, the sets where its requirement is verified, less the first one.
  with what file: src/utils/valueMetrics.ts used by DashboardView.tsx.
*/
export function countReVerifications(sets: AssuranceSet[]): number {
  const verifiedSetsByDocument = new Map<string, Set<string>>();
  sets.forEach((set) =>
    set.requirements.forEach((r) => {
      const docId = r.documentId || r.linkedDocumentId;
      if (!docId || r.verifierStatus !== 'Verified') return;
      if (!verifiedSetsByDocument.has(docId)) verifiedSetsByDocument.set(docId, new Set());
      verifiedSetsByDocument.get(docId)!.add(set.id);
    }),
  );
  return [...verifiedSetsByDocument.values()].reduce((sum, setIds) => sum + Math.max(0, setIds.size - 1), 0);
}

/**
  what: the average whole days from sending a set for review to its approval lock; input is all sets.
  how: averages lockedAt minus sentForReviewAt over sets that have both; undefined when none has.
  with what file: src/utils/valueMetrics.ts used by DashboardView.tsx.
*/
export function averageDaysToClearance(sets: AssuranceSet[]): number | undefined {
  const durations = sets
    .filter((s) => s.sentForReviewAt && s.lockedAt)
    .map((s) => (new Date(s.lockedAt!).getTime() - new Date(s.sentForReviewAt!).getTime()) / MS_PER_DAY)
    .filter((days) => Number.isFinite(days) && days >= 0);
  if (durations.length === 0) return undefined;
  return Math.round(durations.reduce((sum, days) => sum + days, 0) / durations.length);
}
