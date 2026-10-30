import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';

describe('ProjectDetailView UI Declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
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

  it('displays project type and risk profile as plain text in the description card', () => {
    const { container } = render(
      <ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />
    );

    // The text "Charter / Voyage · Armed escort required" appears as plain text
    expect(screen.getByText('Charter / Voyage · Armed escort required')).toBeInTheDocument();

    // It is not rendered as a badge
    const badgeWithText = container.querySelector('.badge:not(.map-status-badge)');
    // No badge should contain "Armed Escort Required" or "Charter / Voyage"
    const allBadges = container.querySelectorAll('.badge');
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
          requirements: [],
        } as any,
      ],
    });

    const { container } = render(
      <ProjectDetailView projectId="MAP-PROJ-2026-MARINE-007" />
    );

    // Find the Attach button
    const attachButton = screen.getByRole('button', { name: /attach/i });
    expect(attachButton).toBeInTheDocument();

    // The Attach button should have an SVG with lucide-link2 class, and NOT lucide-eye
    const svg = attachButton.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('lucide-link2')).toBe(true);
    expect(svg?.classList.contains('lucide-eye')).toBe(false);
  });
});
