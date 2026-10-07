import { describe, expect, it } from 'vitest';
import {
  getAssuranceWizardProjectOptions,
  projectToAssuranceProjectScope,
  resolveProjectPrimaryAssetIds,
} from '../utils/projectHelpers';
import { EXISTING_PROJECTS } from '../utils/assuranceTemplates';
import { MOCK_PROJECTS } from '../store/projectMockData';
import { MOCK_USERS } from '../store/mockData';
import { useMapStore } from '../store/useMapStore';
import { Project } from '../types/project';

describe('assurance wizard project scope options', () => {
  it('includes live registry projects for vessel admin', () => {
    const options = getAssuranceWizardProjectOptions(
      MOCK_PROJECTS,
      'Administrator',
      MOCK_USERS,
      [],
    );

    expect(options.some((p) => p.id === 'MAP-PROJ-2026-MARINE-007')).toBe(true);
    expect(options.some((p) => p.id === 'MAP-PROJ-2026-MARINE-008')).toBe(true);
  });

  it('includes newly created projects after addProject', () => {
    const before = getAssuranceWizardProjectOptions(
      useMapStore.getState().projects,
      'Administrator',
      MOCK_USERS,
      useMapStore.getState().assuranceSets,
    ).length;

    const result = useMapStore.getState().addProject({
      name: 'Wizard Linked Test Project',
      projectType: 'Assurance Campaign',
      requestingOrganization: 'Northwind Marine Pty Ltd',
      clientOperator: 'Northwind Marine Pty Ltd',
      location: 'Perth Offshore Basin',
      description: 'Project created to verify assurance wizard dropdown wiring.',
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-06-01',
      operatorOrganization: 'Northwind Marine Pty Ltd',
      primaryVesselId: 'VESSEL-008',
      assetLinks: [],
    });

    expect(result.success).toBe(true);

    const after = getAssuranceWizardProjectOptions(
      useMapStore.getState().projects,
      'Administrator',
      MOCK_USERS,
      useMapStore.getState().assuranceSets,
    );

    expect(after.length).toBeGreaterThan(before);
    expect(after.some((p) => p.id === result.projectId)).toBe(true);
    expect(after.find((p) => p.id === result.projectId)?.name).toBe('Wizard Linked Test Project');
  });

  it('keeps static template catalog entries that are not in the registry', () => {
    const options = getAssuranceWizardProjectOptions(MOCK_PROJECTS, 'Administrator', MOCK_USERS, []);
    const gorgonTemplate = EXISTING_PROJECTS.find((p) => p.id === 'MAP-PROJ-2026-OFFSHORE-001');

    expect(gorgonTemplate).toBeDefined();
    expect(options.some((p) => p.id === gorgonTemplate!.id)).toBe(true);
  });

  it('derives primary asset ids from project asset links when explicit fields are absent', () => {
    const project: Project = {
      ...MOCK_PROJECTS[0],
      primaryVesselId: undefined,
      primaryCrewId: undefined,
      assetLinks: [
        {
          id: 'PAL-TEST',
          projectId: MOCK_PROJECTS[0].id,
          assetType: 'Vessel',
          assetId: 'VESSEL-008',
          assetName: 'MV Meridian Pioneer',
          providerOrganization: 'Meridian Marine Services Pty Ltd',
          assuranceSetId: 'AS-TEST',
          addedAt: '2026-01-01T00:00:00Z',
          addedByPersona: 'Administrator',
        },
      ],
    };

    expect(resolveProjectPrimaryAssetIds(project).primaryVesselId).toBe('VESSEL-008');
    expect(projectToAssuranceProjectScope(project).primaryVesselId).toBe('VESSEL-008');
  });
});
