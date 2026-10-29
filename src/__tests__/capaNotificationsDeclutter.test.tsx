import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CapaManagementView } from '../views/CapaManagementView';
import { NotificationsView } from '../views/NotificationsView';
import { useMapStore } from '../store/useMapStore';
import { CapaItem } from '../types/capa';

const capa = (overrides: Partial<CapaItem> & Pick<CapaItem, 'id' | 'status'>): CapaItem => ({
  vesselName: 'MV Pacific Endeavour',
  vesselId: 'VESSEL-001',
  checklistItemTitle: 'Liferaft',
  title: `${overrides.id} finding`,
  findingDescription: 'Finding text',
  owner: 'Northwind Marine',
  dueDate: '01 Nov 2026',
  evidences: [],
  createdDate: '01 Oct 2026',
  ...overrides,
});

describe('CAPA and notifications declutter', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      isAuthenticated: true,
      activeSessionUserId: 'USR-101',
      currentEntityId: undefined,
      capaItems: [
        capa({ id: 'CAPA-OPEN', status: 'Open' }),
        capa({ id: 'CAPA-RE', status: 'Under Re-Inspection', flaggedForReinspection: true }),
        capa({ id: 'CAPA-CLOSED', status: 'Verified & Closed' }),
        capa({ id: 'CAPA-FIX', status: 'Rectification Required' }),
      ],
    });
  });

  it('replaces CAPA count cards with tabs whose counts match the list', () => {
    const { container } = render(<CapaManagementView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();

    const tabs = screen.getByRole('tablist', { name: /capa tabs/i });
    const rows = () => screen.getAllByRole('row').slice(1);

    const all = within(tabs).getByRole('tab', { name: /^all/i });
    expect(all).toHaveClass('is-active');
    expect(all.textContent).toContain('(4)');
    expect(rows()).toHaveLength(4);

    const open = within(tabs).getByRole('tab', { name: /^open/i });
    expect(open.textContent).toContain('(1)');
    fireEvent.click(open);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('CAPA-OPEN finding')).toBeInTheDocument();

    const reinspection = within(tabs).getByRole('tab', { name: /re-inspection/i });
    expect(reinspection.textContent).toContain('(1)');
    fireEvent.click(reinspection);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('CAPA-RE finding')).toBeInTheDocument();
    expect(screen.getAllByText('Re-Inspection').length).toBeGreaterThan(0);
    expect(screen.queryByText(/flagged for re-inspection/i)).toBeNull();

    const closed = within(tabs).getByRole('tab', { name: /^closed/i });
    expect(closed.textContent).toContain('(1)');
    fireEvent.click(closed);
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('CAPA-CLOSED finding')).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: /finding/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^vessel/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /&|\// })).toBeNull();
  });

  it('keeps notification tabs, mark all read, and a view icon inside one card', () => {
    render(<NotificationsView />);
    const card = document.querySelector('.map-card-custom');
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByRole('tablist', { name: /notification tabs/i })).toBeInTheDocument();
    expect(scope.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    expect(scope.getAllByRole('button', { name: 'View' }).length).toBeGreaterThan(0);
    expect(scope.queryByRole('button', { name: /open set|reupload document/i })).toBeNull();
  });
});
