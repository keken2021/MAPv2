import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DashboardView } from '../views/DashboardView';
import { useMapStore } from '../store/useMapStore';

describe('Role dashboards routing to SharedDashboardFrame (Task 5390)', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      currentHashView: 'dashboard',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: undefined,
    });
  });

  it('routes Administrator (Vessel Admin) to SharedDashboardFrame with vessel admin config', () => {
    useMapStore.setState({ activePersona: 'Administrator' });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('performance-measures-strip')).toBeNull();
    expect(screen.getByTestId('kpi-tile-vessels')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-average_readiness')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-assurance_sets')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-expiring_soon')).toBeInTheDocument();
  });

  it('routes Client Admin (C Admin) to SharedDashboardFrame with client performance config', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
    });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('performance-measures-strip')).toBeNull();
    expect(screen.getByTestId('kpi-tile-perf_on_time')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-perf_resubmissions')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-perf_cycle_time')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-perf_findings')).toBeInTheDocument();
  });

  it('routes Submitter to SharedDashboardFrame with submitter config', () => {
    useMapStore.setState({ activePersona: 'Submitter' });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-returned')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-missing')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-expiring')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-open_findings')).toBeInTheDocument();
  });

  it('routes Verifier to SharedDashboardFrame with verifier config', () => {
    useMapStore.setState({ activePersona: 'Verifier' });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-escalated')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-due_this_week')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-resubmitted')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-in_queue')).toBeInTheDocument();
  });

  it('routes Inspector to SharedDashboardFrame with inspector config', () => {
    useMapStore.setState({ activePersona: 'Inspector' });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-reports_overdue')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-reinspections')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-next_7_days')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-fixes_to_check')).toBeInTheDocument();
  });

  it('routes Approver to SharedDashboardFrame with approver config', () => {
    useMapStore.setState({ activePersona: 'Approver' });
    render(<DashboardView />);

    expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-ready_to_decide')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-with_open_findings')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-waiting_over_5')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tile-approved_this_month')).toBeInTheDocument();
  });

  it('renders Needs your action and Recent activity across all 6 personas', () => {
    const roles = ['Administrator', 'C Admin', 'Submitter', 'Verifier', 'Inspector', 'Approver'] as const;

    for (const role of roles) {
      useMapStore.setState({ activePersona: role });
      const { unmount } = render(<DashboardView />);

      expect(screen.getByTestId('shared-dashboard-frame')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('needs-your-action-section')).toBeInTheDocument();
      expect(screen.getByTestId('recent-activity-section')).toBeInTheDocument();

      unmount();
    }
  });
});
