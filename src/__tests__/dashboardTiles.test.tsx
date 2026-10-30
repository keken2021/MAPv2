import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DashboardView } from '../views/DashboardView';
import { DocumentLibraryView } from '../views/DocumentLibraryView';

describe('Dashboard KPI tilesSuite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__MAP_DOC_TAB_PRESELECT;
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Oceanic Marine Services',
      isAuthenticated: true,
      currentHashView: 'dashboard',
    });
  });

  describe('Administrator dashboard', () => {
    it('renders focusable tiles with accessible names that navigate to filtered views', () => {
      const setCurrentHashView = vi.fn();
      useMapStore.setState({ setCurrentHashView });

      render(<DashboardView />);

      const vesselsBtn = screen.getByRole('button', { name: /vessels in your fleet/i });
      expect(vesselsBtn).toBeInTheDocument();
      fireEvent.click(vesselsBtn);
      expect(setCurrentHashView).toHaveBeenCalledWith('vessels');

      const assuranceBtn = screen.getByRole('button', { name: /in progress assurance sets/i });
      expect(assuranceBtn).toBeInTheDocument();
      fireEvent.click(assuranceBtn);
      expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets');

      const expiringBtn = screen.getByRole('button', { name: /documents expiring soon/i });
      expect(expiringBtn).toBeInTheDocument();
      fireEvent.click(expiringBtn);
      expect(setCurrentHashView).toHaveBeenCalledWith('documents');
      expect(sessionStorage.getItem('map_doc_tab_preselect')).toBe('Expiring < 6 Mos');
    });

    it('preselects expiring soon tab when DocumentLibraryView opens from expiring tile', () => {
      sessionStorage.setItem('map_doc_tab_preselect', 'Expiring < 6 Mos');
      render(<DocumentLibraryView />);

      const expiringTab = screen.getByRole('tab', { name: /expiring soon/i });
      expect(expiringTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Submitter dashboard', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'Submitter',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: undefined,
      });
    });

    it('replaces verified tile with due this week and has accessible focusable buttons', () => {
      render(<DashboardView />);

      expect(screen.queryByText('Verified documents')).toBeNull();
      expect(screen.getByText('Due this week')).toBeInTheDocument();
      expect(screen.getByText('Sets with a requirement due in 7 days')).toBeInTheDocument();

      const awaitingBtn = screen.getByRole('button', { name: /documents awaiting upload/i });
      expect(awaitingBtn).toBeInTheDocument();
      expect(awaitingBtn).toHaveClass('map-kpi-clickable');

      const returnedBtn = screen.getByRole('button', { name: /documents returned for correction/i });
      expect(returnedBtn).toBeInTheDocument();

      const dueThisWeekBtn = screen.getByRole('button', { name: /assurance sets due this week/i });
      expect(dueThisWeekBtn).toBeInTheDocument();
    });

    it('filters submitter assurance sets table on tile clicks and resets with assurance sets tile', () => {
      render(<DashboardView />);

      expect(screen.getByText('Showing 1-10 of 13')).toBeInTheDocument();

      const awaitingBtn = screen.getByRole('button', { name: /documents awaiting upload/i });
      fireEvent.click(awaitingBtn);
      expect(screen.getByText('Filter: Awaiting upload')).toBeInTheDocument();

      const returnedBtn = screen.getByRole('button', { name: /documents returned for correction/i });
      fireEvent.click(returnedBtn);
      expect(screen.getByText('Filter: Returned for correction')).toBeInTheDocument();

      const dueThisWeekBtn = screen.getByRole('button', { name: /assurance sets due this week/i });
      fireEvent.click(dueThisWeekBtn);
      expect(screen.getByText('Filter: Due this week')).toBeInTheDocument();

      const allSetsBtn = screen.getByRole('button', { name: /assigned assurance sets/i });
      fireEvent.click(allSetsBtn);
      expect(screen.queryByText('Filter: Due this week')).toBeNull();
      expect(screen.getByText('Showing 1-10 of 13')).toBeInTheDocument();
    });
  });

  describe('Administrator as client (C Admin) dashboard', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Woodside Energy Ltd',
      });
    });

    it('filters C Admin assurance sets table on in progress and approved tile clicks', () => {
      render(<DashboardView />);

      const inProgressBtn = screen.getByRole('button', { name: /in progress assurance sets/i });
      fireEvent.click(inProgressBtn);
      expect(screen.getByText('Filter: In progress')).toBeInTheDocument();

      const approvedBtn = screen.getByRole('button', { name: /approved assurance sets/i });
      fireEvent.click(approvedBtn);
      expect(screen.getByText('Filter: Approved')).toBeInTheDocument();

      const allSetsBtn = screen.getByRole('button', { name: /open \d+ assurance sets/i });
      fireEvent.click(allSetsBtn);
      expect(screen.queryByText('Filter: Approved')).toBeNull();
    });
  });
});
