import { describe, expect, it } from 'vitest';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { resolveRequestedAssuranceObjects } from '../utils/requestedAssuranceObjects';

const vessel = MOCK_VESSELS[0];
const member = MOCK_CREW[0];
const item = MOCK_EQUIPMENT[0];

describe('resolveRequestedAssuranceObjects', () => {
  it('fills in every requested object, in request order', () => {
    const objects = resolveRequestedAssuranceObjects(
      [
        { assetId: vessel.id, assetType: 'Vessel', assetName: vessel.name },
        { assetId: member.id, assetType: 'Crew', assetName: member.fullName },
        { assetId: item.id, assetType: 'Equipment', assetName: item.name },
      ],
      MOCK_VESSELS,
      MOCK_CREW,
      MOCK_EQUIPMENT,
    );
    expect(objects.map((o) => o.id)).toEqual([vessel.id, member.id, item.id]);
    expect(objects.map((o) => o.type)).toEqual(['vessel', 'person', 'equipment']);
  });

  it('skips objects that no longer exist', () => {
    const objects = resolveRequestedAssuranceObjects(
      [
        { assetId: 'VESSEL-NOPE', assetType: 'Vessel', assetName: 'Gone' },
        { assetId: vessel.id, assetType: 'Vessel', assetName: vessel.name },
      ],
      MOCK_VESSELS,
      MOCK_CREW,
      MOCK_EQUIPMENT,
    );
    expect(objects.map((o) => o.id)).toEqual([vessel.id]);
  });

  it('returns nothing when the request names no objects', () => {
    expect(resolveRequestedAssuranceObjects(undefined, MOCK_VESSELS, MOCK_CREW, MOCK_EQUIPMENT)).toEqual([]);
    expect(resolveRequestedAssuranceObjects([], MOCK_VESSELS, MOCK_CREW, MOCK_EQUIPMENT)).toEqual([]);
  });
});
