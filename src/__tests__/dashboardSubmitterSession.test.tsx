import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DashboardView } from '../views/DashboardView';

describe('Submitter Dashboard per-person filtering', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: undefined,
      isAuthenticated: true,
    });
  });

  it('shows 13 sets instead of 22 for Northwind Submitter M. Chen', () => {
    render(<DashboardView />);

    const assignedKpiLabel = screen.getByText('Assigned to you');
    const kpiCard = assignedKpiLabel.closest('.map-kpi-card');
    expect(kpiCard).not.toBeNull();
    expect(kpiCard?.textContent).toContain('13');
    expect(kpiCard?.textContent).not.toContain('22');

    expect(screen.getByText('Showing 1-10 of 13')).toBeInTheDocument();
  });

  it('renders exactly 7 columns in Submitter assurance sets table with min-width on Title', () => {
    render(<DashboardView />);

    const table = screen.getByRole('table');
    const thead = table.querySelector('thead');
    expect(thead).not.toBeNull();
    const headers = within(thead!).getAllByRole('columnheader');
    expect(headers).toHaveLength(7);

    const headerTexts = headers.map((h) => h.textContent?.trim());
    expect(headerTexts[0]).toContain('Set ID');
    expect(headerTexts[1]).toContain('Title');
    expect(headerTexts[2]).toContain('Contract Period');
    expect(headerTexts[3]).toContain('Stage');
    expect(headerTexts[4]).toContain('Readiness');
    expect(headerTexts[5]).toContain('On-Time');
    expect(headerTexts[6]).toContain('Actions');

    // Title column has minimum width constraint
    expect(headers[1]).toHaveStyle({ minWidth: '280px' });

    // Vessel, Findings, Remaining are not separate column headers
    expect(headerTexts.some((t) => t === 'Vessel')).toBe(false);
    expect(headerTexts.some((t) => t === 'Findings')).toBe(false);
    expect(headerTexts.some((t) => t === 'Remaining')).toBe(false);

    // First row's title cell contains vessel name and remaining items in line 2
    const tbody = table.querySelector('tbody');
    const firstRow = tbody?.querySelectorAll('tr')[0];
    expect(firstRow).toBeDefined();
    const cells = within(firstRow!).getAllByRole('cell');
    expect(cells).toHaveLength(7);

    // Title cell (index 1) has vessel name and remaining details
    expect(cells[1]).toHaveStyle({ minWidth: '280px' });
    expect(cells[1].textContent).toMatch(/IMO \d+/);
    expect(cells[1].textContent).toMatch(/\d+ finding/);
    expect(cells[1].textContent).toMatch(/\d+ task/);
  });

  it('keeps organization sets for C Admin', () => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
    });

    render(<DashboardView />);
    expect(screen.queryByText('Assigned to you')).toBeNull();
  });
});
