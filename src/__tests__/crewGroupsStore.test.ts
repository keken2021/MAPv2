/* 
  file summary: unit tests for CrewGroup store actions and mock data isolation.
  responsibilities: verifies mock crew groups load, actions create, edit, and set members, and that crew/seafarer records are not mutated.
  role in system: executed during vitest unit test suite runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_CREW_GROUPS } from '../store/crewMockData';
import { CrewGroup } from '../types/crew';

describe('Crew Groups Store State & Actions', () => {
  beforeEach(() => {
    // Reset crewGroups to initial mock groups
    useMapStore.setState({ crewGroups: [...MOCK_CREW_GROUPS] });
  });

  it('loads mock crew groups with Dive Team and Survey Team', () => {
    const store = useMapStore.getState();
    expect(store.crewGroups).toHaveLength(2);

    const diveTeam = store.crewGroups.find((g) => g.name === 'Dive Team');
    expect(diveTeam).toBeDefined();
    expect(diveTeam?.id).toBe('CG-001');
    expect(diveTeam?.specialization).toBe('Subsea & Diving Operations');
    expect(diveTeam?.memberIds).toEqual(['CREW-101', 'CREW-104']);

    const surveyTeam = store.crewGroups.find((g) => g.name === 'Survey Team');
    expect(surveyTeam).toBeDefined();
    expect(surveyTeam?.id).toBe('CG-002');
    expect(surveyTeam?.specialization).toBe('Hydrographic Survey');
    expect(surveyTeam?.memberIds).toEqual(['CREW-102', 'CREW-103', 'CREW-105']);
  });

  it('adds a new crew group and updates only crewGroups', () => {
    const store = useMapStore.getState();
    const initialCrew = [...store.crew];
    const initialGroupCount = store.crewGroups.length;

    const newGroup: CrewGroup = {
      id: 'CG-003',
      name: 'Rigging Specialists',
      specialization: 'Heavy Lift & Rigging',
      specializations: ['Heavy Lift & Rigging', 'Deck Crane Operations'],
      memberIds: ['CREW-104'],
      organization: 'Northwind Marine Pty Ltd',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.addCrewGroup(newGroup);

    const updatedState = useMapStore.getState();
    expect(updatedState.crewGroups).toHaveLength(initialGroupCount + 1);
    expect(updatedState.crewGroups.find((g) => g.id === 'CG-003')).toEqual(newGroup);

    // Confirms actions update only CrewGroup and leave crew directory intact
    expect(updatedState.crew).toEqual(initialCrew);
  });

  it('updates an existing crew group details without mutating crew members', () => {
    const store = useMapStore.getState();
    const initialCrew = [...store.crew];

    store.updateCrewGroup({
      id: 'CG-001',
      name: 'Advanced Dive Team',
      description: 'Updated offshore diving unit description',
    });

    const updatedState = useMapStore.getState();
    const updatedGroup = updatedState.crewGroups.find((g) => g.id === 'CG-001');
    expect(updatedGroup?.name).toBe('Advanced Dive Team');
    expect(updatedGroup?.description).toBe('Updated offshore diving unit description');
    // memberIds should remain intact
    expect(updatedGroup?.memberIds).toEqual(['CREW-101', 'CREW-104']);

    // Confirms only CrewGroup was updated
    expect(updatedState.crew).toEqual(initialCrew);
  });

  it('sets group members and preserves seafarer profile integrity', () => {
    const store = useMapStore.getState();
    const initialCrew = JSON.stringify(store.crew);

    store.setCrewGroupMembers('CG-001', ['CREW-101', 'CREW-102', 'CREW-103']);

    const updatedState = useMapStore.getState();
    const diveTeam = updatedState.crewGroups.find((g) => g.id === 'CG-001');
    expect(diveTeam?.memberIds).toEqual(['CREW-101', 'CREW-102', 'CREW-103']);

    // Other groups unaffected
    const surveyTeam = updatedState.crewGroups.find((g) => g.id === 'CG-002');
    expect(surveyTeam?.memberIds).toEqual(['CREW-102', 'CREW-103', 'CREW-105']);

    // Individual CrewMember objects untouched
    expect(JSON.stringify(updatedState.crew)).toBe(initialCrew);
  });

  it('adds and removes individual members to/from a group', () => {
    const store = useMapStore.getState();
    const initialCrew = JSON.stringify(store.crew);

    // Add member
    store.addMemberToCrewGroup('CG-001', 'CREW-105');
    let group = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001');
    expect(group?.memberIds).toContain('CREW-105');

    // Remove member
    store.removeMemberFromCrewGroup('CG-001', 'CREW-105');
    group = useMapStore.getState().crewGroups.find((g) => g.id === 'CG-001');
    expect(group?.memberIds).not.toContain('CREW-105');
    expect(group?.memberIds).toEqual(['CREW-101', 'CREW-104']);

    // Crew array untouched
    expect(JSON.stringify(useMapStore.getState().crew)).toBe(initialCrew);
  });
});
