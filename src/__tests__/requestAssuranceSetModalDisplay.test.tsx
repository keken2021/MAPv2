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

describe('RequestAssuranceSetModal Client Admin recipients', () => {
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

  it('lists only Client Admins of the other organizations, by name only', () => {
    renderModal();
    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;

    const optgroups = Array.from(select.querySelectorAll('optgroup'));
    expect(optgroups.some((og) => og.label === NORTHWIND_ORG)).toBe(true);

    const options = Array.from(select.options);
    const optionTexts = options.map((o) => o.textContent?.trim() ?? '');
    expect(options[0].textContent).toBe('Select a client admin');

    const okadaOption = options.find((o) => o.textContent?.trim() === 'T. Okada');
    expect(okadaOption).toBeDefined();
    expect(okadaOption?.textContent).not.toContain('Admin');
    expect(okadaOption?.textContent).not.toContain('—');

    // Submitter M. Chen and Administrator K. Osei are not listed
    expect(optionTexts).not.toContain('M. Chen');
    expect(optionTexts).not.toContain('K. Osei');
  });

  it('has no ask/invite toggle', () => {
    renderModal();
    expect(screen.queryByTestId('btn-toggle-request-direction')).toBeNull();
    expect(screen.queryByText(/Invite them to request a set/)).toBeNull();
  });

  it('enables roster objects only after a recipient is picked, from the recipient organization', () => {
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
    renderModal(getTestProject([ownerLink]));
    expect(screen.getByText('Choose a recipient first.')).toBeInTheDocument();

    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;
    const okadaOption = Array.from(select.options).find((o) => o.textContent?.trim() === 'T. Okada')!;
    fireEvent.change(select, { target: { value: okadaOption.value } });

    expect(screen.queryByText('Choose a recipient first.')).toBeNull();
    expect(screen.getByLabelText('LNGC Northwind Aurora · Vessel')).toBeInTheDocument();
    expect(screen.queryByLabelText('OilCo Master Barge · Vessel')).toBeNull();
  });

  it('contains no Requesting party or Responding party banner or text', () => {
    renderModal();
    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;
    const okadaOption = Array.from(select.options).find((o) => o.textContent?.trim() === 'T. Okada')!;
    fireEvent.change(select, { target: { value: okadaOption.value } });

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
