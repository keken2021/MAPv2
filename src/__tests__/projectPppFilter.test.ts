import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { useMapStore } from '../store/useMapStore';
import { assuranceSetMatchesPpp } from '../utils/projectHelpers';
import { ProjectDetailView } from '../views/ProjectDetailView';

const requirement = (category: string, subtype?: string) => ({
  id: category,
  category,
  subtype,
  title: category,
  isMandatory: true,
  isFulfilled: false,
  ocrConfidence: 0,
  verifierStatus: 'Pending' as const,
});

describe('assuranceSetMatchesPpp', () => {
  it('keeps every set on All, including a set with no requirements', () => {
    expect(assuranceSetMatchesPpp({ requirements: [] }, 'All')).toBe(true);
    expect(assuranceSetMatchesPpp({}, 'All')).toBe(true);
  });

  it('matches People only when a requirement is in that pillar', () => {
    const people = { requirements: [requirement('People')] };
    const plant = { requirements: [requirement('Plant')] };
    const both = { requirements: [requirement('People'), requirement('Statutory Certificate')] };

    expect(assuranceSetMatchesPpp(people, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp(people, 'Plant')).toBe(false);
    expect(assuranceSetMatchesPpp(people, 'Process')).toBe(false);
    expect(assuranceSetMatchesPpp({ requirements: [requirement('people')] }, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp(plant, 'People')).toBe(false);
    expect(assuranceSetMatchesPpp(both, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp(both, 'Plant')).toBe(true);
  });

  it('maps seeded document categories onto the three pillars', () => {
    expect(assuranceSetMatchesPpp({ requirements: [requirement('Crew Credential')] }, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp({ requirements: [requirement('Statutory Certificate')] }, 'Plant')).toBe(true);
    expect(assuranceSetMatchesPpp({ requirements: [requirement('Operational Plan')] }, 'Process')).toBe(true);
    expect(assuranceSetMatchesPpp({ requirements: [requirement('Crew Credential')] }, 'Process')).toBe(false);
  });

  it('excludes a set with no requirements from every pillar', () => {
    const empty = { requirements: [] };
    expect(assuranceSetMatchesPpp(empty, 'People')).toBe(false);
    expect(assuranceSetMatchesPpp(empty, 'Plant')).toBe(false);
    expect(assuranceSetMatchesPpp(empty, 'Process')).toBe(false);
  });
});

describe('project detail pillar filter', () => {
  const snapshot = useMapStore.getState();

  afterEach(() => {
    useMapStore.setState({
      assuranceSets: snapshot.assuranceSets,
      activePersona: snapshot.activePersona,
      activeDemoOrganization: snapshot.activeDemoOrganization,
      isAuthenticated: snapshot.isAuthenticated,
    });
  });

  it('filters the assurance list and does not filter the asset roster', () => {
    const peopleSet = {
      id: 'AS-PPP-PEOPLE',
      title: 'People only set',
      assuranceType: 'Crew',
      stage: 'Initiated',
      readinessScore: 0,
      projectId: 'MAP-PROJ-2026-MARINE-017',
      visibility: 'organization',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [requirement('Crew Credential')],
    } as AssuranceSet;
    const processSet = {
      id: 'AS-PPP-PROCESS',
      title: 'Process only set',
      assuranceType: 'Activity',
      stage: 'Initiated',
      readinessScore: 0,
      projectId: 'MAP-PROJ-2026-MARINE-017',
      visibility: 'organization',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [requirement('Operational Plan')],
    } as AssuranceSet;

    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      assuranceSets: [...snapshot.assuranceSets, peopleSet, processSet],
    });

    render(React.createElement(ProjectDetailView, { projectId: 'MAP-PROJ-2026-MARINE-017' }));

    expect(screen.getByText('AS-PPP-PEOPLE')).toBeTruthy();
    expect(screen.getByText('AS-PPP-PROCESS')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(screen.queryByText('AS-PPP-PEOPLE')).toBeNull();
    expect(screen.getByText('AS-PPP-PROCESS')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('AS-PPP-PEOPLE')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Asset Roster' }));
    expect(screen.queryByText('AS-PPP-PEOPLE')).toBeNull();
    expect(screen.getByRole('button', { name: 'Equipment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Equipment' }));
    expect(screen.getByText('Asset ID')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Process' })).toBeNull();
  });
});
