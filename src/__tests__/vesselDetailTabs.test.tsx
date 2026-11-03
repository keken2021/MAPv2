/*
  file summary: asserts vessel detail tab labels and counts per role (audit 5318).
  responsibilities: owning-organization Administrator sees 7 tabs; other personas see 6.
  role in system: covers VesselDetailView tablist after Overview…History rename and Past charters gate.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';

function tabLabels(): string[] {
  const tablist = screen.getByRole('tablist', { name: /vessel detail tabs/i });
  return within(tablist)
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

  it('shows 7 tabs for the Administrator of the owning organization', () => {
    render(<VesselDetailView vesselId="VESSEL-001" />);
    const labels = tabLabels();
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe('Overview');
    expect(labels.some((label) => label.startsWith('Documents'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Assurance'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Inspections'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Crew and Equipment'))).toBe(true);
    expect(labels).toContain('History and Audit Trail');
    expect(labels.some((label) => label.startsWith('Past charters'))).toBe(true);
  });

  it('shows 6 tabs for anyone else', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
    });
    render(<VesselDetailView vesselId="VESSEL-001" />);
    const labels = tabLabels();
    expect(labels).toHaveLength(6);
    expect(labels[0]).toBe('Overview');
    expect(labels.some((label) => label.startsWith('Documents'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Assurance'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Inspections'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Crew and Equipment'))).toBe(true);
    expect(labels).toContain('History and Audit Trail');
    expect(labels.some((label) => label.startsWith('Past charters'))).toBe(false);
  });
});
