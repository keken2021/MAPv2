/*
  file summary: asserts vessel detail Overview datasheet section names after audit 5317.
  responsibilities: confirms Dimensions and tonnage, Class and insurance, and Machinery replace the old split / invented sections.
  role in system: covers VesselDetailView Information tab datasheet headers.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

describe('vessel detail overview datasheet sections', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('renders the renamed and merged datasheet section names', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);

    expect(screen.getByText('General Information')).toBeInTheDocument();
    expect(screen.getByText('Dimensions and tonnage')).toBeInTheDocument();
    expect(screen.getByText('Class and insurance')).toBeInTheDocument();
    expect(screen.getByText('Machinery')).toBeInTheDocument();

    expect(screen.queryByText('Dimensions')).toBeNull();
    expect(screen.queryByText('Classification')).toBeNull();
    expect(screen.queryByText('Engine Room')).toBeNull();
    expect(screen.queryByText('Capacity & Equipment')).toBeNull();
  });
});
