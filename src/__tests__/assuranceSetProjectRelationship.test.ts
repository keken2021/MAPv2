/*
  file summary: tests the project to assurance set relationship and the created-by label.
  responsibilities: verifies a set belongs to at most one project, a project holds zero or many sets, orphaned sets can be attached, and the created-by label follows the viewer organization.
  role in system: covers projectHelpers.ts, rbacHelpers.ts and the project link actions in useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import {
  getProjectForAssuranceSet,
  getStandaloneAssuranceSetsForAttach,
  isAssuranceSetOrphaned,
} from '../utils/projectHelpers';
import {
  getAssuranceSetCreatedByLabel,
  getAssuranceSetCreator,
  isAssuranceSetOwnedOrInitiatedByOrganization,
} from '../utils/rbacHelpers';
import { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

/* builds a standalone vessel set that is not part of any project */
const buildOrphanSet = (id: string, vesselId: string, vesselName: string): AssuranceSet => ({
  id,
  title: `${vesselName} — Relationship Test Vetting ${id}`,
  assuranceType: 'Vessel',
  subtypes: ['Vessel'],
  vesselId,
  vesselName,
  imoNumber: '9000001',
  initiatorOrg: 'Northwind Marine Pty Ltd',
  initiatorRole: 'Vessel Provider Admin',
  charterWindowStart: '2026-11-01',
  charterWindowEnd: '2027-02-01',
  stage: 'Validation',
  readinessScore: 10,
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  requirements: [],
  visibility: 'organization',
});

describe('project to assurance set relationship', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('seed data links every assurance set to at most one project', () => {
    const owners = new Map<string, string[]>();
    MOCK_PROJECTS.forEach((project) => {
      project.assetLinks
        .map((l) => l.assuranceSetId)
        .filter((id): id is string => Boolean(id))
        .forEach((setId) => owners.set(setId, [...(owners.get(setId) ?? []), project.id]));
    });

    const shared = [...owners.entries()].filter(([, projectIds]) => new Set(projectIds).size > 1);
    expect(shared).toEqual([]);
  });

  it('seed sets that carry a projectId point at the project that lists them', () => {
    [...PROJECT_SEED_ASSURANCE_SETS, ...MOCK_ASSURANCE_SETS]
      .filter((s) => s.projectId)
      .forEach((s) => {
        const owner = getProjectForAssuranceSet(s, MOCK_PROJECTS);
        if (owner) expect(owner.id).toBe(s.projectId);
      });
  });

  it('allows a project with zero sets and a project with many sets', () => {
    const store = useMapStore.getState();
    const result = store.addProject({
      name: 'Relationship Test Empty Project',
      projectType: 'Assurance Campaign',
      requestingOrganization: 'Northwind Marine Pty Ltd',
      clientOperator: 'Northwind Marine Pty Ltd',
      location: 'Fremantle Inner Harbour',
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-03-01',
      operatorOrganization: 'Northwind Marine Pty Ltd',
    });
    expect(result.success).toBe(true);
    const projectId = result.projectId as string;
    expect(useMapStore.getState().projects.find((p) => p.id === projectId)?.assetLinks).toHaveLength(0);

    useMapStore.setState((state) => ({
      assuranceSets: [
        ...state.assuranceSets,
        buildOrphanSet('AS-REL-001', 'VESSEL-002', 'Relationship Test Vessel A'),
        buildOrphanSet('AS-REL-002', 'VESSEL-003', 'Relationship Test Vessel B'),
      ],
    }));

    expect(useMapStore.getState().attachAssuranceSetToProject('AS-REL-001', projectId).success).toBe(true);
    expect(useMapStore.getState().attachAssuranceSetToProject('AS-REL-002', projectId).success).toBe(true);

    const project = useMapStore.getState().projects.find((p) => p.id === projectId);
    expect(project?.assetLinks.map((l) => l.assuranceSetId).sort()).toEqual(['AS-REL-001', 'AS-REL-002']);
  });

  it('attaches an orphaned set to one project and stamps the project on the set', () => {
    const projectId = MOCK_PROJECTS[0].id;
    useMapStore.setState((state) => ({
      assuranceSets: [...state.assuranceSets, buildOrphanSet('AS-REL-003', 'VESSEL-REL-003', 'Relationship Test Vessel C')],
    }));

    const before = useMapStore.getState();
    const orphan = before.assuranceSets.find((s) => s.id === 'AS-REL-003') as AssuranceSet;
    expect(isAssuranceSetOrphaned(orphan, before.projects)).toBe(true);

    expect(before.attachAssuranceSetToProject('AS-REL-003', projectId).success).toBe(true);

    const after = useMapStore.getState();
    const attached = after.assuranceSets.find((s) => s.id === 'AS-REL-003') as AssuranceSet;
    expect(attached.projectId).toBe(projectId);
    expect(getProjectForAssuranceSet(attached, after.projects)?.id).toBe(projectId);
    expect(isAssuranceSetOrphaned(attached, after.projects)).toBe(false);
  });

  it('refuses to add a set that already belongs to another project', () => {
    const [first, second] = MOCK_PROJECTS;
    useMapStore.setState((state) => ({
      assuranceSets: [...state.assuranceSets, buildOrphanSet('AS-REL-004', 'VESSEL-REL-004', 'Relationship Test Vessel D')],
    }));

    expect(useMapStore.getState().attachAssuranceSetToProject('AS-REL-004', first.id).success).toBe(true);

    const result = useMapStore.getState().attachAssuranceSetToProject('AS-REL-004', second.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already belongs to project');

    const state = useMapStore.getState();
    const owners = state.projects.filter((p) => p.assetLinks.some((l) => l.assuranceSetId === 'AS-REL-004'));
    expect(owners.map((p) => p.id)).toEqual([first.id]);
    expect(state.assuranceSets.find((s) => s.id === 'AS-REL-004')?.projectId).toBe(first.id);
  });

  it('does not offer sets from another project in the attach list', () => {
    const state = useMapStore.getState();
    const [first, second] = state.projects;
    const offered = getStandaloneAssuranceSetsForAttach(state.assuranceSets, second, state.projects);
    const firstProjectSetIds = first.assetLinks.map((l) => l.assuranceSetId);

    expect(firstProjectSetIds.length).toBeGreaterThan(0);
    expect(offered.some((s) => firstProjectSetIds.includes(s.id))).toBe(false);
  });

  it('returns a set to orphaned when its roster link is removed', () => {
    const projectId = MOCK_PROJECTS[0].id;
    useMapStore.setState((state) => ({
      assuranceSets: [...state.assuranceSets, buildOrphanSet('AS-REL-005', 'VESSEL-REL-005', 'Relationship Test Vessel E')],
    }));
    useMapStore.getState().attachAssuranceSetToProject('AS-REL-005', projectId);

    const link = useMapStore
      .getState()
      .projects.find((p) => p.id === projectId)
      ?.assetLinks.find((l) => l.assuranceSetId === 'AS-REL-005');
    expect(link).toBeDefined();

    useMapStore.getState().removeAssetFromProject(projectId, link!.id);

    const state = useMapStore.getState();
    const released = state.assuranceSets.find((s) => s.id === 'AS-REL-005') as AssuranceSet;
    expect(released.projectId).toBeUndefined();
    expect(isAssuranceSetOrphaned(released, state.projects)).toBe(true);
  });

  it('never treats a draft as orphaned', () => {
    expect(
      isAssuranceSetOrphaned({ ...buildOrphanSet('AS-REL-006', 'VESSEL-002', 'Relationship Test Vessel F'), visibility: 'draft' }, MOCK_PROJECTS),
    ).toBe(false);
  });
});

