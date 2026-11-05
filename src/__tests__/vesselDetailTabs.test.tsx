/*
  file summary: asserts vessel detail tab labels and counts per role (audit 5318 / Task 5451).
  responsibilities: owning-organization Administrator sees Audit + Past charters; shared Tabs section variant.
  role in system: covers VesselDetailView tablist after section Tabs migration.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

function tablist() {
  return screen.getByRole('tablist', { name: /vessel detail tabs/i });
}

function tabLabels(): string[] {
  return within(tablist())
    .getAllByRole('tab')
    .map((tab) => (tab.textContent || '').replace(/\s*\(\d+\)\s*$/, '').trim());
}

describe('vessel detail tabs', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
    });
  });

  it('shows section tabs with aria-selected and count spans for the owning Administrator', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    const labels = tabLabels();
    expect(labels[0]).toBe('Overview');
    expect(labels).toContain('Documents');
    expect(labels).toContain('Assurance');
    expect(labels).toContain('Inspections');
    expect(labels).toContain('Crew and Equipment');
    expect(labels).toContain('History');
    expect(labels).toContain('Audit');
    expect(labels).toContain('Past charters');

    const overview = within(tablist()).getByRole('tab', { name: /^Overview$/i });
    expect(overview).toHaveAttribute('aria-selected', 'true');

    const documents = within(tablist()).getByRole('tab', { name: /Documents/i });
    expect(documents.querySelector('.map-tabs-section-count')).toBeTruthy();
    expect(documents.textContent).toMatch(/Documents\s*\(\d+\)/);

    fireEvent.click(within(tablist()).getByRole('tab', { name: /^History$/i }));
    expect(within(tablist()).getByRole('tab', { name: /^History$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(overview).toHaveAttribute('aria-selected', 'false');
  });

  it('hides Audit and Past charters for other personas', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
    });
    render(<VesselDetailView vesselId="VESSEL-001" />);
    const labels = tabLabels();
    expect(labels).toContain('History');
    expect(labels).not.toContain('Audit');
    expect(labels.some((label) => label.startsWith('Past charters'))).toBe(false);
  });
});
