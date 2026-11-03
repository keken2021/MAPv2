/*
  file summary: asserts vessel detail Management list and ownership via activeDemoOrganization (audit 5319).
  responsibilities: C Admin sees one row per organization with View vessels; Edit follows demo-org ownership.
  role in system: covers VesselDetailView Management column after accordion/fleet-card removal.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

describe('vessel detail management list and ownership', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
    });
  });

  it('shows one Management row per organization with View vessels for C Admin', () => {
    render(<VesselDetailView vesselId="VESSEL-011" />);

    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Southern Basin Energy Pty Ltd')).toBeInTheDocument();
    expect(screen.getByText('Registered Owner · ISM Manager · Ship Manager')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view vessels/i })).toBeInTheDocument();
    expect(screen.getByText('marine@southernbasin.com.au')).toBeInTheDocument();
    expect(screen.getAllByText(/Date of effect/).length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText('Show All Details')).toBeNull();
    expect(screen.queryByText('Other Vessels')).toBeNull();
  });

  it('treats the vessel as owned when activeDemoOrganization matches', () => {
    render(<VesselDetailView vesselId="VESSEL-011" />);
    expect(screen.getByRole('button', { name: /edit information/i })).toBeInTheDocument();
  });

  it('does not treat the vessel as owned when activeDemoOrganization does not match', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    expect(screen.queryByRole('button', { name: /edit information/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /update status/i })).toBeNull();
  });
});
