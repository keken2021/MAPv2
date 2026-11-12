/*
  file summary: Task 5485 — non-owners see only the eight A6 public vessel fields.
  responsibilities: asserts owner datasheet stays full; non-owner overview shows public profile only and hides P&I / DOC / edit / upload.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

const initialState = useMapStore.getState();

describe('Vessel detail A6 public fields (Task 5485)', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      },
      true,
    );
  });

  it('shows the full datasheet to the owning organization', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);

    expect(screen.getByText('Vessel Datasheet')).toBeInTheDocument();
    expect(screen.getByText('General Information')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Class and insurance'));
    expect(screen.getByText('P&I Club')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Information|Update Status/i })).toBeInTheDocument();
    expect(screen.queryByTestId('vessel-public-a6-profile')).toBeNull();
  });

  it('limits non-owners to the eight A6 fields with no P&I or DOC details', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
      activeSessionUserId: 'USR-201',
    });

    render(<VesselDetailView vesselId="VESSEL-001" />);

    expect(screen.getByTestId('vessel-public-a6-profile')).toBeInTheDocument();
    expect(screen.getByText('Public vessel profile')).toBeInTheDocument();
    expect(screen.getByText('Vessel Name')).toBeInTheDocument();
    expect(screen.getByText('IMO Number')).toBeInTheDocument();
    expect(screen.getByText('Flag State')).toBeInTheDocument();
    expect(screen.getByText('Vessel Type')).toBeInTheDocument();
    expect(screen.getByText('Classification Society')).toBeInTheDocument();
    expect(screen.getByText('Year of Build')).toBeInTheDocument();
    expect(screen.getByText('Registered Owner Organization')).toBeInTheDocument();
    expect(screen.getByText('Object Verification Status')).toBeInTheDocument();

    expect(screen.queryByText('P&I Club')).toBeNull();
    expect(screen.queryByText('DOC Number')).toBeNull();
    expect(screen.queryByText('Technical Manager')).toBeNull();
    expect(screen.queryByText('Policy Number')).toBeNull();
    expect(screen.queryByText('General Information')).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit Information|Update Status/i })).toBeNull();
  });
});
