/*
  file summary: tests that a verification decision belongs to one requirement on one assurance set.
  responsibilities: verifies that verifying, returning or rejecting on one set leaves another set using the same library document unchanged, that a set denial leaves documents of the same vessel alone, and that a new version resets only the requirement it was submitted for while other open sets get a notice.
  role in system: covers useMapStore.ts (verifyDocument, setApproverDecision, addDocumentVersion); gap review findings E1 and E2.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { isClosedAssuranceSet } from '../utils/documentVersionSnapshot';
import type { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();
const getSet = (id: string) => useMapStore.getState().assuranceSets.find((s) => s.id === id)!;

/* two open sets whose first requirement uses the same library document */
function shareOneDocument(): { setA: AssuranceSet; setB: AssuranceSet; docId: string } {
  const open = useMapStore.getState().assuranceSets.filter(
    (s) => !isClosedAssuranceSet(s) && s.requirements.length > 0 && s.assignedVerifier,
  );
  const [first, second] = open;
  const docId = useMapStore.getState().documents[0].id;
  const share = (s: AssuranceSet): AssuranceSet => ({
    ...s,
    requirements: s.requirements.map((r, i) =>
      i === 0 ? { ...r, documentId: docId, verifierStatus: 'Pending', isFulfilled: false } : r,
    ),
  });
  useMapStore.setState({
    assuranceSets: useMapStore
      .getState()
      .assuranceSets.map((s) => (s.id === first.id ? share(s) : s.id === second.id ? share(s) : s)),
  });
  return { setA: getSet(first.id), setB: getSet(second.id), docId };
}

describe('set-scoped verification', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.getState().setActivePersona('Administrator');
  });

  it.each(['Verified', 'Correction Requested', 'Rejected'] as const)(
    'a %s decision on set A leaves set B unchanged',
    (status) => {
      const { setA, setB, docId } = shareOneDocument();
      const reqA = setA.requirements[0];

      useMapStore.getState().verifyDocument(docId, status, 'Decision on set A.', undefined, reqA.id, setA.id);

      expect(getSet(setA.id).requirements[0].verifierStatus).toBe(status);
      expect(getSet(setB.id).requirements).toEqual(setB.requirements);
    },
  );

  it('a set rejection leaves the documents of the same vessel alone', () => {
    const set = useMapStore.getState().assuranceSets.find((s) => s.vesselId && !isClosedAssuranceSet(s))!;
    const docsBefore = useMapStore.getState().documents;

    useMapStore.getState().setApproverDecision(set.id, 'Rejected', 'Rejected for test.');

    expect(useMapStore.getState().documents).toEqual(docsBefore);
    getSet(set.id).requirements.forEach((r) => expect(r.verifierStatus).toBe('Rejected'));
  });

  it('a new version resets only the requirement it was submitted for and tells the other set', () => {
    const { setA, setB, docId } = shareOneDocument();
    useMapStore.getState().verifyDocument(docId, 'Verified', 'Verified on B.', undefined, setB.requirements[0].id, setB.id);
    const notificationsBefore = useMapStore.getState().notifications.length;

    useMapStore.getState().addDocumentVersion(docId, 'v9.0', 'renewed.pdf', 1024, 'Renewed.', undefined, {
      assuranceSetId: setA.id,
      requirementId: setA.requirements[0].id,
    });

    expect(getSet(setA.id).requirements[0].documentVersion).toBe('v9.0');
    expect(getSet(setA.id).requirements[0].verifierStatus).toBe('Pending');
    expect(getSet(setB.id).requirements[0].verifierStatus).toBe('Verified');
    expect(getSet(setB.id).requirements[0].documentVersion).not.toBe('v9.0');
    const notices = useMapStore
      .getState()
      .notifications.slice(0, useMapStore.getState().notifications.length - notificationsBefore)
      .filter((n) => n.type === 'document_new_version');
    expect(notices.some((n) => n.assuranceSetId === setB.id && n.documentId === docId)).toBe(true);
  });
});
