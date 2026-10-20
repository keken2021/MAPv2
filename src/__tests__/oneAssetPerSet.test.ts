/*
  file summary: tests that an assurance set covers one asset, or one or more crew members on a crew set (ADR 0004, amended by ADR 0023).
  responsibilities: verifies every seeded set has one scope and one covered asset (a crew list only on crew sets), that the store reduces a set built with several scopes, and the provider term of each asset type.
  role in system: covers src/utils/assuranceTemplates.ts, the seeded sets in src/store/mockData.ts and src/store/projectMockData.ts, and getProviderLabel in src/utils/formatters.ts.
*/

import { describe, expect, it } from 'vitest';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { AssuranceSet } from '../types/assurance';
import { getAssuranceSetAsset, getAssuranceSetScopes, toSingleAssetSet } from '../utils/assuranceTemplates';
import { getProviderLabel } from '../utils/formatters';

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];

describe('one asset per assurance set', () => {
  it('seeds every set with one scope, equal to the scope it is filed under', () => {
    ALL_SETS.forEach((set) => {
      const scope = getAssuranceSetScopes(set)[0];
      expect(getAssuranceSetScopes(set), set.id).toHaveLength(1);
      if (set.subtypes) expect(set.subtypes, set.id).toEqual([scope]);
    });
  });

  it('seeds no requirement that belongs to another scope', () => {
    ALL_SETS.forEach((set) => {
      const scope = getAssuranceSetScopes(set)[0];
      const foreign = set.requirements.filter((r) => r.subtype && r.subtype !== scope).map((r) => r.id);
      expect(foreign, set.id).toEqual([]);
    });
  });

  it('seeds one covered asset per set, with no link to an asset of another scope', () => {
    ALL_SETS.forEach((set) => {
      const asset = getAssuranceSetAsset(set);
      expect(asset.id, set.id).toBeTruthy();
      if (asset.type !== 'Crew') expect(set.crewId, set.id).toBeUndefined();
      if (asset.type !== 'Equipment') expect(set.equipmentId, set.id).toBeUndefined();
    });
  });

  it('seeds a crew list only on crew sets, led by the set crewId', () => {
    ALL_SETS.forEach((set) => {
      if (!set.crewIds) return;
      expect(getAssuranceSetScopes(set)[0], set.id).toBe('Crew');
      expect(set.crewIds[0], set.id).toBe(set.crewId);
      expect(new Set(set.crewIds).size, set.id).toBe(set.crewIds.length);
    });
  });

  it('names the covered asset by the scope of the set', () => {
    const base = ALL_SETS.find((s) => s.id === 'AS-2026-001')!;
    expect(getAssuranceSetAsset(base)).toEqual({ type: 'Vessel', id: 'VESSEL-001', name: 'MV Pacific Endeavour' });

    const crewSet = ALL_SETS.find((s) => s.id === 'AS-CRW-101-01')!;
    expect(getAssuranceSetAsset(crewSet)).toEqual({ type: 'Crew', id: 'CREW-101', name: 'Capt. Alexander Wright' });
    /* the vessel on a crew set is the host vessel, not a second covered asset */
    expect(crewSet.vesselId).toBe('VESSEL-001');
  });

  it('reduces a set built with several scopes to the one it is filed under', () => {
    const base = ALL_SETS.find((s) => s.id === 'AS-2026-001')!;
    const mixed: AssuranceSet = {
      ...base,
      assuranceType: 'Crew',
      subtypes: ['Vessel', 'Crew', 'Equipment'],
      crewId: 'CREW-101',
      crewName: 'Capt. Alexander Wright',
      equipmentId: 'EQ-003',
      equipmentName: 'Free-Fall Lifeboat #1',
      requirements: [
        { ...base.requirements[0], id: 'r-vessel', subtype: 'Vessel' },
        { ...base.requirements[0], id: 'r-crew', subtype: 'Crew' },
        { ...base.requirements[0], id: 'r-none', subtype: undefined },
      ],
    };
    const single = toSingleAssetSet(mixed);
    expect(single.subtypes).toEqual(['Crew']);
    expect(single.crewId).toBe('CREW-101');
    expect(single.equipmentId).toBeUndefined();
    expect(single.equipmentName).toBeUndefined();
    expect(single.requirements.map((r) => r.id)).toEqual(['r-crew', 'r-none']);
  });

  it('names the provider by the asset type', () => {
    expect(getProviderLabel('Vessel')).toBe('Vessel Provider');
    expect(getProviderLabel('Crew')).toBe('Crew Provider');
    expect(getProviderLabel('Equipment')).toBe('Equipment Provider');
    /* marketplace categories are lower case */
    expect(getProviderLabel('vessel')).toBe('Vessel Provider');
    expect(getProviderLabel('crew')).toBe('Crew Provider');
    expect(getProviderLabel('equipment')).toBe('Equipment Provider');
    /* a list that mixes asset types, and a scope that is not an asset */
    expect(getProviderLabel()).toBe('Provider');
    expect(getProviderLabel('service')).toBe('Provider');
    expect(getProviderLabel('Activity')).toBe('Provider');
  });
});
