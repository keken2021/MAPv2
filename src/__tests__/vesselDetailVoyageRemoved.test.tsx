/*
  file summary: asserts vessel detail no longer shows invented voyage UI (audit 5316).
  responsibilities: confirms Voyage / Arrival / track / speed-course text is absent on Information tab.
  role in system: covers VesselDetailView after voyage area removal.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

describe('vessel detail voyage area removed', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('shows no voyage text or invented track values on vessel detail', () => {
    const { container } = render(<VesselDetailView vesselId="VESSEL-001" />);

    expect(screen.queryByText('Voyage')).toBeNull();
    expect(screen.queryByText('Voyage History')).toBeNull();
    expect(screen.queryByText('Voyage Progress')).toBeNull();
    expect(screen.queryByText('Arrival Details')).toBeNull();
    expect(screen.queryByTitle('View voyage')).toBeNull();
    expect(screen.queryByTitle('View voyage history')).toBeNull();
    expect(screen.queryByTitle('Show all details')).toBeNull();
    expect(screen.queryByText(/m Draught/)).toBeNull();
    expect(screen.queryByText(/knots/i)).toBeNull();
    expect(screen.queryByText('Speed')).toBeNull();
    expect(screen.queryByText('Course')).toBeNull();
    expect(screen.queryByText('36° NNE')).toBeNull();
    expect(screen.queryByText('Actual Time of Departure')).toBeNull();
    expect(screen.queryByText('Estimated Time of Arrival')).toBeNull();
    expect(screen.queryByText('Distance Travelled:')).toBeNull();
    expect(container.querySelector('.map-voyage-track')).toBeNull();
  });
});

