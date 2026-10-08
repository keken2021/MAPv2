/* 
  file summary: unit tests for maritime identifier validation routines and duplicate check rules.
  responsibilities: asserts correct behavior for imo number regex validation, duplicate imo/official registration checks, and charter buffer calculations.
  role in system: executed during vitest unit test suite runs.
*/

import { describe, it, expect } from 'vitest';
import {
  validateImoNumber,
  isDuplicateVessel,
  checkCharterBufferPassed,
  isDuplicateCampaignTitle,
  generateUniqueAssuranceSetId,
  generateUniqueRequirementId,
  toIsoLocalDate,
  validateCharterWindow,
} from '../utils/validation';
import { VesselInformation } from '../types/vessel';
import { AssuranceSet } from '../types/assurance';

describe('Maritime Validation Utilities', () => {
  it('should validate valid 7-digit IMO numbers', () => {
    expect(validateImoNumber('9123456')).toBe(true);
    expect(validateImoNumber('9634721')).toBe(true);
  });

  it('should reject invalid IMO numbers', () => {
    expect(validateImoNumber('12345')).toBe(false);
    expect(validateImoNumber('91234567')).toBe(false);
    expect(validateImoNumber('IMO9123456')).toBe(false);
  });

  it('should detect duplicate vessel registration by IMO number', () => {
    const mockVessels: Partial<VesselInformation>[] = [
      { name: 'MV Pacific Endeavour', imoNumber: '9123456', officialRegNumber: 'OSV-44-2019' },
    ];

    const result = isDuplicateVessel('9123456', 'NEW-REG-100', mockVessels as VesselInformation[]);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain('IMO number 9123456');
  });

  it('should detect duplicate vessel registration by Official Registration Number', () => {
    const mockVessels: Partial<VesselInformation>[] = [
      { name: 'MV Pacific Endeavour', imoNumber: '9123456', officialRegNumber: 'OSV-44-2019' },
    ];

    const result = isDuplicateVessel('9999999', 'osv-44-2019', mockVessels as VesselInformation[]);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain('Official Registration Number OSV-44-2019');
  });

  it('should evaluate 6-month charter buffer rule correctly', () => {
    // Expiry in 2029 vs Charter End in 2027 => Buffer Passed
    expect(checkCharterBufferPassed('2029-01-14', '2027-11-01')).toBe(true);

    // Expiry in 2026 vs Charter End in 2027 => Buffer Failed
    expect(checkCharterBufferPassed('2026-11-30', '2027-11-01')).toBe(false);
  });

  /**
    what: tests duplicate campaign name detection in assurance set workflows.
    how: checks exact, whitespace-padded, and case-insensitive matching against existing assurance sets.
    with what file: src/__tests__/validation.test.ts testing src/utils/validation.ts.
  */
  it('should detect duplicate campaign titles and allow unique titles', () => {
    const existingSets: Partial<AssuranceSet>[] = [
      { id: 'AS-2026-001', title: 'Chevron Gorgon Charter Vetting' },
      { id: 'AS-2026-002', title: 'Woodside Scarborough Towing Campaign' },
    ];

    /* exact match */
    const dup1 = isDuplicateCampaignTitle('Chevron Gorgon Charter Vetting', existingSets as AssuranceSet[]);
    expect(dup1.isDuplicate).toBe(true);
    expect(dup1.reason).toContain('Chevron Gorgon Charter Vetting');

    /* case-insensitive match */
    const dup2 = isDuplicateCampaignTitle('chevron gorgon charter vetting', existingSets as AssuranceSet[]);
    expect(dup2.isDuplicate).toBe(true);

    /* whitespace padded match */
    const dup3 = isDuplicateCampaignTitle('   Woodside Scarborough Towing Campaign   ', existingSets as AssuranceSet[]);
    expect(dup3.isDuplicate).toBe(true);

    /* unique title */
    const unique = isDuplicateCampaignTitle('Inpex Ichthys Supply Support 2026', existingSets as AssuranceSet[]);
    expect(unique.isDuplicate).toBe(false);

    /* excluding own set id during updates */
    const ownUpdate = isDuplicateCampaignTitle('Chevron Gorgon Charter Vetting', existingSets as AssuranceSet[], 'AS-2026-001');
    expect(ownUpdate.isDuplicate).toBe(false);
  });

  /**
    what: tests collision-proof generation of unique transactional assurance set ids.
    how: analyzes existing set ids and generates next sequential formatted identifier.
    with what file: src/__tests__/validation.test.ts testing src/utils/validation.ts.
  */
  it('should generate guaranteed unique transactional assurance set IDs and requirement IDs', () => {
    const existingSets: Partial<AssuranceSet>[] = [
      { id: 'AS-2026-001', title: 'Campaign 1' },
      { id: 'AS-2026-002', title: 'Campaign 2' },
      { id: 'AS-2026-003', title: 'Campaign 3' },
    ];

    const newId = generateUniqueAssuranceSetId(existingSets as AssuranceSet[]);
    expect(newId).toBe(`AS-${new Date().getFullYear()}-004`);

    /* requirement id generation */
    const req1 = generateUniqueRequirementId(newId, 0);
    const req2 = generateUniqueRequirementId(newId, 1);
    expect(req1).toBe('REQ-004-01');
    expect(req2).toBe('REQ-004-02');
  });
});

describe('charter window validation', () => {
  /* fixed reference day so the rule does not depend on the machine clock */
  const today = new Date(2026, 9, 8);

  it('formats a local date as iso yyyy-mm-dd', () => {
    expect(toIsoLocalDate(today)).toBe('2026-10-08');
  });

  it('accepts a window that starts tomorrow or later', () => {
    expect(validateCharterWindow('2026-10-09', '2026-10-09', today)).toEqual({});
    expect(validateCharterWindow('2026-11-01', '2027-02-28', today)).toEqual({});
  });

  it('rejects today and earlier days for the start and the end', () => {
    expect(validateCharterWindow('2026-10-08', '2026-11-01', today).start).toBe('Start date must be after today.');
    expect(validateCharterWindow('2026-10-07', '2026-11-01', today).start).toBe('Start date must be after today.');
    expect(validateCharterWindow('2026-10-07', '2026-10-08', today).end).toBe('End date must be after today.');
  });

  it('rejects an end date before the start date', () => {
    expect(validateCharterWindow('2026-12-01', '2026-11-01', today)).toEqual({
      end: 'End date cannot be before the start date.',
    });
  });

  it('requires both dates', () => {
    expect(validateCharterWindow('', '', today)).toEqual({
      start: 'Start date is required.',
      end: 'End date is required.',
    });
  });
});
