import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';

const initialState = useMapStore.getState();

describe('ProjectDetailView UI Declutter', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
      isAuthenticated: true,
    });
  });

  it('renders exactly one status badge beside title and project ID in mono', () => {
    const { container } = render(
      <ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />
    );

    const header = container.querySelector('.map-detail-header');
    expect(header).not.toBeNull();

    // Exactly 1 status badge in the header
    const headerBadges = header?.querySelectorAll('.map-status-badge');
    expect(headerBadges?.length).toBe(1);
    expect(headerBadges?.[0].textContent?.trim()).toBe('Assurance In Progress');

    // Project ID is in mono meta items under the title
    const metaContainer = header?.querySelector('.map-detail-header-meta');
    expect(metaContainer).not.toBeNull();
    expect(metaContainer?.textContent).toContain('MAP-PROJ-2026-MARINE-007');

    // Title is present
    expect(within(header as HTMLElement).getByText('Northwind Dangerous Route Transit')).toBeInTheDocument();
  });

  it('displays project type and risk profile as plain text in the Details tab', () => {
    const { container } = render(
      <ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

    // Project type and risk profile appear as plain text in the Details tab
    expect(screen.getByText('Charter / Voyage')).toBeInTheDocument();
    expect(screen.getByText('Armed escort required')).toBeInTheDocument();

    // They are not rendered as status badges
    const allBadges = container.querySelectorAll('.map-status-badge');
    allBadges.forEach((b) => {
      expect(b.textContent).not.toContain('Armed Escort Required');
      expect(b.textContent).not.toContain('Charter / Voyage');
    });
  });

  it('uses link icon for the Attach button instead of the eye icon', () => {
    // Add a standalone assurance set available for attach
    const state = useMapStore.getState();
    const existingSets = state.assuranceSets;
    useMapStore.setState({
      activePersona: 'Administrator',
      assuranceSets: [
        ...existingSets,
        {
          id: 'AS-STANDALONE-001',
          title: 'Standalone Test Set',
          assuranceType: 'Vessel',
          stage: 'Ready for Review',
          visibility: 'public',
          projectId: undefined,
          initiatorOrg: 'Northwind Marine Pty Ltd',
          createdByPersona: 'Administrator',
          createdByUserId: 'USR-101',
          createdByName: 'K. Osei',
          requirements: [],
        } as any,
      ],
    });

    const { container } = render(
      <ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Assurance Sets' }));

    // Find the Attach button
    const attachButton = screen.getByRole('button', { name: /attach/i });
    expect(attachButton).toBeInTheDocument();

    // The Attach button should have an SVG with lucide-link2 class, and NOT lucide-eye
    const svg = attachButton.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('lucide-link2')).toBe(true);
    expect(svg?.classList.contains('lucide-eye')).toBe(false);
  });

  it('makes Overview the default active tab, shows project readiness and KPIs, and switches cleanly to written-spec Details', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: 'USR-228',
      isAuthenticated: true,
    });
    render(<ProjectDetailView projectId="MAP-PROJ-2026-MARINE-017" />);

    const tablist = screen.getByRole('tablist', { name: /project detail tabs/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('Overview');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    const overviewPanel = screen.getByTestId('project-overview-tab');
    expect(overviewPanel).toBeInTheDocument();

    const readinessCard = screen.getByTestId('project-overview-readiness');
    expect(within(readinessCard).getByText('Overall Project Readiness')).toBeInTheDocument();
    expect(within(readinessCard).getByRole('progressbar')).toBeInTheDocument();
    expect(within(readinessCard).getByText('Objects')).toBeInTheDocument();
    expect(within(readinessCard).getByText('Assurance Sets')).toBeInTheDocument();
    expect(within(readinessCard).getByText('Providers')).toBeInTheDocument();

    const metrics = screen.getByTestId('project-efficiency-metrics');
    expect(within(metrics).getByText('Turnaround Days')).toBeInTheDocument();
    expect(within(metrics).getByText('Submission Attempts')).toBeInTheDocument();
    expect(within(metrics).getByText('Reused Documents')).toBeInTheDocument();
    expect(within(metrics).getByText('Re-verifications Avoided')).toBeInTheDocument();

    const bottlenecks = screen.getByTestId('project-active-bottlenecks');
    expect(within(bottlenecks).getByText('Active Bottlenecks')).toBeInTheDocument();

    const providers = screen.getByTestId('project-participating-providers');
    expect(within(providers).getByText('Participating Providers')).toBeInTheDocument();
    expect(within(providers).getByText('Northwind Marine Pty Ltd')).toBeInTheDocument();
    expect(within(providers).getByText('Meridian Shipyards')).toBeInTheDocument();
    expect(within(providers).getByText('Harbourline Terminals')).toBeInTheDocument();

    fireEvent.click(within(tablist).getByRole('tab', { name: 'Details' }));
    expect(within(tablist).getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('project-overview-tab')).toBeNull();

    const detailsTab = screen.getByTestId('project-details-tab');
    expect(within(detailsTab).getByText('Scope & Particulars')).toBeInTheDocument();
    expect(within(detailsTab).getByText('Organizations & Contract Chain')).toBeInTheDocument();
    expect(within(detailsTab).queryByRole('progressbar')).toBeNull();
    expect(within(detailsTab).queryByText('Overall Project Readiness')).toBeNull();
    expect(detailsTab.querySelectorAll('.badge, .map-status-badge')).toHaveLength(0);

    // Confidential Project Value must stay hidden from Details
    expect(within(detailsTab).queryByText(/Project Value/i)).toBeNull();
    expect(within(detailsTab).queryByText(/240,000,000/)).toBeNull();

    // Non-confidential particulars and contract chain appear cleanly
    expect(within(detailsTab).getByText('Multi-Year Term')).toBeInTheDocument();
    expect(within(detailsTab).getByText('On-Hire Date')).toBeInTheDocument();
    expect(within(detailsTab).getByText('Oil Company')).toBeInTheDocument();
    expect(within(detailsTab).getByText('Northwind Marine Pty Ltd')).toBeInTheDocument();
    expect(within(detailsTab).getByText('Meridian Shipyards')).toBeInTheDocument();
    expect(within(detailsTab).getByText('Harbourline Terminals')).toBeInTheDocument();
  });
});
