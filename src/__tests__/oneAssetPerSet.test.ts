/*
  file summary: tests assurance object model across multiple types and owner organizations (ADR 0029, reversing ADR 0004).
  responsibilities: verifies a set can hold objects of two or more types, that each object preserves its type and owner organization, that existing mock data loads as assurance objects, and Peter's port-entry mixed object bundle.
  role in system: covers src/types/assurance.ts, src/utils/assuranceTemplates.ts, store mock data, and getProviderLabel in src/utils/formatters.ts.
*/

import { describe, expect, it } from 'vitest';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { AssuranceObject, AssuranceSet } from '../types/assurance';
import {
  getAssuranceSetAsset,
  getAssuranceSetObjects,
  getAssuranceSetScopes,
  toSingleAssetSet,
  SEEDED_OPERATIONAL_OBJECTS,
  vesselToAssuranceObject,
  crewToAssuranceObject,
  equipmentToAssuranceObject,
} from '../utils/assuranceTemplates';
import { getProviderLabel } from '../utils/formatters';

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];

describe('assurance object model (ADR 0029, reversing ADR 0004)', () => {
  it('loads existing mock data sets as assurance objects with type and owner organization', () => {
    ALL_SETS.forEach((set) => {
      const objects = getAssuranceSetObjects(set);
      expect(objects.length, `Set ${set.id} should have at least one assurance object`).toBeGreaterThan(0);
      objects.forEach((obj) => {
        expect(obj.id).toBeTruthy();
        expect(obj.name).toBeTruthy();
        expect(obj.type).toBeTruthy();
        expect(obj.ownerOrganization).toBeTruthy();
      });
    });
  });

  it('allows a set to hold objects of two or more different types', () => {
    const multiTypeSet: AssuranceSet = {
      ...ALL_SETS[0],
      id: 'AS-MULTI-TYPE-01',
      title: 'Integrated Marine Operations Set',
      assuranceObjects: [
        {
          id: 'VESSEL-001',
          type: 'vessel',
          name: 'MV Pacific Endeavour',
          ownerOrganization: 'Tidewater Marine',
          identifier: 'IMO: 9123453',
        },
        {
          id: 'CREW-101',
          type: 'person',
          name: 'Capt. Alexander Wright',
          ownerOrganization: 'Tidewater Marine',
          description: 'Master / Ship Captain',
        },
        {
          id: 'EQ-003',
          type: 'equipment',
          name: 'Free-Fall Lifeboat #1',
          ownerOrganization: 'Tidewater Marine',
          description: 'Life-Saving Appliances',
        },
      ],
    };

    const objects = getAssuranceSetObjects(multiTypeSet);
    const types = new Set(objects.map((o) => o.type));
    expect(types.size).toBe(3);
    expect(types.has('vessel')).toBe(true);
    expect(types.has('person')).toBe(true);
    expect(types.has('equipment')).toBe(true);
  });

  it('preserves each object type and owner organization without stripping', () => {
    const vesselObj: AssuranceObject = {
      id: 'VESSEL-002',
      type: 'vessel',
      name: 'Northwind Supplier',
      ownerOrganization: 'Northwind Marine Ltd',
    };
    const procObj: AssuranceObject = {
      id: 'PROC-01',
      type: 'procedure',
      name: 'Dynamic Positioning Emergency Disconnect',
      ownerOrganization: 'Chevron Australia',
    };
    const methodObj: AssuranceObject = {
      id: 'METH-01',
      type: 'method',
      name: 'Offshore Offloading Method Statement',
      ownerOrganization: 'Woodside Energy',
    };

    const mixedSet: AssuranceSet = {
      ...ALL_SETS[0],
      id: 'AS-MIXED-01',
      assuranceObjects: [vesselObj, procObj, methodObj],
    };

    const objects = getAssuranceSetObjects(mixedSet);
    expect(objects).toHaveLength(3);
    expect(objects[0]).toEqual(vesselObj);
    expect(objects[1]).toEqual(procObj);
    expect(objects[2]).toEqual(methodObj);
  });

  it('supports Peter\'s port-entry example bundling vessel, person, equipment, procedure, and method', () => {
    const portEntryObjects: AssuranceObject[] = [
      vesselToAssuranceObject({
        id: 'VESSEL-001',
        name: 'MV Pacific Endeavour',
        imoNumber: '9123453',
        ownerOrg: 'Tidewater Marine',
      }),
      crewToAssuranceObject({
        id: 'CREW-101',
        fullName: 'Capt. Alexander Wright',
        rank: 'Master',
        organization: 'Tidewater Marine',
      }),
      equipmentToAssuranceObject({
        id: 'EQ-001',
        name: 'Emergency Towing System',
        category: 'Fire-Fighting Equipment (FFE)',
        owningOrganization: 'Tidewater Marine',
      }),
      SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-PROC-PORT-01')!,
      SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-METH-TOW-01')!,
      SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-DOC-CLR-01')!,
      SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-ORG-PPA-01')!,
    ];

    const portEntrySet: AssuranceSet = {
      ...ALL_SETS[0],
      id: 'AS-PORT-ENTRY-01',
      title: 'Chevron - Port Entry & Arrival Assurance Set',
      assuranceObjects: portEntryObjects,
      subtypes: ['Vessel', 'Crew', 'Equipment'],
    };

    const objects = getAssuranceSetObjects(portEntrySet);
    expect(objects.length).toBe(7);
    const types = objects.map((o) => o.type);
    expect(types).toContain('vessel');
    expect(types).toContain('person');
    expect(types).toContain('equipment');
    expect(types).toContain('procedure');
    expect(types).toContain('method');
    expect(types).toContain('document');
    expect(types).toContain('organization');

    // Procedure and method objects can be given tasks
    const procedureTask = {
      ...portEntrySet.requirements[0],
      id: 'TASK-PROC-01',
      title: 'Verify Port Entry & Berthing Procedure Acceptance',
      targetObjectId: 'OBJ-PROC-PORT-01',
    };
    const methodTask = {
      ...portEntrySet.requirements[0],
      id: 'TASK-METH-01',
      title: 'Review Mooring & Towage Method Statement (MOP)',
      targetObjectId: 'OBJ-METH-TOW-01',
    };

    portEntrySet.requirements = [procedureTask, methodTask];
    expect(portEntrySet.requirements[0].targetObjectId).toBe('OBJ-PROC-PORT-01');
    expect(portEntrySet.requirements[1].targetObjectId).toBe('OBJ-METH-TOW-01');
  });

  it('preserves multi-object sets in toSingleAssetSet without dropping foreign scopes (reverses ADR 0004)', () => {
    const base = ALL_SETS[0];
    const multiSet: AssuranceSet = {
      ...base,
      assuranceType: 'Vessel',
      subtypes: ['Vessel', 'Crew', 'Equipment'],
      assuranceObjects: [
        {
          id: 'VESSEL-001',
          type: 'vessel',
          name: 'MV Pacific Endeavour',
          ownerOrganization: 'Tidewater Marine',
        },
        {
          id: 'CREW-101',
          type: 'person',
          name: 'Capt. Alexander Wright',
          ownerOrganization: 'Tidewater Marine',
        },
        {
          id: 'EQ-003',
          type: 'equipment',
          name: 'Free-Fall Lifeboat #1',
          ownerOrganization: 'Tidewater Marine',
        },
      ],
      requirements: [
        { ...base.requirements[0], id: 'r-vessel', subtype: 'Vessel' },
        { ...base.requirements[0], id: 'r-crew', subtype: 'Crew' },
        { ...base.requirements[0], id: 'r-equip', subtype: 'Equipment' },
      ],
    };

    const preserved = toSingleAssetSet(multiSet);
    expect(preserved.assuranceObjects).toHaveLength(3);
    expect(preserved.requirements).toHaveLength(3);
    expect(preserved.requirements.map((r) => r.id)).toEqual(['r-vessel', 'r-crew', 'r-equip']);
  });

  it('names the covered asset for legacy single-asset queries', () => {
    const base = ALL_SETS.find((s) => s.id === 'AS-2026-001')!;
    expect(getAssuranceSetAsset(base)).toEqual({ type: 'Vessel', id: 'VESSEL-001', name: 'MV Pacific Endeavour' });

    const crewSet = ALL_SETS.find((s) => s.id === 'AS-CRW-101-01')!;
    expect(getAssuranceSetAsset(crewSet)).toEqual({ type: 'Crew', id: 'CREW-101', name: 'Capt. Alexander Wright' });
  });

  it('names the provider by the asset type', () => {
    expect(getProviderLabel('Vessel')).toBe('Vessel Provider');
    expect(getProviderLabel('Crew')).toBe('Crew Provider');
    expect(getProviderLabel('Equipment')).toBe('Equipment Provider');
    expect(getProviderLabel('vessel')).toBe('Vessel Provider');
    expect(getProviderLabel('crew')).toBe('Crew Provider');
    expect(getProviderLabel('equipment')).toBe('Equipment Provider');
    expect(getProviderLabel()).toBe('Provider');
    expect(getProviderLabel('service')).toBe('Provider');
    expect(getProviderLabel('Activity')).toBe('Provider');
  });
});
