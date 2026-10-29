import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DashboardView } from '../views/DashboardView';

describe('Submitter Dashboard per-person filtering', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: undefined,
      isAuthenticated: true,
    });
  });

  it('shows 13 sets instead of 22 for Northwind Submitter M. Chen', () => {
    render(<DashboardView />);

    const assignedKpiLabel = screen.getByText('Assigned to you');
    const kpiCard = assignedKpiLabel.closest('.map-kpi-card');
    expect(kpiCard).not.toBeNull();
    expect(kpiCard?.textContent).toContain('13');
    expect(kpiCard?.textContent).not.toContain('22');

    expect(screen.getByText('Showing 1-10 of 13')).toBeInTheDocument();
  });

  it('keeps organization sets for C Admin', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
    });

    render(<DashboardView />);
    expect(screen.queryByText('Assigned to you')).toBeNull();
  });
});
