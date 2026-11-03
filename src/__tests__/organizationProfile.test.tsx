/*
  file summary: asserts Organization profile Settings edit rights and marketplace contact grounding (audit 5320).
  responsibilities: Administrator edits own org; other roles read-only; contacts never invented from a company name.
  role in system: covers OrganizationProfileView, organizationProfileStore, and marketplaceHelpers contact wiring.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { useOrganizationProfileStore } from '../store/organizationProfileStore';
import { OrganizationProfileView } from '../views/OrganizationProfileView';
import { getMarketplaceItems } from '../utils/marketplaceHelpers';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { ORGANIZATION_FIELD_NOT_RECORDED } from '../types/organization';
import { MOCK_ORGANIZATION_PROFILES } from '../store/organizationMockData';

describe('organization profile', () => {
  beforeEach(() => {
    useOrganizationProfileStore.setState({
      profiles: MOCK_ORGANIZATION_PROFILES.map((p) => ({ ...p })),
    });
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
    });
  });

  it('lets the Administrator edit their own organization profile', () => {
    render(<OrganizationProfileView />);

    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));

    const email = screen.getByLabelText(/^Email$/i) as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'fleet.desk@northwindmarine.com.au' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(useOrganizationProfileStore.getState().getProfileByName('Northwind Marine Pty Ltd')?.email).toBe(
      'fleet.desk@northwindmarine.com.au',
    );
    expect(screen.getByText('fleet.desk@northwindmarine.com.au')).toBeInTheDocument();
  });

  it('is read-only for a non-Administrator role', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
    });
    render(<OrganizationProfileView />);

    expect(screen.queryByRole('button', { name: /edit profile/i })).toBeNull();
    expect(screen.getByText(/read-only for your role/i)).toBeInTheDocument();
    expect(screen.getByText('marine@southernbasin.com.au')).toBeInTheDocument();
  });

  it('shows Not recorded for empty organization contact fields', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Coastal Fuel Testing',
    });
    render(<OrganizationProfileView />);

    expect(screen.getByText('lab@coastalfuel.example')).toBeInTheDocument();
    expect(screen.getAllByText(ORGANIZATION_FIELD_NOT_RECORDED).length).toBeGreaterThanOrEqual(3);
  });

  it('grounds marketplace contacts in organization profiles instead of invented addresses', () => {
    const items = getMarketplaceItems(
      MOCK_VESSELS,
      MOCK_EQUIPMENT,
      'C Admin',
      [{ roles: ['C Admin'], organization: 'Southern Basin Energy Pty Ltd' }],
      MOCK_CREW,
    );
    const meridian = items.find((item) => item.providerOrg === 'Meridian Marine Services Pty Ltd');
    expect(meridian).toBeTruthy();
    expect(meridian?.contact.email).toBe('chartering@meridianmarine.com.au');
    expect(meridian?.contact.phone).toBe('+61 8 9312 8800');
    expect(meridian?.contact.email).not.toMatch(/@maritimeprovider\.com\.au$/);

    const coastalItems = items.filter((item) => item.providerOrg === 'Coastal Fuel Testing');
    coastalItems.forEach((item) => {
      expect(item.contact.email).toBe('lab@coastalfuel.example');
      expect(item.contact.phone).toBe(ORGANIZATION_FIELD_NOT_RECORDED);
    });
  });
});
