/*
  file summary: tests that the standard vessel pack asks for the evidence a charterer's vetting asks for.
  responsibilities: verifies the ISM DOC and SMC, P&I entry, MLC, vessel questionnaire and inspection report are standard vessel documents.
  role in system: covers src/utils/assuranceTemplates.ts (SUBTYPE_STANDARD_DOCS); gap review findings G4, G5 and G6.
*/

import { describe, expect, it } from 'vitest';
import { SUBTYPE_STANDARD_DOCS } from '../utils/assuranceTemplates';

describe('standard vessel evidence', () => {
  it.each([
    ['vessel-ism-doc', 'ISM Document of Compliance (DOC)'],
    ['vessel-ism-smc', 'Safety Management Certificate (SMC)'],
    ['vessel-pi-entry', 'P&I Certificate of Entry'],
    ['vessel-mlc-cert', 'Maritime Labour Certificate (MLC)'],
    ['vessel-questionnaire', 'Vessel Questionnaire'],
    ['vessel-inspection-report', 'Vessel Inspection Report'],
  ])('includes %s', (id, title) => {
    const doc = SUBTYPE_STANDARD_DOCS.Vessel.find((d) => d.id === id);
    expect(doc?.title).toBe(title);
    expect(doc?.defaultEnabled).toBe(true);
  });

  it('asks for the inspection report as an inspection report', () => {
    expect(SUBTYPE_STANDARD_DOCS.Vessel.find((d) => d.id === 'vessel-inspection-report')?.category).toBe('Inspection Report');
  });
});
