/*
  file summary: tests that an approved assurance set keeps the exact document version it was approved against.
  responsibilities: verifies that verifying stamps the version, approval locks it, seeded closed sets start locked, a new version or a denial on another set leaves the approved set unchanged, and the detail view shows the locked version without upload actions.
  role in system: covers src/utils/documentVersionSnapshot.ts, useMapStore.ts (verifyDocument, updateRequirementStatus, setApproverDecision, addDocumentVersion) and the requirement rows of AssuranceDetailView.tsx.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { getRequirementDocumentView, isClosedAssuranceSet } from '../utils/documentVersionSnapshot';
import { AssuranceDetailView } from '../views/AssuranceDetailView';

const initialState = useMapStore.getState();
const SHARED_DOC = 'MAP-VES-2026-STAT-00008';

const getSet = (id: string) => useMapStore.getState().assuranceSets.find((s) => s.id === id)!;
const getDoc = (id: string) => useMapStore.getState().documents.find((d) => d.id === id)!;
const getReqForDoc = (setId: string, docId: string) =>
  getSet(setId).requirements.find((r) => r.documentId === docId || r.linkedDocumentId === docId)!;

describe('document version snapshot', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('seeds approved sets with their document versions locked', () => {
    const approved = getSet('AS-2026-004');
    expect(isClosedAssuranceSet(approved)).toBe(true);
    expect(approved.lockedAt).toBeTruthy();
    const req = getReqForDoc('AS-2026-004', SHARED_DOC);
    expect(req.verifiedVersion?.versionLabel).toBe(getDoc(SHARED_DOC).currentVersion);
    expect(req.verifiedVersion?.documentId).toBe(SHARED_DOC);
  });

  it('keeps the approved version when a newer version is uploaded from an open set', () => {
    const lockedLabel = getReqForDoc('AS-2026-004', SHARED_DOC).verifiedVersion!.versionLabel;
    expect(isClosedAssuranceSet(getSet('AS-2026-027'))).toBe(false);

    useMapStore.getState().addDocumentVersion(SHARED_DOC, 'v1.9', 'renewed.pdf', 2048, 'Renewed certificate.');

    expect(getDoc(SHARED_DOC).currentVersion).toBe('v1.9');
    /* the open set takes the new version and goes back to review */
    const openReq = getReqForDoc('AS-2026-027', SHARED_DOC);
    expect(openReq.documentVersion).toBe('v1.9');
    expect(openReq.verifierStatus).toBe('Pending');
    expect(openReq.verifiedVersion).toBeUndefined();
    /* the approved set keeps the version it was approved against */
    const approvedReq = getReqForDoc('AS-2026-004', SHARED_DOC);
    expect(approvedReq.verifiedVersion?.versionLabel).toBe(lockedLabel);
    const view = getRequirementDocumentView(getSet('AS-2026-004'), approvedReq, getDoc(SHARED_DOC));
    expect(view.isLocked).toBe(true);
    expect(view.doc.currentVersion).toBe(lockedLabel);
    expect(view.doc.versions.some((v) => v.versionLabel === 'v1.9')).toBe(false);
    expect(view.newerVersionLabel).toBe('v1.9');
    expect(view.doc.verificationStatus).toBe('Verified');
  });

  it('keeps the approved status when another set that uses the document is rejected', () => {
    useMapStore.getState().setApproverDecision('AS-2026-027', 'Rejected', 'Rejected for test.');
    expect(getDoc(SHARED_DOC).verificationStatus).toBe('Rejected');
    const approvedReq = getReqForDoc('AS-2026-004', SHARED_DOC);
    const view = getRequirementDocumentView(getSet('AS-2026-004'), approvedReq, getDoc(SHARED_DOC));
    expect(view.doc.verificationStatus).toBe('Verified');
    expect(getSet('AS-2026-004').approverDecision).toBe('Approved');
  });

  it('stamps the version on verify and locks the set on approval', () => {
    const set = getSet('AS-2026-027');
    const req = getReqForDoc('AS-2026-027', SHARED_DOC);
    const docVersion = getDoc(SHARED_DOC).currentVersion;

    useMapStore.getState().updateRequirementStatus(set.id, req.id, 'Verified', 'Looks good.');
    const verified = getReqForDoc('AS-2026-027', SHARED_DOC);
    expect(verified.verifiedVersion?.versionLabel).toBe(docVersion);
    expect(verified.verifiedVersion?.verifiedBy).toBeTruthy();
    expect(verified.documentVersion).toBe(docVersion);

    useMapStore.getState().setApproverDecision(set.id, 'Approved', 'Approved for test.');
    const approved = getSet('AS-2026-027');
    expect(approved.lockedAt).toBeTruthy();
    approved.requirements
      .filter((r) => r.documentId || r.linkedDocumentId)
      .forEach((r) => expect(r.verifiedVersion, r.id).toBeDefined());

    useMapStore.getState().addDocumentVersion(SHARED_DOC, 'v2.0', 'later.pdf', 1024, 'Later version.');
    expect(getReqForDoc('AS-2026-027', SHARED_DOC).verifiedVersion?.versionLabel).toBe(docVersion);
    expect(getReqForDoc('AS-2026-027', SHARED_DOC).verifierStatus).toBe('Verified');
  });

  it('shows the locked version on the detail view of an approved set, with no upload actions', () => {
    useMapStore.getState().addDocumentVersion(SHARED_DOC, 'v1.9', 'renewed.pdf', 2048, 'Renewed certificate.');
    const lockedLabel = getReqForDoc('AS-2026-004', SHARED_DOC).verifiedVersion!.versionLabel;

    render(<AssuranceDetailView setId="AS-2026-004" />);

    const row = screen.getAllByLabelText('Locked version')[0].closest('tr')!;
    expect(within(row).getByText(lockedLabel)).toBeInTheDocument();
    expect(screen.getAllByText('v1.9 available').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Upload new version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload Document' })).toBeNull();
  });
});
