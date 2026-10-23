/*
  file summary: tests that Verify in the review drawer needs a method and, after a failed check, an override reason.
  responsibilities: verifies the disabled states of Verify, and that the method and override reason are stored on the one requirement reviewed.
  role in system: covers DocumentReviewDrawer.tsx and verificationPolicy.ts; gap review findings E6, G1 and G2.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { VERIFICATION_SCOPE_STATEMENT } from '../utils/verificationPolicy';
import type { MasterDocument } from '../types/document';

const initialState = useMapStore.getState();

/* a first scan with low extraction confidence, so the checks fail */
function lowConfidenceDocument(base: MasterDocument): MasterDocument {
  return {
    ...base,
    id: 'MAP-VES-2026-STAT-GATE1',
    crewAttributes: undefined,
    ocrConfidence: 70,
    currentVersion: 'v1.0',
    versions: base.versions.slice(0, 1),
  };
}

function setUp() {
  const state = useMapStore.getState();
  const set = state.assuranceSets.find((s) => s.requirements.length > 0 && s.stage !== 'Approved')!;
  const doc = lowConfidenceDocument(state.documents.find((d) => d.entityType === 'Vessel Certificate')!);
  const req = { ...set.requirements[0], documentId: doc.id, verifierStatus: 'Pending' as const, isFulfilled: false };
  useMapStore.setState({
    documents: [doc, ...state.documents],
    assuranceSets: state.assuranceSets.map((s) =>
      s.id === set.id ? { ...s, requirements: [req, ...s.requirements.slice(1)] } : s,
    ),
    activePersona: 'Verifier',
  });
  render(
    <DocumentReviewDrawer
      document={doc}
      onClose={() => undefined}
      assuranceSetId={set.id}
      requirementId={req.id}
      requirementVerifierStatus="Pending"
    />,
  );
  return { setId: set.id, reqId: req.id };
}

describe('verify gate', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });
  afterEach(cleanup);

  it('shows what MAP verifies and keeps Verify disabled until a method is chosen and the failed checks are overridden', () => {
    const { setId, reqId } = setUp();
    const verify = screen.getByRole('button', { name: 'Verify' });

    expect(screen.getByText(VERIFICATION_SCOPE_STATEMENT)).toBeInTheDocument();
    expect(verify).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Method/), { target: { value: 'Issuer lookup' } });
    /* the banner says why Verify is blocked and what to do */
    expect(screen.getByText('Verify is blocked because:')).toBeInTheDocument();
    expect(screen.getByText(/^Extraction confidence \d+% is below 90%\. Correct the amber fields/)).toBeInTheDocument();
    expect(screen.queryByText('Checks not passed')).toBeNull();
    expect(verify).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Override'));
    expect(verify).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Override Reason/), { target: { value: 'Original sighted on board.' } });
    expect(verify).toBeEnabled();

    fireEvent.click(verify);
    const req = useMapStore.getState().assuranceSets.find((s) => s.id === setId)!.requirements.find((r) => r.id === reqId)!;
    expect(req.verifierStatus).toBe('Verified');
    expect(req.verificationMethod).toBe('Issuer lookup');
    expect(req.overrideReason).toBe('Original sighted on board.');
    expect(useMapStore.getState().auditEvents[0].justificationNotes).toContain('Override: Original sighted on board.');
  });
});
