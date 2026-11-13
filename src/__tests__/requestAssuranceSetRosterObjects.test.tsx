import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RequestAssuranceSetModal } from '../components/modals/RequestAssuranceSetModal';
import { useMapStore } from '../store/useMapStore';
import { NORTHWIND_ORG, OIL_CO_LNG_PROJECT_ID, OIL_CO_ORG } from '../store/oilCoLngPilotMockData';
import { getRequestRosterObjects } from '../utils/assuranceRequestHelpers';
import type { ProjectAssetLink } from '../types/project';

const link = (assetId: string, assetType: ProjectAssetLink['assetType'], providerOrganization: string): ProjectAssetLink => ({
  id: `PAL-${assetId}-${providerOrganization}`,
  projectId: 'P1',
  assetType,
  assetId,
  assetName: `Asset ${assetId}`,
  providerOrganization,
  assuranceSetId: '',
  addedAt: '',
  addedByPersona: 'C Admin',
});

describe('getRequestRosterObjects', () => {
  const project = {
    assetLinks: [
      link('V1', 'Vessel', 'Vendor Co'),
      link('C1', 'Crew', 'Vendor Co'),
      link('V1', 'Vessel', 'Vendor Co'),
      link('V2', 'Vessel', 'Other Co'),
      link('E1', 'Equipment', 'Vendor Co Ltd'),
    ],
  };

  it("lists only the recipient organization's roster objects, once each", () => {
    expect(getRequestRosterObjects(project, 'Vendor Co').map((o) => o.assetId)).toEqual(['V1', 'C1']);
  });

  it('lists nothing before a recipient is chosen', () => {
    expect(getRequestRosterObjects(project, undefined)).toEqual([]);
    expect(getRequestRosterObjects(project, '  ')).toEqual([]);
  });
});

const initialState = useMapStore.getState();

describe('Request Assurance Set modal: recipients and roster objects', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
  });

  const renderModal = () => {
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    render(<RequestAssuranceSetModal isOpen={true} onClose={vi.fn()} project={project} onSuccess={vi.fn()} />);
  };

  const recipientSelect = () => screen.getByLabelText(/Recipient/) as HTMLSelectElement;

  it('has no Scope field and lists only Client Admins of the other parties', () => {
    renderModal();
    expect(screen.queryByText('Scope (optional)')).toBeNull();
    const select = recipientSelect();
    const optgroups = Array.from(select.querySelectorAll('optgroup'));
    expect(optgroups.some((og) => og.label === NORTHWIND_ORG)).toBe(true);

    const options = Array.from(select.options).map((o) => o.textContent ?? '');
    expect(options.some((text) => text === 'T. Okada')).toBe(true);
    expect(options.some((text) => text.includes('—'))).toBe(false);
    expect(options.some((text) => text.includes(OIL_CO_ORG))).toBe(false);
    expect(options.some((text) => text === 'M. Chen')).toBe(false);
    expect(options.some((text) => text === 'K. Osei')).toBe(false);
  });

  it('keeps the object picker disabled until a recipient is chosen, then lists that party objects', () => {
    renderModal();
    expect(screen.getByText('Choose a recipient first.')).toBeInTheDocument();
    const okada = Array.from(recipientSelect().options).find((o) => o.textContent === 'T. Okada')!;
    fireEvent.change(recipientSelect(), { target: { value: okada.value } });
    expect(screen.getByLabelText('LNGC Northwind Aurora · Vessel')).toBeInTheDocument();
    expect(screen.queryByLabelText('OSV Meridian Endeavour · Vessel')).toBeNull();
  });

  it('clears picked objects when the recipient changes', () => {
    const tempUser = {
      id: 'USR-TEST-CADMIN-2',
      name: 'Second Client Admin',
      email: 'cadmin2@example.com',
      roles: ['C Admin' as const],
      userType: 'Organization' as const,
      organization: 'Meridian Shipyards',
      departmentOrScope: 'Administration',
      status: 'Active' as const,
      lastActive: '2026-11-12 00:00 UTC',
    };
    useMapStore.setState({ users: [...useMapStore.getState().users, tempUser] });

    renderModal();
    const options = Array.from(recipientSelect().options).filter((o) => o.value);
    const okada = options.find((o) => o.textContent === 'T. Okada')!;
    const other = options.find((o) => o.value !== okada.value)!;
    fireEvent.change(recipientSelect(), { target: { value: okada.value } });
    fireEvent.click(screen.getByLabelText('LNGC Northwind Aurora · Vessel'));
    fireEvent.change(recipientSelect(), { target: { value: other.value } });
    fireEvent.change(recipientSelect(), { target: { value: okada.value } });
    expect((screen.getByLabelText('LNGC Northwind Aurora · Vessel') as HTMLInputElement).checked).toBe(false);
  });

  it('sends the picked roster objects with the request', () => {
    renderModal();
    const okada = Array.from(recipientSelect().options).find((o) => o.textContent === 'T. Okada')!;
    fireEvent.change(recipientSelect(), { target: { value: okada.value } });
    fireEvent.click(screen.getByLabelText('LNGC Northwind Aurora · Vessel'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));
    const sent = useMapStore
      .getState()
      .notifications.find((n) => n.type === 'assurance_set_request' && n.recipientUserId === okada.value);
    expect(sent?.request?.suggestedAssets).toEqual([
      { assetId: 'VESSEL-013', assetType: 'Vessel', assetName: 'LNGC Northwind Aurora' },
    ]);
  });

  it('shows the empty message when the recipient organization provides nothing on the roster', () => {
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    render(
      <RequestAssuranceSetModal isOpen={true} onClose={vi.fn()} project={{ ...project, assetLinks: [] }} onSuccess={vi.fn()} />,
    );
    const okada = Array.from(recipientSelect().options).find((o) => o.textContent === 'T. Okada')!;
    fireEvent.change(recipientSelect(), { target: { value: okada.value } });
    expect(screen.getByText('No objects from this party on the project roster.')).toBeInTheDocument();
  });

  it('shows the empty recipient message when no other organization has a Client Admin', () => {
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={{
          ...project,
          contractParties: [{ organization: OIL_CO_ORG, group: 'Client', chainRole: 'client' }],
          invitedOrganizations: [OIL_CO_ORG],
        }}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByText("No client admins in this project's other organizations.")).toBeInTheDocument();
  });
});
