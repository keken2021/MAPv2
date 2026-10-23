/*
  file summary: tests that an inspection report requirement records the report's source, date, validity and inspector.
  responsibilities: verifies the default validity by vessel age, the valid-until date, and that an upload stores the report facts on the one requirement.
  role in system: covers src/utils/inspectionEvidence.ts and useMapStore.ts (uploadDocumentForRequirement); gap review finding G4.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import {
  getDefaultInspectionValidityMonths,
  getInspectionValidUntil,
  isInspectionRequirement,
} from '../utils/inspectionEvidence';

const initialState = useMapStore.getState();
const TODAY = new Date('2026-10-23T00:00:00Z');

describe('inspection evidence', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('accepts a report for 12 months, or 6 for a vessel aged 15 or more', () => {
    expect(getDefaultInspectionValidityMonths(2015, TODAY)).toBe(12);
    expect(getDefaultInspectionValidityMonths(2010, TODAY)).toBe(6);
    expect(getDefaultInspectionValidityMonths(undefined, TODAY)).toBe(12);
  });

  it('works out the date a report stops being accepted', () => {
    expect(getInspectionValidUntil('2026-03-01', 12)).toBe('2027-03-01');
    expect(getInspectionValidUntil('', 12)).toBe('');
  });

  it('stores the report facts on the requirement the report was uploaded for', () => {
    const set = useMapStore.getState().assuranceSets.find((s) => s.requirements.length > 0)!;
    const req = { ...set.requirements[0], category: 'Inspection Report' as const };
    useMapStore.setState({
      assuranceSets: useMapStore
        .getState()
        .assuranceSets.map((s) => (s.id === set.id ? { ...s, requirements: [req, ...s.requirements.slice(1)] } : s)),
    });
    const doc = { ...useMapStore.getState().documents[0], id: 'MAP-VES-2026-INSP-00001' };

    useMapStore.getState().uploadDocumentForRequirement(set.id, req.id, doc, {
      source: 'eCMID',
      reportDate: '2026-03-01',
      validityMonths: 12,
      inspectorAccreditation: 'IIMS accredited',
    });

    const stored = useMapStore.getState().assuranceSets.find((s) => s.id === set.id)!.requirements.find((r) => r.id === req.id)!;
    expect(isInspectionRequirement(stored)).toBe(true);
    expect(stored.inspectionReport).toEqual({
      source: 'eCMID',
      reportDate: '2026-03-01',
      validityMonths: 12,
      inspectorAccreditation: 'IIMS accredited',
    });
  });
});
