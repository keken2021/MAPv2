import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

describe('Assurance Sets List and Detail UI Declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine',
      isAuthenticated: true,
    });
  });

  describe('Assurance Sets List (AssuranceTable)', () => {
    it('places CountTabs and ListToolbar inside the main card container', () => {
      const { container } = render(
        <AssuranceTable onSelectSet={() => { }} onInitiateSet={() => { }} />
      );

      // Main card should contain CountTabs and ListToolbar
      const mainCard = container.querySelector('.card.map-card-custom');
      expect(mainCard).not.toBeNull();

      const countTabs = mainCard?.querySelector('.map-count-tabs');
      expect(countTabs).not.toBeNull();

      const listToolbar = mainCard?.querySelector('.map-list-toolbar');
      expect(listToolbar).not.toBeNull();

      // No floating pill row outside the card
      const outerNavPills = container.querySelector('.d-flex.flex-column > .d-flex .nav-pills');
      expect(outerNavPills).toBeNull();

      // Tab pills inside CountTabs with counts
      expect(within(countTabs as HTMLElement).getByRole('tab', { name: /public/i })).toBeDefined();
      expect(within(countTabs as HTMLElement).getByRole('tab', { name: /organization/i })).toBeDefined();
      expect(within(countTabs as HTMLElement).getByRole('tab', { name: /drafts/i })).toBeDefined();
    });

    it('removes the Draft badge beside the set title in the table rows', () => {
      // Switch to drafts tab to view draft sets
      render(
        <AssuranceTable onSelectSet={() => { }} onInitiateSet={() => { }} defaultTab="drafts" />
      );

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);

      rows.forEach((row) => {
        // Title cell is the second cell (index 1)
        const cells = row.querySelectorAll('td');
        const titleCell = cells[1];
        // Ensure no badge exists inside the title cell
        expect(titleCell.querySelector('.badge')).toBeNull();
      });
    });

    it('merges Scope and Scope Type into one column on the Public tab without badges', () => {
      render(
        <AssuranceTable onSelectSet={() => { }} onInitiateSet={() => { }} defaultTab="public" />
      );

      // Verify column headers: Title, Scope, Created By, Actions (4 columns)
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(4);

      const headerTexts = headers.map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
      expect(headerTexts).toEqual([
        expect.stringContaining('Title'),
        expect.stringContaining('Scope'),
        expect.stringContaining('Created By'),
        'Actions',
      ]);
      expect(screen.queryByRole('columnheader', { name: /scope type/i })).toBeNull();

      // Rows in the public templates table have 4 cells and no badge in the Scope cell
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        expect(cells).toHaveLength(4);
        const scopeCell = cells[1];
        expect(scopeCell.querySelector('.badge')).toBeNull();
      });
    });
  });

  describe('Assurance Sets Detail (AssuranceDetailView)', () => {
    it('integrates DetailHeader with single status badge and metaItems, and no back link of its own', () => {
      const state = useMapStore.getState();
      const openSet = state.assuranceSets.find(
        (s) => s.stage !== 'Cancelled' && s.visibility !== 'draft' && !s.closureType
      ) || state.assuranceSets[0];

      const { container } = render(<AssuranceDetailView setId={openSet.id} />);

      const detailHeader = container.querySelector('.map-detail-header');
      expect(detailHeader).not.toBeNull();

      // The top header holds the only back button
      expect(within(detailHeader as HTMLElement).queryByText(/back to assurance sets/i)).toBeNull();

      // Title and meta items
      expect(within(detailHeader as HTMLElement).getByText(openSet.title)).toBeDefined();
      expect(within(detailHeader as HTMLElement).getByText(openSet.id)).toBeDefined();

      // Exactly 1 status badge in DetailHeader
      const headerBadges = detailHeader?.querySelectorAll('.map-status-badge');
      expect(headerBadges?.length).toBe(1);
      expect(headerBadges?.[0].textContent?.trim()).toBe(openSet.stage);
    });

    it('shows no back button on the draft screen; the top header holds it', () => {
      const { assuranceSets } = useMapStore.getState();
      const draftSet: AssuranceSet = { ...assuranceSets[0], id: 'AS-DRAFT-TEST', visibility: 'draft' };
      useMapStore.setState({ assuranceSets: [...assuranceSets, draftSet] });

      render(<AssuranceDetailView setId={draftSet.id} />);

      expect(screen.getByText(/this assurance set is a draft/i)).toBeDefined();
      expect(screen.queryByText(/back to assurance sets/i)).toBeNull();
    });

    it('shows Overdue badge and no alert banner for an overdue set', () => {
      const state = useMapStore.getState();
      const baseSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];
      const overdueSet: AssuranceSet = {
        ...baseSet,
        id: 'AS-TEST-OVERDUE',
        complianceDeadline: '2020-01-01',
        targetDate: '2020-01-01',
        revisedCompletionDate: undefined,
        stage: 'Verification',
        closureType: undefined,
      };

      useMapStore.setState({
        assuranceSets: [overdueSet, ...state.assuranceSets.filter((s) => s.id !== overdueSet.id)],
      });

      const { container } = render(<AssuranceDetailView setId="AS-TEST-OVERDUE" />);

      const detailHeader = container.querySelector('.map-detail-header');
      expect(detailHeader).not.toBeNull();

      // Exactly 1 status badge in DetailHeader: "Overdue"
      const headerBadges = detailHeader?.querySelectorAll('.map-status-badge');
      expect(headerBadges?.length).toBe(1);
      expect(headerBadges?.[0].textContent?.trim()).toBe('Overdue');

      // No overdue alert banner
      expect(screen.queryByText(/overdue outcome required/i)).toBeNull();
      const alerts = container.querySelectorAll('.alert-danger');
      expect(alerts.length).toBe(0);
    });

    it('shows Cancelled alert only and no header status badge for a cancelled set', () => {
      const state = useMapStore.getState();
      const baseSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];
      const cancelledSet: AssuranceSet = {
        ...baseSet,
        id: 'AS-TEST-CANCELLED',
        stage: 'Cancelled',
        cancelledAt: '2026-10-20',
        cancellationReason: 'Charter terminated by client',
      };

      useMapStore.setState({
        assuranceSets: [cancelledSet, ...state.assuranceSets.filter((s) => s.id !== cancelledSet.id)],
      });

      const { container } = render(<AssuranceDetailView setId="AS-TEST-CANCELLED" />);

      const detailHeader = container.querySelector('.map-detail-header');
      expect(detailHeader).not.toBeNull();

      // DetailHeader has 0 status badges (omitted so alert is not repeated)
      const headerBadges = detailHeader?.querySelectorAll('.map-status-badge');
      expect(headerBadges?.length).toBe(0);

      // Cancelled alert is rendered under the header
      const cancelledAlert = screen.getByRole('alert');
      expect(cancelledAlert.textContent).toContain('Cancelled:');
      expect(cancelledAlert.textContent).toContain('Charter terminated by client');
    });

    it('shows Partially Closed badge and no alert banner for a partially closed set', () => {
      const state = useMapStore.getState();
      const baseSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];
      const partialSet: AssuranceSet = {
        ...baseSet,
        id: 'AS-TEST-PARTIAL',
        stage: 'Verification',
        closureType: 'partial',
        partiallyClosedAt: '2026-10-22',
      };

      useMapStore.setState({
        assuranceSets: [partialSet, ...state.assuranceSets.filter((s) => s.id !== partialSet.id)],
      });

      const { container } = render(<AssuranceDetailView setId="AS-TEST-PARTIAL" />);

      const detailHeader = container.querySelector('.map-detail-header');
      expect(detailHeader).not.toBeNull();

      // DetailHeader has 1 badge: Partially Closed
      const headerBadges = detailHeader?.querySelectorAll('.map-status-badge');
      expect(headerBadges?.length).toBe(1);
      expect(headerBadges?.[0].textContent?.trim()).toBe('Partially Closed');

      // No partially closed alert banner
      expect(screen.queryByText(/this assurance set was partially closed/i)).toBeNull();
    });

    it('moves on-time, findings, and remaining badges into the info card', () => {
      const state = useMapStore.getState();
      const openSet = state.assuranceSets.find(
        (s) => s.stage !== 'Cancelled' && s.visibility !== 'draft'
      ) || state.assuranceSets[0];

      const { container } = render(<AssuranceDetailView setId={openSet.id} />);

      // The left info card container
      const infoCard = container.querySelector('.col-lg-8 .card.map-card-custom');
      expect(infoCard).not.toBeNull();

      // Badges reside in the info card
      const badgesContainer = infoCard?.querySelector('.d-flex.flex-wrap.align-items-center.gap-2.mb-3');
      expect(badgesContainer).not.toBeNull();
      expect(badgesContainer?.textContent).toMatch(/on time|late/i);
      expect(badgesContainer?.textContent).toMatch(/remaining tasks/i);
    });

    it('ensures Export appears only once on the screen (in DetailHeader)', () => {
      const state = useMapStore.getState();
      const openSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];

      render(<AssuranceDetailView setId={openSet.id} />);

      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      expect(exportButtons).toHaveLength(1);
    });

    it('ensures nested shaded boxes inside cards are removed', () => {
      const state = useMapStore.getState();
      const openSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];

      const { container } = render(<AssuranceDetailView setId={openSet.id} />);

      // Check left and right top cards: neither contains .p-4.bg-light.border.rounded-3
      const topRow = container.querySelector('.row.g-4.align-items-stretch');
      expect(topRow).not.toBeNull();

      const nestedBoxes = topRow?.querySelectorAll('.p-4.bg-light.border.rounded-3');
      expect(nestedBoxes?.length).toBe(0);
    });

    it('keeps font-mono-code for Set ID while Stakeholders values use body font', () => {
      const state = useMapStore.getState();
      const openSet = state.assuranceSets.find((s) => s.visibility !== 'draft') || state.assuranceSets[0];

      const { container } = render(<AssuranceDetailView setId={openSet.id} />);

      const infoCard = container.querySelector('.col-lg-8 .card.map-card-custom');
      expect(infoCard).not.toBeNull();

      // Set ID has font-mono-code
      const setIdEl = within(infoCard as HTMLElement).getByText(openSet.id);
      expect(setIdEl).toHaveClass('font-mono-code');

      // Stakeholders values do not have font-mono-code
      const submitterText = openSet.assignedSubmitter || 'M. Chen (Northwind Marine Pty Ltd)';
      const submitterEl = within(infoCard as HTMLElement).getByText(submitterText);
      expect(submitterEl).not.toHaveClass('font-mono-code');
      expect(submitterEl.closest('.font-mono-code')).toBeNull();

      const verifierText = openSet.verificationRequired === false
        ? 'N/A (Verification Bypassed)'
        : (openSet.assignedVerifier || 'A. Fontaine (Bureau Veritas Inspectorate)');
      const verifierEl = within(infoCard as HTMLElement).getByText(verifierText);
      expect(verifierEl).not.toHaveClass('font-mono-code');
      expect(verifierEl.closest('.font-mono-code')).toBeNull();
    });
  });
});

