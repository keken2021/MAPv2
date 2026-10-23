/*
  file summary: tests that each check belongs to its field and is shown under it in the review drawer.
  responsibilities: verifies the check per field for vessel and crew certificates, that the gate names the failing field, and that the drawer shows the check under the field with no separate check list.
  role in system: covers verificationPolicy.ts (getFieldChecks, getVerifyBlockReasons) and DocumentReviewDrawer.tsx.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { getFieldChecks, getVerifyBlockReasons, type FieldCheckDocument } from '../utils/verificationPolicy';
import type { MasterDocument } from '../types/document';

const TODAY = new Date('2026-10-23T00:00:00Z');
const PERIOD = { charterWindowEnd: '2027-11-01' };

const vesselDoc = (patch: Partial<FieldCheckDocument> = {}): FieldCheckDocument => ({
  certificateNo: 'ABS-STAT-7721',
  expiryDate: '2028-02-10',
  validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
  vesselAttributes: { assetMatchFlag: true } as MasterDocument['vesselAttributes'],
  ...patch,
});

const initialState = useMapStore.getState();

describe('field checks', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });
  afterEach(cleanup);

  it('passes every vessel field when the rules passed and the expiry outlasts the contract period', () => {
    const checks = getFieldChecks(vesselDoc(), PERIOD, TODAY);
    expect(Object.values(checks).every((c) => c?.state === 'pass')).toBe(true);
  });

  it('puts each problem on its own field', () => {
    const checks = getFieldChecks(
      vesselDoc({
        certificateNo: '',
        expiryDate: '2026-11-30',
        vesselAttributes: { assetMatchFlag: false } as MasterDocument['vesselAttributes'],
        validationRules: { charterBufferPassed: false, assetMatch100Percent: false, iacsAuthorityValid: false, overallValid: false },
      }),
      PERIOD,
      TODAY,
    );
    expect(checks.certificateNo).toEqual({ state: 'fail', message: 'Certificate no. missing.' });
    expect(checks.vesselName?.message).toBe('Does not match the asset.');
    expect(checks.imoNumber?.state).toBe('fail');
    expect(checks.issuingAuthority?.message).toBe('Not a recognised authority.');
    expect(checks.expiryDate).toEqual({ state: 'warn', message: 'Expires during the contract period.' });
  });

  it('marks unchecked rules as not checked and a lapsed expiry as failed', () => {
    const checks = getFieldChecks(
      vesselDoc({
        expiryDate: '2026-10-01',
        validationRules: { charterBufferPassed: false, assetMatch100Percent: false, iacsAuthorityValid: false, overallValid: false, rulesNotChecked: true },
      }),
      PERIOD,
      TODAY,
    );
    expect(checks.vesselName?.state).toBe('not_checked');
    expect(checks.issuingAuthority?.state).toBe('not_checked');
    expect(checks.expiryDate).toEqual({ state: 'fail', message: 'Lapsed.' });
  });

  it('checks a crew certificate on its expiry and leaves its issuer not checked', () => {
    const checks = getFieldChecks(
      { ...vesselDoc(), vesselAttributes: undefined, crewAttributes: { expiryDate: '2026-12-01' } as MasterDocument['crewAttributes'] },
      PERIOD,
      TODAY,
    );
    expect(Object.keys(checks).sort()).toEqual(['expiryDate', 'issuingAuthority']);
    expect(checks.issuingAuthority?.state).toBe('not_checked');
    expect(checks.expiryDate?.state).toBe('warn');
  });

  it('names the failing field in the reasons Verify is blocked, and does not block on a warning', () => {
    const base = { overallConfidence: 95, fullPagePassed: true, signaturePassed: true, set: PERIOD };
    expect(getVerifyBlockReasons({ ...base, document: vesselDoc({ expiryDate: '2026-11-30' }) })).toEqual([]);
    expect(getVerifyBlockReasons({ ...base, document: vesselDoc({ certificateNo: '' }) })).toEqual([
      'Certificate No.: Certificate no. missing.',
    ]);
  });

  it('shows each check under its field in the review drawer, with no separate check list', () => {
    const state = useMapStore.getState();
    const set = state.assuranceSets.find((s) => s.requirements.length > 0 && s.stage !== 'Approved')!;
    const base = state.documents.find((d) => d.vesselAttributes)!;
    const doc: MasterDocument = {
      ...base,
      id: 'MAP-VES-2026-STAT-FIELD1',
      certificateNo: 'ABS-STAT-7721',
      expiryDate: '2099-01-01',
      validationRules: { ...base.validationRules, rulesNotChecked: false, overallValid: false, iacsAuthorityValid: true, assetMatch100Percent: false },
      vesselAttributes: { ...base.vesselAttributes!, assetMatchFlag: false },
    };
    const req = { ...set.requirements[0], documentId: doc.id, verifierStatus: 'Pending' as const, isFulfilled: false };
    useMapStore.setState({
      documents: [doc, ...state.documents],
      assuranceSets: state.assuranceSets.map((s) => (s.id === set.id ? { ...s, requirements: [req, ...s.requirements.slice(1)] } : s)),
      activePersona: 'Verifier',
    });
    render(
      <DocumentReviewDrawer document={doc} onClose={() => undefined} assuranceSetId={set.id} requirementId={req.id} requirementVerifierStatus="Pending" />,
    );

    const imoRow = screen.getByText('IMO NUMBER').closest('.map-extraction-field-row') as HTMLElement;
    expect(within(imoRow).getByText('Does not match the asset.')).toBeInTheDocument();
    const authorityRow = screen.getByText('ISSUING AUTHORITY').closest('.map-extraction-field-row') as HTMLElement;
    expect(within(authorityRow).getByText('Recognised authority.')).toBeInTheDocument();
    expect(screen.queryByText('Checks not passed')).toBeNull();
  });
});
