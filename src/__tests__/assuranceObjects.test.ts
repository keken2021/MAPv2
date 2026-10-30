import { describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_USERS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';
import {
  SEEDED_OPERATIONAL_OBJECTS,
  SEEDED_ORGANIZATION_OBJECTS,
  SEEDED_STANDALONE_PERSONS,
  objectVerifications,
} from '../store/assuranceObjectMockData';
import { getOrganizationsFromUsers } from '../utils/demoSessionHelpers';
import type { ObjectVerificationStatus } from '../types/assurance';

const STATUSES: ObjectVerificationStatus[] = [
  'Uploaded, not externally verified',
  'Submitted and tested',
  'Tested externally',
  'Used and tested by several entities over time',
];

describe('assurance object mock data', () => {
  it('keeps every seeded id unique, including against the crew directory', () => {
    const storeIds = useMapStore.getState().assuranceObjects.map((object) => object.id);
    expect(new Set(storeIds).size).toBe(storeIds.length);
    const crewIds = new Set(MOCK_CREW.map((member) => member.id));
    SEEDED_STANDALONE_PERSONS.forEach((person) => {
      expect(crewIds.has(person.id)).toBe(false);
      expect(person.type).toBe('person');
    });
  });

  it('gives every new organization and person an owner that is a known organization', () => {
    const known = new Set(getOrganizationsFromUsers(MOCK_USERS));
    expect(SEEDED_ORGANIZATION_OBJECTS.length).toBeGreaterThanOrEqual(6);
    expect(SEEDED_STANDALONE_PERSONS.length).toBeGreaterThanOrEqual(4);
    const owners = new Set<string>();
    [...SEEDED_ORGANIZATION_OBJECTS, ...SEEDED_STANDALONE_PERSONS].forEach((object) => {
      expect(object.identifier).toBeTruthy();
      expect(object.description).toBeTruthy();
      expect(known.has(object.ownerOrganization)).toBe(true);
      owners.add(object.ownerOrganization);
    });
    expect(owners.size).toBeGreaterThanOrEqual(4);
  });

  it('uses every verification status and both channels, once per client', () => {
    const added = [...SEEDED_ORGANIZATION_OBJECTS, ...SEEDED_STANDALONE_PERSONS];
    const statuses = new Set<string>();
    const channels = new Set<string>();
    added.forEach((object) => {
      const checks = objectVerifications(object);
      expect(checks.length).toBeGreaterThanOrEqual(1);
      const clients = checks.map((check) => check.clientOrganization);
      expect(new Set(clients).size).toBe(clients.length);
      checks.forEach((check) => {
        statuses.add(check.status);
        channels.add(check.channel ?? '');
      });
    });
    STATUSES.forEach((status) => expect(statuses.has(status)).toBe(true));
    expect(channels.has('internal')).toBe(true);
    expect(channels.has('external')).toBe(true);
  });

  it('gives each standalone person an assignment with a start date and an end date', () => {
    SEEDED_STANDALONE_PERSONS.forEach((person) => {
      expect(person.assignments?.length).toBeGreaterThan(0);
      person.assignments?.forEach((assignment) => {
        expect(assignment.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(assignment.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  it('keeps the store seed order: vessels, crew, equipment, then operational objects', () => {
    const ids = useMapStore.getState().assuranceObjects.map((object) => object.id);
    const firstOperational = ids.indexOf(SEEDED_OPERATIONAL_OBJECTS[0].id);
    const lastVessel = ids.filter((id) => id.startsWith('VESSEL-')).length;
    expect(firstOperational).toBeGreaterThan(0);
    expect(ids.slice(firstOperational, firstOperational + SEEDED_OPERATIONAL_OBJECTS.length)
      .every((id, index) => id === SEEDED_OPERATIONAL_OBJECTS[index].id)).toBe(true);
    expect(ids.indexOf('OBJ-PROC-LNG-AURORA-01')).toBeGreaterThan(
      ids.indexOf(SEEDED_STANDALONE_PERSONS[SEEDED_STANDALONE_PERSONS.length - 1].id),
    );
    expect(lastVessel).toBeGreaterThan(0);
  });
});
