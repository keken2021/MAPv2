import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectView } from '../views/ProjectView';
import { MarketplaceView } from '../views/MarketplaceView';
import { UserManagementView } from '../views/UserManagementView';
import { useMapStore } from '../store/useMapStore';
import { Project } from '../types/project';

const project = (overrides: Partial<Project> & Pick<Project, 'id' | 'status'>): Project =>
  ({
    name: `${overrides.id} project`,
    projectType: 'Charter / Voyage',
    requestingOrganization: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2026-12-01',
    assetLinks: [],
    ...overrides,
  }) as Project;

describe('Projects, marketplace and users declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      isAuthenticated: true,
      projects: [
        project({ id: 'PRJ-DRAFT', status: 'Draft' }),
        project({ id: 'PRJ-READY', status: 'Ready for Charter' }),
        project({ id: 'PRJ-CLOSED', status: 'Closed' }),
      ],
      assuranceSets: [],
    });
  });

  it('colours project status through StatusBadge tones', () => {
    const { container } = render(<ProjectView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();
    const card = container.querySelector('.map-card-custom') as HTMLElement;
    expect(within(card).getByRole('tablist', { name: /project tabs/i })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /export options/i })).toBeInTheDocument();

    const rows = within(card).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.querySelectorAll('.map-status-badge')).toHaveLength(1);
      expect(row.querySelector('.badge')).toBeNull();
    });

    expect(container.querySelector('.map-status-badge[data-status="Draft"]')).toHaveAttribute('data-tone', 'warning');
    expect(container.querySelector('.map-status-badge[data-status="Ready for Charter"]')).toHaveAttribute('data-tone', 'success');
    expect(container.querySelector('.map-status-badge[data-status="Closed"]')).toHaveAttribute('data-tone', 'neutral');
  });

  it('keeps marketplace Clear All off the toolbar and labels the column Actions', () => {
    const { container } = render(<MarketplaceView />);
    const tablist = screen.getByRole('tablist', { name: /marketplace tabs/i });
    const card = tablist.closest('.map-card-custom') as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /clear all/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /table view/i }));
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(container.querySelectorAll('.map-status-badge').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[role="progressbar"]').length).toBeGreaterThan(0);
  });

  it('shows user type as text with one status badge and no KPI cards', () => {
    const { container } = render(<UserManagementView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();
    expect(screen.getByRole('tablist', { name: /user tabs/i })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.querySelectorAll('.map-status-badge')).toHaveLength(1);
      expect(row.querySelector('.badge')).toBeNull();
      expect(row.textContent).toMatch(/Organization|Third-Party/);
    });
  });
});
