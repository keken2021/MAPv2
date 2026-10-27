/*
  file summary: tests that a document's validation rules run on upload and on a new version, so a fixed document can be verified.
  responsibilities: verifies the IACS authority match, the asset match against the vessel record, that uploads and new versions run the checks, and that a renewed lapsed document is no longer blocked.
  role in system: covers documentChecks.ts and useMapStore.ts (addDocument, addDocumentVersion) with verificationPolicy.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { isIacsAuthority, runDocumentChecks, runCrossCertificateChecks } from '../utils/documentChecks';
import { getVerifyBlockReasons } from '../utils/verificationPolicy';
import type { MasterDocument } from '../types/document';

const initialState = useMapStore.getState();

/* a vessel certificate whose details match its vessel record */
function matchingDocument(id: string, patch: Partial<MasterDocument> = {}): MasterDocument {
  const vessel = useMapStore.getState().vessels[0];
  const base = useMapStore.getState().documents.find((d) => d.vesselAttributes)!;
  return {
    ...base,
    id,
    vesselId: vessel.id,
    issuingAuthority: 'DNV',
    expiryDate: '2029-01-01',
    validationRules: { charterBufferPassed: false, assetMatch100Percent: false, iacsAuthorityValid: false, overallValid: false, rulesNotChecked: true },
    vesselAttributes: { ...base.vesselAttributes!, vesselName: vessel.name, imoNumber: `IMO ${vessel.imoNumber}`, issuingBody: 'DNV', expiryDate: '2029-01-01', assetMatchFlag: false },
    ...patch,
  };
}

describe('document checks', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('recognises IACS members by name or abbreviation', () => {
    expect(isIacsAuthority("Lloyd's Register")).toBe(true);
    expect(isIacsAuthority('ABS')).toBe(true);
    expect(isIacsAuthority('DNV GL')).toBe(true);
    expect(isIacsAuthority('Australian Register of Ships')).toBe(false);
    expect(isIacsAuthority('')).toBe(false);
  });

  it('matches the vessel name and IMO against the vessel record', () => {
    const vessels = useMapStore.getState().vessels;
    expect(runDocumentChecks(matchingDocument('D1'), vessels)).toMatchObject({
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
      rulesNotChecked: false,
    });
    const wrongImo = matchingDocument('D2');
    wrongImo.vesselAttributes = { ...wrongImo.vesselAttributes!, imoNumber: '1111111' };
    expect(runDocumentChecks(wrongImo, vessels).assetMatch100Percent).toBe(false);
  });

  it('runs the checks when a document is uploaded', () => {
    useMapStore.getState().addDocument(matchingDocument('MAP-VES-2026-STAT-CHK01'));
    const stored = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-CHK01')!;
    expect(stored.validationRules.rulesNotChecked).toBe(false);
    expect(stored.vesselAttributes?.assetMatchFlag).toBe(true);
  });

  it('lets a lapsed document be verified once a renewed version is uploaded', () => {
    useMapStore.getState().addDocument(
      matchingDocument('MAP-VES-2026-STAT-CHK02', {
        expiryDate: '2026-01-01',
        vesselAttributes: { ...matchingDocument('x').vesselAttributes!, expiryDate: '2026-01-01' },
      }),
    );
    const gate = (doc: MasterDocument) =>
      getVerifyBlockReasons({ document: doc, set: { charterWindowEnd: '2027-01-01' }, overallConfidence: 98, fullPagePassed: true, signaturePassed: true });
    const lapsed = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-CHK02')!;
    expect(gate(lapsed)).toEqual([expect.stringMatching(/^Expiry Date: Lapsed on 2026-01-01\. Upload a renewed certificate\.$/)]);

    useMapStore.getState().addDocumentVersion('MAP-VES-2026-STAT-CHK02', 'v1.1', 'renewed.pdf', 1024, 'Renewed.', '2030-01-01');

    const renewed = useMapStore.getState().documents.find((d) => d.id === 'MAP-VES-2026-STAT-CHK02')!;
    expect(renewed.vesselAttributes?.expiryDate).toBe('2030-01-01');
    expect(gate(renewed)).toEqual([]);
  });
});

describe('document checks without a vessel record', () => {
  it('says the document must be linked to its vessel', () => {
    const doc = { ...useMapStore.getState().documents.find((d) => d.vesselAttributes)!, vesselId: 'NO-SUCH-VESSEL' };
    const rules = runDocumentChecks(doc, useMapStore.getState().vessels);
    const [reason] = getVerifyBlockReasons({
      document: { ...doc, validationRules: rules },
      overallConfidence: 98,
      fullPagePassed: true,
      signaturePassed: true,
    });
    expect(reason).toMatch(/not linked to a vessel record\. Link it to its vessel/);
  });
});

