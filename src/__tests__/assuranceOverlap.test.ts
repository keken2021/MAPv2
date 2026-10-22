/*
  file summary: tests the contract period overlap check between assurance sets on the same asset.
  responsibilities: verifies vessel, crew and equipment overlaps, half-open period edges, drafts and Activity sets ignored, the set being edited excluded, and the field error wording.
  role in system: covers src/utils/assuranceOverlap.ts, used by CreateAssuranceSetView.tsx and AssuranceDetailView.tsx.
*/

import { describe, expect, it } from 'vitest';
import { AssuranceSet } from '../types/assurance';
import {
  contractPeriodsOverlap,
  findOverlappingAssuranceSets,
  formatOverlapError,
  getDefaultNonConflictingContractPeriod,
  getAssetPeriodConflicts,
  isAssetAvailableForPeriod,
} from '../utils/assuranceOverlap';

/* a saved set with only the fields the overlap check reads */
const makeSet = (overrides: Partial<AssuranceSet>): AssuranceSet => ({
  id: 'AS-TEST-001',
  title: 'Test Set',
  assuranceType: 'Vessel',
  subtypes: ['Vessel'],
  vesselId: 'VESSEL-001',
  vesselName: 'MV Pacific Endeavour',
  imoNumber: '9123456',
  initiatorOrg: 'Chevron Australia Pty Ltd',
  initiatorRole: 'C Admin · Client Created',
  charterWindowStart: '2026-11-01',
  complianceDeadline: '2026-11-01',
  charterWindowEnd: '2027-11-01',
  stage: 'Initiated',
  readinessScore: 0,
  requirements: [],
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  ...overrides,
});

