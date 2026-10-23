/*
  file summary: tests that the document screens claim no check that never ran.
  responsibilities: verifies that the asset match badge follows the stored check, that a document with no check run shows Not Checked, and that the statement of what MAP records is shown.
  role in system: covers DocumentDetailView.tsx and verificationPolicy.ts; gap review findings E7 and G2.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DocumentDetailView } from '../views/DocumentDetailView';
import { VERIFICATION_SCOPE_STATEMENT } from '../utils/verificationPolicy';
import type { MasterDocument } from '../types/document';

const initialState = useMapStore.getState();

function withDocument(patch: (doc: MasterDocument) => MasterDocument): string {
  const base = useMapStore.getState().documents.find((d) => d.vesselAttributes)!;
  const doc = patch({ ...base, id: 'MAP-VES-2026-STAT-HONEST' });
  useMapStore.setState({ documents: [doc, ...useMapStore.getState().documents] });
  return doc.id;
}

describe('honest document UI', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });
  afterEach(cleanup);

  it('shows Not Checked when no rule has run', () => {
    const id = withDocument((d) => ({
      ...d,
      validationRules: { ...d.validationRules, overallValid: false, rulesNotChecked: true },
    }));
    render(<DocumentDetailView documentId={id} />);
    expect(screen.getAllByText('Not Checked').length).toBeGreaterThan(0);
    expect(screen.queryByText('Match Verified')).toBeNull();
    expect(screen.getByText(VERIFICATION_SCOPE_STATEMENT)).toBeInTheDocument();
  });

  it('shows Mismatch when the stored check found one', () => {
    const id = withDocument((d) => ({
      ...d,
      validationRules: { ...d.validationRules, rulesNotChecked: false },
      vesselAttributes: { ...d.vesselAttributes!, assetMatchFlag: false },
    }));
    render(<DocumentDetailView documentId={id} />);
    expect(screen.getByText('Mismatch')).toBeInTheDocument();
  });
});
