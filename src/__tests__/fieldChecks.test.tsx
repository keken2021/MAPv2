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
    /* each message names the problem and what to do */
    expect(checks.certificateNo?.state).toBe('fail');
    expect(checks.certificateNo?.message).toMatch(/^Certificate no\. missing\. Enter it/);
    expect(checks.vesselName?.message).toMatch(/^Does not match the vessel record\. Check the vessel name and IMO/);
    expect(checks.imoNumber?.state).toBe('fail');
    expect(checks.issuingAuthority?.message).toMatch(/^Not a recognised \(IACS\) authority\. Check the issuer/);
    expect(checks.expiryDate?.state).toBe('warn');
    expect(checks.expiryDate?.message).toMatch(/^Expires during the contract period\./);
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
    expect(checks.expiryDate).toEqual({ state: 'fail', message: 'Lapsed on 2026-10-01. Upload a renewed certificate.' });
    expect(checks.vesselName?.message).toMatch(/Upload a new version to run the checks/);
  });

  it('checks a crew certificate on its expiry and shows its issuer as unchecked, without blocking', () => {
    const checks = getFieldChecks(
      { ...vesselDoc(), vesselAttributes: undefined, expiryDate: '2026-12-01', crewAttributes: { expiryDate: '2026-12-01' } as MasterDocument['crewAttributes'] },
      PERIOD,
      TODAY,
    );
    expect(Object.keys(checks).sort()).toEqual(['expiryDate', 'issuingAuthority']);
    expect(checks.issuingAuthority).toEqual({ state: 'info', message: 'No rule checks this field.' });
    expect(checks.expiryDate?.state).toBe('warn');
  });

  it('reads the current version expiry before an older one in the certificate details', () => {
    const checks = getFieldChecks(
      { ...vesselDoc(), vesselAttributes: undefined, expiryDate: '2029-01-01', crewAttributes: { expiryDate: '2026-01-01' } as MasterDocument['crewAttributes'] },
      PERIOD,
      TODAY,
    );
    expect(checks.expiryDate?.state).toBe('pass');
  });

  it('never blocks a crew certificate on its issuing authority', () => {
    const crewDoc = { ...vesselDoc(), vesselAttributes: undefined, expiryDate: '2029-01-01', crewAttributes: { expiryDate: '2029-01-01' } as MasterDocument['crewAttributes'] };
    expect(getVerifyBlockReasons({ document: crewDoc, set: PERIOD, overallConfidence: 95, fullPagePassed: true, signaturePassed: true })).toEqual([]);
  });

  it('names the failing field in the reasons Verify is blocked, and does not block on a warning', () => {
    const base = { overallConfidence: 95, fullPagePassed: true, signaturePassed: true, set: PERIOD };
    expect(getVerifyBlockReasons({ ...base, document: vesselDoc({ expiryDate: '2026-11-30' }) })).toEqual([]);
    const [reason, ...rest] = getVerifyBlockReasons({ ...base, document: vesselDoc({ certificateNo: '' }) });
    expect(rest).toEqual([]);
    expect(reason).toMatch(/^Certificate No\.: Certificate no\. missing\. Enter it \(Edit Fields\) or upload a clearer scan\.$/);
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
    expect(within(imoRow).getByText(/^Does not match the vessel record\./)).toBeInTheDocument();
    const authorityRow = screen.getByText('ISSUING AUTHORITY').closest('.map-extraction-field-row') as HTMLElement;
    expect(within(authorityRow).getByText('Recognised authority.')).toBeInTheDocument();
    expect(screen.queryByText('Checks not passed')).toBeNull();
  });
});
