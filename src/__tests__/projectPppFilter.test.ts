import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssuranceRequirement, AssuranceSet, AssuranceSubtype, ThreePillarsCategory } from '../types/assurance';
import { useMapStore } from '../store/useMapStore';
import { assuranceSetMatchesPpp } from '../utils/projectHelpers';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { AssuranceDetailView } from '../views/AssuranceDetailView';

const requirement = (
  category: string,
  subtype?: AssuranceSubtype,
  title?: string,
  id?: string
): AssuranceRequirement => ({
  id: id || `${category}-${title || 'req'}`,
  category,
  subtype,
  title: title || category,
  isMandatory: true,
  isFulfilled: false,
  ocrConfidence: 0,
  verifierStatus: 'Pending',
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

  it('matches only its tags when tagged, even when requirements say otherwise', () => {
    const taggedSet: { tags: ThreePillarsCategory[]; requirements: AssuranceRequirement[] } = {
      tags: ['Plant', 'Process'],
      requirements: [requirement('Crew Credential')],
    };
    expect(assuranceSetMatchesPpp(taggedSet, 'All')).toBe(true);
    expect(assuranceSetMatchesPpp(taggedSet, 'Plant')).toBe(true);
    expect(assuranceSetMatchesPpp(taggedSet, 'Process')).toBe(true);
    expect(assuranceSetMatchesPpp(taggedSet, 'People')).toBe(false);

    const taggedPeopleOnly: { tags: ThreePillarsCategory[]; requirements: AssuranceRequirement[] } = {
      tags: ['People'],
      requirements: [requirement('Statutory Certificate')],
    };
    expect(assuranceSetMatchesPpp(taggedPeopleOnly, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp(taggedPeopleOnly, 'Plant')).toBe(false);
  });

  it('infers pillar from requirements when untagged or tags array is empty', () => {
    const untagged = { requirements: [requirement('Crew Credential')] };
    expect(assuranceSetMatchesPpp(untagged, 'People')).toBe(true);
    expect(assuranceSetMatchesPpp(untagged, 'Plant')).toBe(false);

    const emptyTags = { tags: [], requirements: [requirement('Statutory Certificate')] };
    expect(assuranceSetMatchesPpp(emptyTags, 'Plant')).toBe(true);
    expect(assuranceSetMatchesPpp(emptyTags, 'People')).toBe(false);
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

  it('filters a tagged set according to its tags on project detail', () => {
    const plantProcessSet = {
      id: 'AS-PPP-TAGGED',
      title: 'Plant and Process tagged set',
      assuranceType: 'Vessel',
      stage: 'Initiated',
      readinessScore: 0,
      projectId: 'MAP-PROJ-2026-MARINE-017',
      visibility: 'organization',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      tags: ['Plant', 'Process'],
      requirements: [requirement('Crew Credential')],
    } as AssuranceSet;

    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      assuranceSets: [...snapshot.assuranceSets, plantProcessSet],
    });

    render(React.createElement(ProjectDetailView, { projectId: 'MAP-PROJ-2026-MARINE-017' }));

    expect(screen.getByText('AS-PPP-TAGGED')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Plant' }));
    expect(screen.getByText('AS-PPP-TAGGED')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(screen.getByText('AS-PPP-TAGGED')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'People' }));
    expect(screen.queryByText('AS-PPP-TAGGED')).toBeNull();
  });
});

describe('set detail tags and documents table grouping', () => {
  const snapshot = useMapStore.getState();

  afterEach(() => {
    useMapStore.setState({
      assuranceSets: snapshot.assuranceSets,
      activePersona: snapshot.activePersona,
      activeDemoOrganization: snapshot.activeDemoOrganization,
      isAuthenticated: snapshot.isAuthenticated,
    });
    window.location.hash = '';
  });

  it('shows chosen tags once on set detail with no document row carrying a tag', () => {
    const testSet: AssuranceSet = {
      id: 'AS-PPP-TAGS-ONCE',
      title: 'Assurance Set with Plant and Process tags',
      assuranceType: 'Vessel',
      vesselId: 'VESSEL-001',
      vesselName: 'Pacific Hornbill',
      imoNumber: 'IMO-9481234',
      stage: 'Initiated',
      readinessScore: 0,
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-01',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Client Admin',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
      tags: ['Plant', 'Process'],
      requirements: [
        requirement('Statutory Certificate', 'Vessel', 'Class Certificate', 'REQ-1'),
        requirement('Operational Plan', 'Activity', 'Safety Plan', 'REQ-2'),
      ],
    };

    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      assuranceSets: [...snapshot.assuranceSets, testSet],
    });

    render(React.createElement(AssuranceDetailView, { setId: 'AS-PPP-TAGS-ONCE' }));

    expect(screen.getAllByText('Plant').length).toBe(1);
    expect(screen.getAllByText('Process').length).toBe(1);
    expect(screen.queryByText('People')).toBeNull();
  });

  it('groups documents under People, Plant and Process heading rows, omits empty groups, and sorts inside groups', () => {
    const testSet: AssuranceSet = {
      id: 'AS-PPP-GROUPING',
      title: 'Assurance Set Grouping Test',
      assuranceType: 'Vessel',
      vesselId: 'VESSEL-001',
      vesselName: 'Pacific Hornbill',
      imoNumber: 'IMO-9481234',
      stage: 'Initiated',
      readinessScore: 0,
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-01',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Client Admin',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
      requirements: [
        requirement('Operational Plan', 'Activity', 'Z Operational Plan', 'REQ-PROC-Z'),
        requirement('Crew Credential', 'Crew', 'B Crew CoC', 'REQ-PEOPLE-B'),
        requirement('Operational Plan', 'Activity', 'A Safety MOP', 'REQ-PROC-A'),
        requirement('Crew Credential', 'Crew', 'A Medical Certificate', 'REQ-PEOPLE-A'),
        {
          ...requirement('Other', undefined, 'Project Non-Standard Document', 'REQ-OTHER-1'),
          isOtherDocument: true,
        },
      ],
    };

    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      assuranceSets: [...snapshot.assuranceSets, testSet],
    });

    render(React.createElement(AssuranceDetailView, { setId: 'AS-PPP-GROUPING' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Requirements' }));

    expect(screen.getByText('People')).toBeTruthy();
    expect(screen.getByText('Process')).toBeTruthy();
    expect(screen.getByText('Other Documents')).toBeTruthy();
    expect(screen.queryByText('Plant')).toBeNull();

    const rows = screen.getAllByRole('row');
    const rowTexts = rows.map((r) => r.textContent || '');

    const peopleHeadingIdx = rowTexts.findIndex((t) => t.includes('People'));
    const peopleDocAIdx = rowTexts.findIndex((t) => t.includes('A Medical Certificate'));
    const peopleDocBIdx = rowTexts.findIndex((t) => t.includes('B Crew CoC'));
    const processHeadingIdx = rowTexts.findIndex((t) => t.includes('Process'));
    const procDocAIdx = rowTexts.findIndex((t) => t.includes('A Safety MOP'));
    const procDocZIdx = rowTexts.findIndex((t) => t.includes('Z Operational Plan'));
    const otherHeadingIdx = rowTexts.findIndex((t) => t.includes('Other Documents'));
    const otherDocIdx = rowTexts.findIndex((t) => t.includes('Project Non-Standard Document'));

    expect(peopleHeadingIdx).toBeLessThan(peopleDocAIdx);
    expect(peopleDocAIdx).toBeLessThan(peopleDocBIdx);
    expect(peopleDocBIdx).toBeLessThan(processHeadingIdx);
    expect(processHeadingIdx).toBeLessThan(procDocAIdx);
    expect(procDocAIdx).toBeLessThan(procDocZIdx);
    expect(procDocZIdx).toBeLessThan(otherHeadingIdx);
    expect(otherHeadingIdx).toBeLessThan(otherDocIdx);

    const titleHeader = screen.getByRole('columnheader', { name: /Title/i });
    fireEvent.click(titleHeader);

    const descRows = screen.getAllByRole('row');
    const descTexts = descRows.map((r) => r.textContent || '');

    const descPeopleA = descTexts.findIndex((t) => t.includes('A Medical Certificate'));
    const descPeopleB = descTexts.findIndex((t) => t.includes('B Crew CoC'));
    const descProcA = descTexts.findIndex((t) => t.includes('A Safety MOP'));
    const descProcZ = descTexts.findIndex((t) => t.includes('Z Operational Plan'));

    expect(descPeopleB).toBeLessThan(descPeopleA);
    expect(descProcZ).toBeLessThan(descProcA);
    expect(descPeopleA).toBeLessThan(descTexts.findIndex((t) => t.includes('Process')));
  });

  it('repeats the group heading on the next page when a group continues across pages', () => {
    const plantReqs = Array.from({ length: 12 }, (_, i) =>
      requirement('Statutory Certificate', 'Vessel', `Plant Certificate ${String(i + 1).padStart(2, '0')}`, `PLANT-${i + 1}`)
    );

    const testSet: AssuranceSet = {
      id: 'AS-PPP-PAGINATION',
      title: 'Assurance Set Pagination Heading Repeat',
      assuranceType: 'Vessel',
      vesselId: 'VESSEL-001',
      vesselName: 'Pacific Hornbill',
      imoNumber: 'IMO-9481234',
      stage: 'Initiated',
      readinessScore: 0,
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-01',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Client Admin',
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      visibility: 'organization',
      requirements: plantReqs,
    };

    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      assuranceSets: [...snapshot.assuranceSets, testSet],
    });

    render(React.createElement(AssuranceDetailView, { setId: 'AS-PPP-PAGINATION' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Requirements' }));

    expect(screen.getByText('Plant')).toBeTruthy();
    expect(screen.getByText('Plant Certificate 01')).toBeTruthy();
    expect(screen.queryByText('Plant Certificate 11')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText('Plant')).toBeTruthy();
    expect(screen.getByText('Plant Certificate 11')).toBeTruthy();
  });
});
