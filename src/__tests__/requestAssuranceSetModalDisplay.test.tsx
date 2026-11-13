import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RequestAssuranceSetModal } from '../components/modals/RequestAssuranceSetModal';
import { useMapStore } from '../store/useMapStore';
import {
  NORTHWIND_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
} from '../store/oilCoLngPilotMockData';
import type { Project, ProjectAssetLink } from '../types/project';

describe('RequestAssuranceSetModal recipient simplification and direction', () => {
  const initialStore = useMapStore.getState();

  beforeEach(() => {
    useMapStore.setState(initialStore, true);
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
  });

  const getTestProject = (extraAssetLinks: ProjectAssetLink[] = []): Project => {
    const base = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    return {
      ...base,
      assetLinks: [...(base.assetLinks ?? []), ...extraAssetLinks],
    };
  };

  const renderModal = (project = getTestProject()) => {
    return render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={project}
        onSuccess={vi.fn()}
      />,
    );
  };

  it('by default only Submitters are listed, by name only with no role tags', () => {
    renderModal();
    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;

    // Check optgroup grouping by organization
    const optgroups = Array.from(select.querySelectorAll('optgroup'));
    expect(optgroups.some((og) => og.label === NORTHWIND_ORG)).toBe(true);

    const options = Array.from(select.options);
    const optionTexts = options.map((o) => o.textContent?.trim() ?? '');

    // Placeholder
    expect(options[0].textContent).toBe('Select a submitter');

    // Submitter M. Chen is present with NAME ONLY
    expect(optionTexts).toContain('M. Chen');
    const chenOption = options.find((o) => o.textContent?.trim() === 'M. Chen');
    expect(chenOption).toBeDefined();
    // Strictly no role tags or dash suffixes in option text
    expect(chenOption?.textContent).not.toContain('Submitter');
    expect(chenOption?.textContent).not.toContain('Responding party');
    expect(chenOption?.textContent).not.toContain('—');

    // Administrator K. Osei is NOT in the ask list
    expect(optionTexts).not.toContain('K. Osei');
  });

  it('clicking the link lists Administrators, changes placeholder, and clears the pick', () => {
    renderModal();
    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;

    // Pick a submitter
    const chenOption = Array.from(select.options).find((o) => o.textContent?.trim() === 'M. Chen')!;
    fireEvent.change(select, { target: { value: chenOption.value } });
    expect(select.value).toBe(chenOption.value);

    // Direction link
    const toggleBtn = screen.getByTestId('btn-toggle-request-direction');
    expect(toggleBtn).toHaveTextContent('Invite them to request a set from you instead');

    // Switch direction to invite
    fireEvent.click(toggleBtn);

    // Selection is cleared
    expect(select.value).toBe('');
    expect(toggleBtn).toHaveTextContent('Ask them for a set instead');
    expect(select.options[0].textContent).toBe('Select an administrator');

    // Now lists Administrators (e.g. K. Osei, T. Okada) by name only
    const inviteOptionTexts = Array.from(select.options).map((o) => o.textContent?.trim() ?? '');
    expect(inviteOptionTexts).toContain('K. Osei');
    expect(inviteOptionTexts).not.toContain('M. Chen');

    const oseiOption = Array.from(select.options).find((o) => o.textContent?.trim() === 'K. Osei');
    expect(oseiOption?.textContent).not.toContain('Administrator');
    expect(oseiOption?.textContent).not.toContain('Requesting party');
    expect(oseiOption?.textContent).not.toContain('—');
  });

  it('invite mode suggests the owner organization roster objects available before a recipient is picked', () => {
    const ownerLink: ProjectAssetLink = {
      id: 'PAL-OILCO-TEST-1',
      projectId: OIL_CO_LNG_PROJECT_ID,
      assetType: 'Vessel',
      assetId: 'VESSEL-OILCO-1',
      assetName: 'OilCo Master Barge',
      providerOrganization: OIL_CO_ORG,
      assuranceSetId: '',
      addedAt: '2026-10-01',
      addedByPersona: 'C Admin',
    };
    const project = getTestProject([ownerLink]);
    renderModal(project);

    // In default ask mode before recipient pick: picker is disabled
    expect(screen.getByText('Choose a recipient first.')).toBeInTheDocument();

    // Switch to invite mode
    const toggleBtn = screen.getByTestId('btn-toggle-request-direction');
    fireEvent.click(toggleBtn);

    // In invite mode: owner objects are available immediately before any recipient is chosen
    expect(screen.queryByText('Choose a recipient first.')).toBeNull();
    expect(screen.getByLabelText('OilCo Master Barge · Vessel')).toBeInTheDocument();
  });

  it('contains no Requesting party or Responding party banner or text', () => {
    renderModal();

    expect(screen.queryByTestId('requesting-party-banner')).toBeNull();
    expect(screen.queryByText(/Requesting party/i)).toBeNull();
    expect(screen.queryByText(/Responding party/i)).toBeNull();

    // Even after switching direction and picking an administrator
    const toggleBtn = screen.getByTestId('btn-toggle-request-direction');
    fireEvent.click(toggleBtn);

    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;
    const oseiOption = Array.from(select.options).find((o) => o.textContent?.trim() === 'K. Osei')!;
    fireEvent.change(select, { target: { value: oseiOption.value } });

    expect(screen.queryByTestId('requesting-party-banner')).toBeNull();
    expect(screen.queryByText(/Requesting party/i)).toBeNull();
    expect(screen.queryByText(/Responding party/i)).toBeNull();
  });

  it('shows "Don\'t see the organization? Edit participating organizations" under field for owner, hides for non-owner', () => {
    // Owner (Oil Company) sees it under the field
    const { unmount } = renderModal();
    expect(screen.getByText(/Don't see the organization\?/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-edit-participating-orgs-from-modal')).toBeInTheDocument();
    unmount();

    // Non-owner Administrator (Northwind) does NOT see it
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: NORTHWIND_ORG,
      activeSessionUserId: 'USR-101',
    });
    renderModal();

    expect(screen.queryByText(/Don't see the organization\?/)).toBeNull();
    expect(screen.queryByTestId('btn-edit-participating-orgs-from-modal')).toBeNull();
  });
});