describe('automated cross-certificate checks (gap review R2-G2, R2-S7)', () => {
  it('validates gross tonnage consistency against registered vessel gross tonnage', () => {
    const vessel = useMapStore.getState().vessels[0];
    const registeredGt = vessel.grossTonnageGT; // e.g. 3250
    const matchingCert = matchingDocument('DOC-GT-1', {
      grossTonnagePrinted: registeredGt,
    });
    const results = runCrossCertificateChecks(matchingCert, [], [vessel]);
    const gtCheck = results.find((r) => r.checkId === 'gt_consistency')!;
    expect(gtCheck.state).toBe('pass');
    expect(gtCheck.message).toContain('matches vessel registry GT');

    const mismatchedCert = matchingDocument('DOC-GT-2', {
      grossTonnagePrinted: registeredGt + 500,
    });
    const mismatchResults = runCrossCertificateChecks(mismatchedCert, [], [vessel]);
    const mismatchGtCheck = mismatchResults.find((r) => r.checkId === 'gt_consistency')!;
    expect(mismatchGtCheck.state).toBe('fail');
    expect(mismatchGtCheck.message).toContain('does not match vessel registry GT');
  });

  it('validates DOC and SMC ISM company matching', () => {
    const vessel = useMapStore.getState().vessels[0];
    const docCert = matchingDocument('DOC-PARENT', {
      title: 'Document of Compliance (DOC)',
      companyImoNumber: '9512345',
      expiryDate: '2028-12-31',
    });
    const matchingSmc = matchingDocument('SMC-CHILD-1', {
      title: 'Safety Management Certificate (SMC)',
      companyImoNumber: '9512345',
      expiryDate: '2027-12-31',
    });
    const results = runCrossCertificateChecks(matchingSmc, [docCert], [vessel]);
    const companyCheck = results.find((r) => r.checkId === 'smc_doc_company_match')!;
    expect(companyCheck.state).toBe('pass');
    expect(companyCheck.message).toContain('matches parent Document of Compliance');

    const mismatchedSmc = matchingDocument('SMC-CHILD-2', {
      title: 'Safety Management Certificate (SMC)',
      companyImoNumber: '9999999',
      expiryDate: '2027-12-31',
    });
    const mismatchResults = runCrossCertificateChecks(mismatchedSmc, [docCert], [vessel]);
    const mismatchCompanyCheck = mismatchResults.find((r) => r.checkId === 'smc_doc_company_match')!;
    expect(mismatchCompanyCheck.state).toBe('fail');
    expect(mismatchCompanyCheck.message).toContain('does not match parent DOC');
  });

  it('enforces SMC validity bound: SMC expiry cannot outlast DOC expiry', () => {
    const vessel = useMapStore.getState().vessels[0];
    const docCert = matchingDocument('DOC-PARENT', {
      title: 'Document of Compliance (DOC)',
      companyImoNumber: '9512345',
      expiryDate: '2028-12-31',
    });
    const validSmc = matchingDocument('SMC-VALID', {
      title: 'Safety Management Certificate (SMC)',
      companyImoNumber: '9512345',
      expiryDate: '2028-06-30',
    });
    const results = runCrossCertificateChecks(validSmc, [docCert], [vessel]);
    const boundCheck = results.find((r) => r.checkId === 'smc_doc_validity_bound')!;
    expect(boundCheck.state).toBe('pass');
    expect(boundCheck.message).toContain('is within parent DOC expiry');

    const invalidSmc = matchingDocument('SMC-OVERDUE', {
      title: 'Safety Management Certificate (SMC)',
      companyImoNumber: '9512345',
      expiryDate: '2029-06-30',
    });
    const invalidResults = runCrossCertificateChecks(invalidSmc, [docCert], [vessel]);
    const invalidBoundCheck = invalidResults.find((r) => r.checkId === 'smc_doc_validity_bound')!;
    expect(invalidBoundCheck.state).toBe('fail');
    expect(invalidBoundCheck.message).toContain('exceeds parent DOC expiry');
  });

  it('records and preserves verificationReference on verified requirements (R2-G1, R2-S5)', () => {
    const store = useMapStore.getState();
    const set = store.assuranceSets[0];
    const req = set.requirements[0];
    const docId = req.documentId || 'MAP-VES-2026-STAT-00412';

    store.verifyDocument(
      docId,
      'Verified',
      'Verified with DNV Trust UTN.',
      undefined,
      req.id,
      set.id,
      {
        verificationMethod: 'Issuer lookup',
        verificationReference: 'DNV-UTN-9842104-X',
        verificationResultSummary: 'Confirmed active on DNV Trust ledger',
      },
    );

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === set.id)!;
    const updatedReq = updatedSet.requirements.find((r) => r.id === req.id)!;
    expect(updatedReq.verifierStatus).toBe('Verified');
    expect(updatedReq.verificationMethod).toBe('Issuer lookup');
    expect(updatedReq.verificationReference).toBe('DNV-UTN-9842104-X');
    expect(updatedReq.verificationResultSummary).toBe('Confirmed active on DNV Trust ledger');
  });
});