describe('assurance set created-by label', () => {
  const northwindSet = buildOrphanSet('AS-REL-010', 'VESSEL-002', 'Relationship Test Vessel G');

  it('uses the stored creator name when present', () => {
    expect(getAssuranceSetCreator({ ...northwindSet, createdByName: 'K. Osei' }, MOCK_USERS).name).toBe('K. Osei');
  });

  it('resolves the creator from the creating role inside the initiating organization', () => {
    expect(getAssuranceSetCreator(northwindSet, MOCK_USERS)).toEqual({
      name: 'K. Osei',
      organization: 'Northwind Marine Pty Ltd',
    });
  });

  it('shows the creator name to a viewer in the same organization', () => {
    expect(getAssuranceSetCreatedByLabel(northwindSet, MOCK_USERS, 'Administrator')).toBe('K. Osei');
  });

  it('shows the initiating organization to a viewer from another organization', () => {
    expect(getAssuranceSetCreatedByLabel(northwindSet, MOCK_USERS, 'C Admin')).toBe('Northwind Marine Pty Ltd');
  });

  it('falls back to the organization when the creator is unknown', () => {
    const unknown = { ...northwindSet, initiatorOrg: 'Unknown Maritime Agency Ltd' };
    expect(getAssuranceSetCreator(unknown, MOCK_USERS).name).toBeUndefined();
    expect(getAssuranceSetCreatedByLabel(unknown, MOCK_USERS, 'Administrator')).toBe('Unknown Maritime Agency Ltd');
  });
});

describe('organization tab ownership', () => {
  const base = buildOrphanSet('AS-REL-020', 'VESSEL-002', 'Relationship Test Vessel H');

  it('includes sets initiated by the organization', () => {
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(base, 'Northwind Marine Pty Ltd')).toBe(true);
  });

  it('includes sets owned by the organization as client', () => {
    const owned = { ...base, initiatorOrg: 'Northwind Marine Pty Ltd', clientOrg: 'Southern Basin Energy Pty Ltd' };
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(owned, 'Southern Basin Energy Pty Ltd')).toBe(true);
  });

  it('excludes sets that another organization owns and initiated', () => {
    const foreign = { ...base, initiatorOrg: 'Woodside Energy Ltd', clientOrg: 'Woodside Energy Ltd' };
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(foreign, 'Northwind Marine Pty Ltd')).toBe(false);
  });

  it('excludes every set when the viewer has no organization', () => {
    expect(isAssuranceSetOwnedOrInitiatedByOrganization(base, undefined)).toBe(false);
  });
});

describe('assurance set client', () => {
  it('seed sets never record a charterer that differs from the client', () => {
    const mismatched = useMapStore
      .getState()
      .assuranceSets.filter((s) => s.clientOrg && s.charterer && s.clientOrg !== s.charterer)
      .map((s) => s.id);
    expect(mismatched).toEqual([]);
  });
});
