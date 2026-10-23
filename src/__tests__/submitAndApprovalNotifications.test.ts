/*
  file summary: tests who is told when a document is submitted and when a set's documents are all verified.
  responsibilities: verifies that a submitted document notifies the set's verifier, that a set with no verifier sends nothing, and that the appointed approver is notified once, when the last required document is verified.
  role in system: covers useMapStore.ts (uploadDocumentForRequirement, addDocumentVersion, verifyDocument).
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { filterNotificationsForUser, resolveNotificationRecipient } from '../utils/notificationHelpers';
import { isClosedAssuranceSet } from '../utils/documentVersionSnapshot';
import type { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();
const inboxOf = (userId: string) => filterNotificationsForUser(useMapStore.getState().notifications, userId);

/* an open set whose verifier and approver both resolve to users */
function staffedOpenSet(): AssuranceSet {
  const { assuranceSets, users } = useMapStore.getState();
  return assuranceSets.find(
    (s) =>
      !isClosedAssuranceSet(s) &&
      s.requirements.length > 1 &&
      resolveNotificationRecipient(s.assignedVerifier, users) &&
      resolveNotificationRecipient(s.assignedApprover, users),
  )!;
}

describe('submit and approval notifications', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('tells the verifier as soon as a document is submitted on a requirement', () => {
    const set = staffedOpenSet();
    const verifier = resolveNotificationRecipient(set.assignedVerifier, useMapStore.getState().users)!;
    const doc = { ...useMapStore.getState().documents[0], id: 'MAP-VES-2026-STAT-SUBMIT1' };

    useMapStore.getState().uploadDocumentForRequirement(set.id, set.requirements[0].id, doc);

    const notice = inboxOf(verifier.id).find((n) => n.type === 'review_requested' && n.documentId === doc.id);
    expect(notice?.assuranceSetId).toBe(set.id);
    expect(notice?.subject).toBe(`Document submitted: ${set.requirements[0].title}`);
  });

  it('tells the verifier when a new version is submitted for one requirement', () => {
    const set = staffedOpenSet();
    const verifier = resolveNotificationRecipient(set.assignedVerifier, useMapStore.getState().users)!;
    const docId = useMapStore.getState().documents[0].id;

    useMapStore.getState().addDocumentVersion(docId, 'v7.0', 'renewed.pdf', 1024, 'Renewed.', undefined, {
      assuranceSetId: set.id,
      requirementId: set.requirements[0].id,
    });

    expect(inboxOf(verifier.id).some((n) => n.type === 'review_requested' && n.documentId === docId)).toBe(true);
  });

  it('sends nothing when the set has no verifier', () => {
    const set = { ...staffedOpenSet(), assignedVerifier: undefined } as unknown as AssuranceSet;
    useMapStore.setState({
      assuranceSets: useMapStore.getState().assuranceSets.map((s) => (s.id === set.id ? set : s)),
    });
    useMapStore.getState().uploadDocumentForRequirement(set.id, set.requirements[0].id, {
      ...useMapStore.getState().documents[0],
      id: 'MAP-VES-2026-STAT-SUBMIT2',
    });

    expect(useMapStore.getState().notifications.filter((n) => n.type === 'review_requested').length).toBe(
      initialState.notifications.filter((n) => n.type === 'review_requested').length,
    );
  });

  it('tells the appointed approver once, when the last required document is verified', () => {
    const base = staffedOpenSet();
    const docs = useMapStore.getState().documents;
    const [first, second] = base.requirements;
    const set: AssuranceSet = {
      ...base,
      stage: 'Verification',
      approverDecision: 'Pending',
      formalApprovalRequired: true,
      verificationRequired: true,
      mandatoryInspectionRequired: false,
      requirements: [
        { ...first, isMandatory: true, documentId: docs[0].id, verifierStatus: 'Pending', isFulfilled: false },
        { ...second, isMandatory: true, documentId: docs[1].id, verifierStatus: 'Pending', isFulfilled: false },
      ],
    };
    useMapStore.setState({
      assuranceSets: useMapStore.getState().assuranceSets.map((s) => (s.id === set.id ? set : s)),
    });
    const approver = resolveNotificationRecipient(set.assignedApprover, useMapStore.getState().users)!;
    const approvalNotices = () =>
      inboxOf(approver.id).filter((n) => n.type === 'approval_requested' && n.assuranceSetId === set.id).length;
    const before = approvalNotices();

    useMapStore.getState().verifyDocument(docs[0].id, 'Verified', 'First.', undefined, first.id, set.id);
    expect(approvalNotices()).toBe(before);

    useMapStore.getState().verifyDocument(docs[1].id, 'Verified', 'Last.', undefined, second.id, set.id);
    expect(approvalNotices()).toBe(before + 1);
  });
});
