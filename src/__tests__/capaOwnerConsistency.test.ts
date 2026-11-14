/* 
  file summary: tests for CAPA item owner consistency and canonical organization matching.
  responsibilities: verifies that all seeded CAPA items belong to kept canonical organizations.
  role in system: prevents regression to duplicate or deprecated organization spellings.
*/

import { describe, it, expect } from 'vitest';
import { MOCK_CAPA_ITEMS } from '../store/capaMockData';
import { DEFAULT_INSPECTION_CAPA_ITEMS } from '../store/inspectionMockData';
import { isCanonicalOrganization } from '../utils/organizationRegistry';

describe('CAPA Owner Canonical Consistency', () => {
  const mergedSpellings = [
    'Northwind Marine',
    'Northwind Marine Technical Dept',
    'Northwind Marine Technical Ops',
    'Northwind Technical Fleet Ops',
    'Meridian Marine Technical Services',
  ];

  it('ensures each MOCK_CAPA_ITEMS owner is a kept canonical organization', () => {
    expect(MOCK_CAPA_ITEMS.length).toBeGreaterThan(0);
    MOCK_CAPA_ITEMS.forEach((capa) => {
      expect(isCanonicalOrganization(capa.owner), `${capa.id} owner ${capa.owner}`).toBe(true);
      expect(mergedSpellings.includes(capa.owner), `${capa.id} uses merged spelling`).toBe(false);
    });
  });

  it('ensures each DEFAULT_INSPECTION_CAPA_ITEMS owner is a kept canonical organization', () => {
    expect(DEFAULT_INSPECTION_CAPA_ITEMS.length).toBeGreaterThan(0);
    DEFAULT_INSPECTION_CAPA_ITEMS.forEach((item) => {
      expect(isCanonicalOrganization(item.owner), `${item.id} owner ${item.owner}`).toBe(true);
      expect(mergedSpellings.includes(item.owner), `${item.id} uses merged spelling`).toBe(false);
    });
  });
});
