/*
  file summary: asserts marketplace and project-add-asset modals use section Tabs (Task 5453).
  responsibilities: tab switch coverage for modal section bars.
  role in system: automated coverage for modal section tab migration.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MarketplaceDetailModal } from '../components/marketplace/MarketplaceDetailModal';
import { ProjectAddAssetModal } from '../components/modals/ProjectAddAssetModal';
import { useMapStore } from '../store/useMapStore';
import { getMarketplaceItems } from '../utils/marketplaceHelpers';

describe('modal section Tabs', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('switches marketplace detail tabs with aria-selected', () => {
    const state = useMapStore.getState();
    const items = getMarketplaceItems(
      state.vessels,
      state.equipment,
      state.activePersona,
      state.users,
      state.crew,
      state.assuranceSets,
      state.documents,
    );
    render(<MarketplaceDetailModal item={items[0]} isOpen onClose={() => undefined} />);

    const tablist = screen.getByRole('tablist', { name: /marketplace offering tabs/i });
    expect(within(tablist).getByRole('tab', { name: /Specifications/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(within(tablist).getByRole('tab', { name: /Compliance/i }));
    expect(within(tablist).getByRole('tab', { name: /Compliance/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps ProjectAddAssetModal free of Bootstrap nav-tabs markup', () => {
    const project = useMapStore.getState().projects[0];
    const { container } = render(
      <ProjectAddAssetModal isOpen project={project} onClose={() => undefined} />,
    );
    expect(screen.getByTestId('project-asset-picker')).toBeInTheDocument();
    expect(container.querySelector('.nav-tabs')).toBeNull();
  });
});