describe('contract period overlap', () => {
  it('treats periods as half-open, so a set may start on the day another ends', () => {
    expect(contractPeriodsOverlap('2026-11-01', '2027-11-01', '2027-11-01', '2028-11-01')).toBe(false);
    expect(contractPeriodsOverlap('2026-11-01', '2027-11-01', '2027-10-31', '2028-11-01')).toBe(true);
    expect(contractPeriodsOverlap('2026-11-01', '2027-11-01', '2026-01-01', '2026-11-01')).toBe(false);
  });

  it('finds a vessel set on the same vessel with an overlapping period', () => {
    const existing = makeSet({ id: 'AS-A' });
    const conflicts = findOverlappingAssuranceSets(
      { scope: 'Vessel', vesselId: 'VESSEL-001', start: '2027-05-01', end: '2028-05-01' },
      [existing],
    );
    expect(conflicts.map((c) => c.set.id)).toEqual(['AS-A']);
    expect(conflicts[0].assetName).toBe('MV Pacific Endeavour');
  });

  it('allows the same vessel on touching periods, and another vessel on any period', () => {
    const existing = makeSet({ id: 'AS-A' });
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Vessel', vesselId: 'VESSEL-001', start: '2027-11-01', end: '2028-11-01' },
        [existing],
      ),
    ).toEqual([]);
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Vessel', vesselId: 'VESSEL-002', start: '2027-01-01', end: '2027-06-01' },
        [existing],
      ),
    ).toEqual([]);
  });

  it('ignores drafts, the set being edited, and a crew set that only names the vessel as host', () => {
    const draft = makeSet({ id: 'AS-DRAFT', visibility: 'draft' });
    const self = makeSet({ id: 'AS-SELF' });
    const crewOnHost = makeSet({
      id: 'AS-CREW',
      assuranceType: 'Crew',
      subtypes: ['Crew'],
      crewId: 'CREW-101',
      crewName: 'Capt. Alexander Wright',
    });
    expect(
      findOverlappingAssuranceSets(
        { id: 'AS-SELF', scope: 'Vessel', vesselId: 'VESSEL-001', start: '2027-01-01', end: '2027-06-01' },
        [draft, self, crewOnHost],
      ),
    ).toEqual([]);
  });

  it('counts an approved set, since its contract still holds the asset', () => {
    const approved = makeSet({ id: 'AS-DONE', stage: 'Approved', approverDecision: 'Approved' });
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Vessel', vesselId: 'VESSEL-001', start: '2027-01-01', end: '2027-06-01' },
        [approved],
      ).map((c) => c.set.id),
    ).toEqual(['AS-DONE']);
  });

  it('finds a crew overlap through one shared member of a multi-crew set', () => {
    const multiCrew = makeSet({
      id: 'AS-CREW',
      assuranceType: 'Crew',
      subtypes: ['Crew'],
      crewId: 'CREW-102',
      crewName: 'Chief Eng. Marcus Sterling',
      crewIds: ['CREW-102', 'CREW-103'],
      crewNames: ['Chief Eng. Marcus Sterling', 'Chief Off. Sarah Jenkins'],
    });
    const conflicts = findOverlappingAssuranceSets(
      { scope: 'Crew', crewIds: ['CREW-105', 'CREW-103'], start: '2027-01-01', end: '2027-06-01' },
      [multiCrew],
    );
    expect(conflicts.map((c) => c.assetName)).toEqual(['Chief Off. Sarah Jenkins']);
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Crew', crewIds: ['CREW-105'], start: '2027-01-01', end: '2027-06-01' },
        [multiCrew],
      ),
    ).toEqual([]);
  });

  it('finds an equipment overlap and never checks Activity sets', () => {
    const equipmentSet = makeSet({
      id: 'AS-EQ',
      assuranceType: 'Equipment',
      subtypes: ['Equipment'],
      equipmentId: 'EQ-001',
      equipmentName: '150T Traction Winch',
    });
    const activitySet = makeSet({ id: 'AS-ACT', assuranceType: 'Activity', subtypes: ['Activity'], activityId: 'ACT-1' });
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Equipment', equipmentId: 'EQ-001', start: '2027-01-01', end: '2027-06-01' },
        [equipmentSet],
      ).map((c) => c.assetName),
    ).toEqual(['150T Traction Winch']);
    expect(
      findOverlappingAssuranceSets(
        { scope: 'Activity', start: '2027-01-01', end: '2027-06-01' },
        [activitySet],
      ),
    ).toEqual([]);
  });

  it('words the field error with the first conflict and a count of the rest', () => {
    const a = makeSet({ id: 'AS-A' });
    const b = makeSet({ id: 'AS-B', charterWindowStart: '2027-02-01', charterWindowEnd: '2027-08-01' });
    const conflicts = findOverlappingAssuranceSets(
      { scope: 'Vessel', vesselId: 'VESSEL-001', start: '2027-03-01', end: '2027-04-01' },
      [a, b],
    );
    expect(formatOverlapError(conflicts)).toBe(
      'Contract period overlaps AS-A (01 NOV 2026 – 01 NOV 2027) for MV Pacific Endeavour and 1 more.',
    );
    expect(formatOverlapError([])).toBe('');
  });

  it('determines individual asset period availability and conflict retrieval', () => {
    const existing = makeSet({ id: 'AS-EXISTING', vesselId: 'VESSEL-001', charterWindowStart: '2026-11-01', charterWindowEnd: '2027-11-01' });
    expect(isAssetAvailableForPeriod('Vessel', 'VESSEL-001', '2027-01-01', '2027-06-01', [existing])).toBe(false);
    expect(isAssetAvailableForPeriod('Vessel', 'VESSEL-001', '2027-11-01', '2028-11-01', [existing])).toBe(true);
    expect(isAssetAvailableForPeriod('Vessel', 'VESSEL-002', '2027-01-01', '2027-06-01', [existing])).toBe(true);

    const conflicts = getAssetPeriodConflicts('Vessel', 'VESSEL-001', '2027-01-01', '2027-06-01', [existing]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].set.id).toBe('AS-EXISTING');
  });

  it('calculates a demo-friendly non-conflicting default contract period', () => {
    const existing = makeSet({ id: 'AS-2027', charterWindowStart: '2026-11-01', charterWindowEnd: '2027-11-01' });
    const defaultDates = getDefaultNonConflictingContractPeriod([existing]);
    expect(defaultDates.start).toBe('2028-01-01');
    expect(defaultDates.end).toBe('2028-12-31');

    /* when sets already extend past 2027, advances past the latest end date */
    const futureSet = makeSet({ id: 'AS-2028', charterWindowStart: '2028-01-01', charterWindowEnd: '2028-06-30' });
    const futureDefault = getDefaultNonConflictingContractPeriod([existing, futureSet]);
    expect(futureDefault.start).toBe('2028-07-01');
    expect(futureDefault.end).toBe('2029-07-01');
  });
});
