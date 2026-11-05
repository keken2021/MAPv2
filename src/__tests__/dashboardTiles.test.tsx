import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DashboardView } from '../views/DashboardView';
import { DocumentLibraryView } from '../views/DocumentLibraryView';

const tileLabels = () =>
  screen
    .getAllByRole('button')
    .filter((b) => /View →$/.test(b.textContent?.trim() || ''))
    .map((b) => (b.textContent || '').replace(/^\d+/, '').replace(/View →$/, '').trim());

describe('Dashboard KPI tilesSuite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    sessionStorage.clear();
    delete (window as any).__MAP_DOC_TAB_PRESELECT;
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: undefined,
      isAuthenticated: true,
      currentHashView: 'dashboard',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preselects expiring soon tab when DocumentLibraryView opens from expiring tile', () => {
    sessionStorage.setItem('map_doc_tab_preselect', 'Expiring < 6 Mos');
    render(<DocumentLibraryView />);

    const expiringTab = screen.getByRole('tab', { name: /expiring soon/i });
    expect(expiringTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the Administrator tiles in the shared frame, with no tables', () => {
    render(<DashboardView />);
    expect(tileLabels()).toEqual(['Sets needing people', 'Overdue', 'Due this week', 'Open findings']);
    expect(screen.getByText('Needs your action')).toBeInTheDocument();
    expect(screen.queryAllByRole('table')).toHaveLength(0);
  });

  it('shows the Submitter tiles in the shared frame, with no tables', () => {
    useMapStore.setState({ activePersona: 'Submitter' });
    render(<DashboardView />);
    expect(tileLabels()).toEqual(['Returned', 'Missing', 'Expiring in 30 days', 'Open findings']);
    expect(screen.queryAllByRole('table')).toHaveLength(0);
  });
});
