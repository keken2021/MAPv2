import { describe, expect, it } from 'vitest';
import { AssuranceSet } from '../types/assurance';
import { Project, ProjectAssetLink } from '../types/project';
import {
  buildMasterAssuranceRequirements,
  filterProjectsForPersona,
  getStandaloneAssuranceSetsForAttach,
} from '../utils/projectHelpers';
import { MOCK_PROJECTS } from '../store/projectMockData';
import { MOCK_USERS } from '../store/mockData';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';

const childVesselSet: AssuranceSet = {
  id: 'AS-CHILD-V',
  title: 'Vessel Sub-Set',
  assuranceType: 'Vessel',
  subtypes: ['Vessel'],
  stage: 'Approved',
  readinessScore: 100,
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  requirements: [
    {
      id: 'REQ-V1',
      category: 'Statutory Certificate',
      title: 'Safety Cert',
      isMandatory: true,
      isFulfilled: true,
      documentId: 'DOC-1',
      ocrConfidence: 95,
      verifierStatus: 'Verified',
    },
  ],
} as AssuranceSet;

const childCrewSet: AssuranceSet = {
  id: 'AS-CHILD-C',
  title: 'Crew Sub-Set',
  assuranceType: 'Crew',
  subtypes: ['Crew'],
  stage: 'Initiated',
  readinessScore: 10,
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  requirements: [
    {
      id: 'REQ-C1',
      category: 'Crew Custom Requirement',
      title: 'STCW',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    },
  ],
} as AssuranceSet;

const assetLinks: ProjectAssetLink[] = [
  {
    id: 'PAL-1',
    projectId: 'PROJ-1',
    assetType: 'Vessel',
    assetId: 'V-1',
    assetName: 'Test Vessel',
    providerOrganization: 'Northwind Marine Pty Ltd',
    assuranceSetId: 'AS-CHILD-V',
    roleInProject: 'Subject vessel',
    addedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'PAL-2',
    projectId: 'PROJ-1',
    assetType: 'Crew',
    assetId: 'C-1',
    assetName: 'Test Crew',
    providerOrganization: 'Northwind Marine Pty Ltd',
    assuranceSetId: 'AS-CHILD-C',
    roleInProject: 'Master',
    addedAt: '2026-01-01T00:00:00Z',
  },
];

describe('nested project assurance sets (Req 3–4)', () => {
  it('builds master requirements as links to child sub-sets when asset links are provided', () => {
    const reqs = buildMasterAssuranceRequirements(
      [childVesselSet, childCrewSet],
      'Test Project',
      assetLinks,
    );

    expect(reqs).toHaveLength(2);
    expect(reqs.every((r) => r.fulfillmentType === 'assurance_set')).toBe(true);
    expect(reqs.map((r) => r.linkedAssuranceSetId)).toEqual(['AS-CHILD-V', 'AS-CHILD-C']);
    expect(reqs.find((r) => r.linkedAssuranceSetId === 'AS-CHILD-V')?.isFulfilled).toBe(true);
    expect(reqs.find((r) => r.linkedAssuranceSetId === 'AS-CHILD-C')?.isFulfilled).toBe(false);
  });

  it('falls back to flattened document rollup when no asset links are passed', () => {
    const reqs = buildMasterAssuranceRequirements([childVesselSet, childCrewSet], 'Test Project');

    expect(reqs.some((r) => r.fulfillmentType === 'document')).toBe(true);
    expect(reqs.some((r) => r.id.startsWith('PROJ-REQ-'))).toBe(true);
  });

  it('resolves master readiness from linked sub-set scores', () => {
    const master: AssuranceSet = {
      id: 'AS-MASTER',
      title: 'Master',
      assuranceType: 'Project',
      subtypes: ['Vessel', 'Crew'],
      stage: 'Verification',
      readinessScore: 0,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      isProjectMaster: true,
      requirements: buildMasterAssuranceRequirements(
        [childVesselSet, childCrewSet],
        'Test Project',
        assetLinks,
      ),
    } as AssuranceSet;

    const score = calculateAssuranceSetReadiness(master, [childVesselSet, childCrewSet, master]);
    expect(score).toBeGreaterThan(10);
    expect(score).toBeLessThan(100);
  });

  it('lists standalone assurance sets eligible for attach', () => {
    const project: Project = {
      id: 'PROJ-1',
      name: 'Test',
      projectType: 'Charter / Voyage',
      requestingOrganization: 'Northwind Marine Pty Ltd',
      status: 'Draft',
      assetLinks: [assetLinks[0]],
      masterAssuranceSetId: 'AS-MASTER',
    } as Project;

    const allSets: AssuranceSet[] = [
      childVesselSet,
      childCrewSet,
      {
        id: 'AS-STANDALONE',
        title: 'Standalone Campaign',
        assuranceType: 'Vessel',
        subtypes: ['Vessel'],
        stage: 'Initiated',
        visibility: 'active',
        isProjectMaster: false,
        requirements: [],
      } as AssuranceSet,
      {
        id: 'AS-MASTER',
        title: 'Master',
        assuranceType: 'Project',
        subtypes: ['Vessel'],
        stage: 'Initiated',
        isProjectMaster: true,
        requirements: [],
      } as AssuranceSet,
      {
        id: 'AS-DRAFT',
        title: 'Draft',
        assuranceType: 'Vessel',
        subtypes: ['Vessel'],
        stage: 'Initiated',
        visibility: 'draft',
        requirements: [],
      } as AssuranceSet,
    ];

    const eligible = getStandaloneAssuranceSetsForAttach(allSets, project);
    expect(eligible.map((s) => s.id).sort()).toEqual(['AS-CHILD-C', 'AS-STANDALONE'].sort());
  });

  it('shows Southern Basin client projects to C Admin', () => {
    const visible = filterProjectsForPersona(MOCK_PROJECTS, 'C Admin', MOCK_USERS);
    expect(visible.some((p) => p.id === 'MAP-PROJ-2026-MARINE-009')).toBe(true);
    expect(visible.some((p) => p.id === 'MAP-PROJ-2026-MARINE-007')).toBe(false);
  });
});
