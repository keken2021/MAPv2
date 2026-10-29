import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DashboardView } from '../views/DashboardView';
import { useMapStore } from '../store/useMapStore';
import { getFleetPerformanceSummary } from '../utils/readinessHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';

describe('Submitter Dashboard UI Declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      isAuthenticated: true,
    });
  });

  describe('Submitter Persona View', () => {
    it('removes 4 KPI cards and ensures Performance strip is the only block above the table', () => {
      const { container } = render(<DashboardView />);

      // Verify no KPI cards exist anywhere in the view
      expect(container.querySelector('.map-kpi-card')).toBeNull();

      // Verify Performance strip exists
      const perfStrip = container.querySelector('.map-card-custom.p-3');
      expect(perfStrip).not.toBeNull();
      expect(perfStrip?.textContent).toContain('PERFORMANCE');

      // Verify "Delivery metrics" badge is removed
      expect(perfStrip?.querySelector('.badge')).toBeNull();
      expect(screen.queryByText(/delivery metrics/i)).toBeNull();

      // Verify Performance strip is the only element in the root before the main row
      const rootChildren = container.firstElementChild?.children;
      expect(rootChildren).toBeDefined();
      expect(rootChildren?.length).toBeGreaterThanOrEqual(2);
      expect(rootChildren?.[0]).toBe(perfStrip);
    });

    it('ensures Performance strip values match getFleetPerformanceSummary calculation exactly', () => {
      render(<DashboardView />);

      const state = useMapStore.getState();
      const submitterSets = state.assuranceSets.filter((s) =>
        isAssuranceSetAssignedToPersona(s, 'Submitter', state.activeDemoOrganization),
      );
      const visibleSets = submitterSets.length > 0 ? submitterSets : state.assuranceSets;
      const expectedSummary = getFleetPerformanceSummary(visibleSets, state.capaItems);

      const perfText = screen.getByText('PERFORMANCE').closest('.map-card-custom');
      expect(perfText).not.toBeNull();

      // Verify On-Time status text
      const expectedOnTimeText = `${expectedSummary.onTimeSets} / ${expectedSummary.totalSets} on time`;
      expect(perfText?.textContent).toContain(expectedOnTimeText);
      if (expectedSummary.lateSets > 0) {
        expect(perfText?.textContent).toContain(`(${expectedSummary.lateSets} late)`);
      }

      // Verify Open Findings text
      const expectedFindingsText = `${expectedSummary.openFindings} ${expectedSummary.openFindings === 1 ? 'finding' : 'findings'}`;
      expect(perfText?.textContent).toContain(expectedFindingsText);

      // Verify Remaining Work text
      const expectedRemainingText = `${expectedSummary.remainingTasks} ${expectedSummary.remainingTasks === 1 ? 'task' : 'tasks'} · ${expectedSummary.remainingCertificates} ${expectedSummary.remainingCertificates === 1 ? 'certificate' : 'certificates'}`;
      expect(perfText?.textContent).toContain(expectedRemainingText);
    });

    it('ensures the Submitter Assurance Sets table drops from 10 to 7 columns', () => {
      render(<DashboardView />);

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(7);

      const headerTexts = headers.map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
      expect(headerTexts).toEqual([
        expect.stringContaining('Set ID'),
        expect.stringContaining('Title'),
        expect.stringContaining('Stage'),
        expect.stringContaining('Readiness'),
        'On-Time',
        'Findings',
        'Actions',
      ]);
    });

    it('enforces at most 1 badge per row and plain cells for On-Time and Findings', () => {
      render(<DashboardView />);

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);

      rows.forEach((row) => {
        // At most 1 badge per row (only for Stage status)
        const badges = row.querySelectorAll('.badge');
        expect(badges.length).toBeLessThanOrEqual(1);

        // On-Time cell (index 4) has no .badge element
        const cells = row.querySelectorAll('td');
        expect(cells[4].querySelector('.badge')).toBeNull();

        // Findings cell (index 5) has no .badge element
        expect(cells[5].querySelector('.badge')).toBeNull();

        // Actions cell (index 6) has strictly 1 View action button
        const actionButtons = cells[6].querySelectorAll('button');
        expect(actionButtons).toHaveLength(1);
        expect(actionButtons[0]).toHaveAttribute('title', 'View');
      });
    });
  });

  describe('Administrator as Client (C Admin) View', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
      });
    });

    it('enforces exactly 1 Create button in the entire view (Create Assurance Set)', () => {
      render(<DashboardView />);

      // Search all buttons containing "Create"
      const createButtons = screen.getAllByRole('button', { name: /create/i });
      expect(createButtons).toHaveLength(1);
      expect(createButtons[0].textContent?.trim()).toBe('Create Assurance Set');

      // Projects card header has "View All" button instead of "Create Project"
      const projectsHeader = screen.getByText('Projects').closest('.card-header');
      expect(projectsHeader).not.toBeNull();
      expect(within(projectsHeader as HTMLElement).queryByRole('button', { name: /create project/i })).toBeNull();
      expect(within(projectsHeader as HTMLElement).getByRole('button', { name: /view all/i })).toBeInTheDocument();
    });

    it('enforces at most 1 badge per row across C Admin tables', () => {
      render(<DashboardView />);

      const rows = screen.getAllByRole('row').slice(1);
      rows.forEach((row) => {
        const badges = row.querySelectorAll('.badge');
        expect(badges.length).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Fleet Table with Shared ListToolbar', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'Administrator',
      });
    });

    it('renders shared ListToolbar in the Fleet Overview table with search and View All', () => {
      const { container } = render(<DashboardView />);

      // ListToolbar exists inside the card
      const toolbar = container.querySelector('.map-list-toolbar');
      expect(toolbar).not.toBeNull();

      // Search input exists with placeholder
      const searchInput = screen.getByPlaceholderText('Search vessels...');
      expect(searchInput).toBeInTheDocument();

      // View All button is present as primaryAction
      const viewAllBtn = within(toolbar as HTMLElement).getByRole('button', { name: /view all/i });
      expect(viewAllBtn).toBeInTheDocument();

      // Filter input updates table
      fireEvent.change(searchInput, { target: { value: 'Pacific' } });
      const rows = screen.getAllByRole('row').slice(1);
      rows.forEach((row) => {
        expect(row.textContent?.toLowerCase()).toContain('pacific');
      });
    });

    it('enforces at most 1 badge per row in fleet table (Operating Status only; Class is plain text)', () => {
      render(<DashboardView />);

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);

      rows.forEach((row) => {
        const badges = row.querySelectorAll('.badge');
        expect(badges.length).toBeLessThanOrEqual(1);

        // Class Society cell (index 3) is plain text, not a badge
        const cells = row.querySelectorAll('td');
        expect(cells[3].querySelector('.badge')).toBeNull();
      });
    });
  });
});
