import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DashboardView } from '../views/DashboardView';
import { DocumentLibraryView } from '../views/DocumentLibraryView';

describe('Dashboard KPI tilesSuite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    sessionStorage.clear();
    delete (window as any).__MAP_DOC_TAB_PRESELECT;
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Oceanic Marine Services',
      isAuthenticated: true,
      currentHashView: 'dashboard',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it('renders Needs action card with at most 8 rows sorted by date, and counts agree with Documents tab', () => {
      const setCurrentHashView = vi.fn();
      useMapStore.setState({
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        setCurrentHashView,
      });

      const { unmount } = render(<DashboardView />);

      // Needs action card exists
      expect(screen.getByText('Needs action')).toBeInTheDocument();

      // Check rows in Needs action table
      const needsActionTable = screen.getByRole('table', { name: /needs action items/i });
      expect(needsActionTable).toBeInTheDocument();

      const tbody = needsActionTable.querySelector('tbody');
      const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(8);
      expect(rows.length).toBe(8);

      // Verify rows are sorted chronologically by date (most urgent first)
      const timestamps = rows.map((r) => Number(r.getAttribute('data-date-ms')));
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
      }

      // Verify column headers: Type, Item, Object, Due / Expiry, Status, Actions
      const headers = Array.from(needsActionTable.querySelectorAll('th')).map((th) => th.textContent?.trim());
      expect(headers).toEqual(['Type', 'Item', 'Object', 'Due / Expiry', 'Status', 'Actions']);

      // Verify all three kinds of rows are represented as Type badges
      expect(screen.getAllByText('Certificate').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Document').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CAPA').length).toBeGreaterThan(0);

      // Verify kindLabel is dropped from Item cell (shows title only)
      expect(screen.queryByText('Expiring Certificate')).toBeNull();
      expect(screen.queryByText('Overdue CAPA')).toBeNull();
      rows.forEach((r) => {
        const itemCell = r.querySelectorAll('td')[1];
        expect(itemCell.querySelector('.small.text-muted')).toBeNull();
      });

      // Verify Vessels table is removed from Administrator dashboard
      expect(screen.queryByRole('table', { name: /^vessels$/i })).toBeNull();
      expect(screen.queryByText('Operating Status')).toBeNull();
      expect(screen.queryByText('Class Society')).toBeNull();

      // Verify row click opens detail
      fireEvent.click(rows[0]);
      expect(setCurrentHashView).toHaveBeenCalled();

      // Expiring soon tile on dashboard shows 2
      const expiringBtn = screen.getByRole('button', { name: /documents expiring soon/i });
      expect(expiringBtn).toHaveTextContent('2');

      // Unmount and render DocumentLibraryView to verify Expiring Soon tab count agrees
      unmount();

      render(<DocumentLibraryView />);
      const expiringTab = screen.getByRole('tab', { name: /expiring soon/i });
      expect(expiringTab).toHaveTextContent('2');
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

      expect(screen.getByText(/Showing 1-10 of \d+/)).toBeInTheDocument();

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
      expect(screen.getByText(/Showing 1-10 of \d+/)).toBeInTheDocument();
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

    it('filters client assurance sets table by People, Plant and Process pills while keeping tiles unchanged', () => {
      const mockSetPeople = {
        id: 'AS-TEST-PEOPLE',
        title: 'Crew Competency Campaign',
        initiatorOrg: 'Woodside Energy Ltd',
        stage: 'Draft',
        tags: ['People' as const],
        requirements: [{ category: 'People' }],
      };
      const mockSetPlant = {
        id: 'AS-TEST-PLANT',
        title: 'Hull Inspection Campaign',
        initiatorOrg: 'Woodside Energy Ltd',
        stage: 'Draft',
        tags: ['Plant' as const],
        requirements: [{ category: 'Plant' }],
      };

      useMapStore.setState({
        assuranceSets: [mockSetPeople, mockSetPlant] as any,
      });

      render(<DashboardView />);

      const allBtn = screen.getByRole('button', { name: 'All' });
      const peopleBtn = screen.getByRole('button', { name: 'People' });
      const plantBtn = screen.getByRole('button', { name: 'Plant' });
      const processBtn = screen.getByRole('button', { name: 'Process' });

      // Initially both sets are visible
      expect(screen.getByText('Crew Competency Campaign')).toBeInTheDocument();
      expect(screen.getByText('Hull Inspection Campaign')).toBeInTheDocument();

      const setsTile = screen.getByRole('button', { name: /open 2 assurance sets/i });
      expect(setsTile).toBeInTheDocument();

      // Click People pill -> only people set is visible
      fireEvent.click(peopleBtn);
      expect(screen.getByText('Crew Competency Campaign')).toBeInTheDocument();
      expect(screen.queryByText('Hull Inspection Campaign')).toBeNull();
      // Tile still shows 2
      expect(screen.getByRole('button', { name: /open 2 assurance sets/i })).toBeInTheDocument();

      // Click Plant pill -> only plant set is visible
      fireEvent.click(plantBtn);
      expect(screen.queryByText('Crew Competency Campaign')).toBeNull();
      expect(screen.getByText('Hull Inspection Campaign')).toBeInTheDocument();

      // Click Process pill -> empty state
      fireEvent.click(processBtn);
      expect(screen.queryByText('Crew Competency Campaign')).toBeNull();
      expect(screen.queryByText('Hull Inspection Campaign')).toBeNull();
      expect(screen.getByText('No assurance sets tagged Process found.')).toBeInTheDocument();

      // Click All pill -> restores both sets
      fireEvent.click(allBtn);
      expect(screen.getByText('Crew Competency Campaign')).toBeInTheDocument();
      expect(screen.getByText('Hull Inspection Campaign')).toBeInTheDocument();
    });
  });
});
