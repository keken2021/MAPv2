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

  it('renders dashboard for Northwind Submitter without org-wide subtitle', () => {
    render(<DashboardView />);
    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.queryByText('22 assigned assurance sets')).toBeNull();
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
