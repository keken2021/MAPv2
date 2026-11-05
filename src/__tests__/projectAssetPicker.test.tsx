/*
  file summary: ProjectAssetPicker shared by create-project step 3 and ProjectAddAssetModal.
  responsibilities: filter helpers; picker mounts in CreateProjectView and ProjectAddAssetModal.
  role in system: automated coverage for Task 5433.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  filterProjectPickerAssets,
  ProjectAssetPicker,
} from '../components/common/ProjectAssetPicker';
import { ProjectAddAssetModal } from '../components/modals/ProjectAddAssetModal';
import { CreateProjectView } from '../views/CreateProjectView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_VESSELS, MOCK_DOCUMENTS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { Project } from '../types/project';
import type { LinkableProjectAsset } from '../utils/projectHelpers';

const initialState = useMapStore.getState();

const sampleAssets: LinkableProjectAsset[] = [
  {
    assetType: 'Vessel',
    assetId: 'V-1',
    assetName: 'Alpha Tug',
    providerOrganization: 'AquaClean Marine Services Pty Ltd',
    eligibleAssuranceSets: [{ id: 'AS-1', title: 'Set One' } as LinkableProjectAsset['eligibleAssuranceSets'][number]],
  },
  {
    assetType: 'Crew',
    assetId: 'C-1',
    assetName: 'Beta Crew',
    providerOrganization: 'AquaClean Marine Services Pty Ltd',
    eligibleAssuranceSets: [{ id: 'AS-2', title: 'Set Two' } as LinkableProjectAsset['eligibleAssuranceSets'][number]],
  },
];

const sampleProject = {
  id: 'MAP-PROJ-TEST-5433',
  name: 'Asset Picker Test',
  clientOperator: 'Southern Basin Energy Pty Ltd',
  description: 'Shared picker fixture',
  requestingOrganization: 'Southern Basin Energy Pty Ltd',
  operatorOrganization: 'Southern Basin Energy Pty Ltd',
  location: 'Browse Basin',
  projectType: 'Mixed / Composite',
  status: 'Composing',
  charterWindowStart: '2026-11-01',
  charterWindowEnd: '2027-03-01',
  assetLinks: [],
} as unknown as Project;

describe('project asset picker', () => {
  afterEach(cleanup);

  it('filters by type and search text', () => {
    expect(filterProjectPickerAssets(sampleAssets, 'Vessel', '').map((a) => a.assetId)).toEqual(['V-1']);
    expect(filterProjectPickerAssets(sampleAssets, 'All', 'beta').map((a) => a.assetId)).toEqual(['C-1']);
  });

  it('renders CountTabs, ListToolbar search, and rows for compact variant', () => {
    const onAdd = vi.fn();
    render(
      <ProjectAssetPicker
        assets={sampleAssets}
        showCounts={false}
        onAdd={(asset, setId) => onAdd(asset.assetId, setId)}
      />,
    );

    expect(screen.getByTestId('project-asset-picker')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /asset type filter/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^vessels/i }));
    expect(screen.getAllByTestId('project-asset-picker-row')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('V-1', 'AS-1');
  });
});

describe('project asset picker call sites', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'C Admin',
        isAuthenticated: true,
        vessels: MOCK_VESSELS,
        equipment: MOCK_EQUIPMENT,
        crew: MOCK_CREW,
        documents: MOCK_DOCUMENTS,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('shows the shared picker on create-project step 3', () => {
    render(<CreateProjectView />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Choose Assurance Set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByTestId('project-asset-picker')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^vessels/i })).toBeInTheDocument();
  });

  it('shows search and tab counts in ProjectAddAssetModal catalog', () => {
    render(<ProjectAddAssetModal isOpen project={sampleProject} onClose={() => undefined} />);
    expect(screen.getByTestId('project-asset-picker')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /asset type filter/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search assets...'), { target: { value: 'zzz-no-match' } });
    expect(screen.queryByTestId('project-asset-picker-row')).toBeNull();
  });
});
