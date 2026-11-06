import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import { DashboardConfig } from '../types/dashboard';

describe('SharedDashboardFrame', () => {
  const createSampleConfig = (): DashboardConfig => ({
    roleTitle: 'Administrator as client',
    subtitle: 'Northwind Shipping · 3 projects',
    tiles: [
      { id: 't1', label: 'Sets needing people', value: 3, tone: 'neutral', linkText: 'View →', onClick: vi.fn() },
      { id: 't2', label: 'Overdue sets', value: 2, tone: 'bad', linkText: 'View →', onClick: vi.fn() },
      { id: 't3', label: 'Due this week', value: 4, tone: 'warn', linkText: 'View →', onClick: vi.fn() },
      { id: 't4', label: 'Open findings', value: 7, tone: 'ok', linkText: 'View →', onClick: vi.fn() },
    ],
    actionItems: [
      {
        id: 'a1',
        title: 'MV Borealis · Q4 survey',
        subtitle: 'No verifier, no inspector · starts 10 Nov',
        tag: 'Missing role',
        tagTone: 'warn',
        buttonLabel: 'Assign',
        onAction: vi.fn(),
      },
      {
        id: 'a2',
        title: 'MV Celeste · Annual',
        subtitle: 'No approver · starts 14 Nov',
        buttonLabel: 'Assign',
        onAction: vi.fn(),
        readinessBar: { submission: true, verification: true, inspection: false },
      },
      {
        id: 'a3',
        title: 'MV Aurora · Crew certificates',
        subtitle: 'No submitter · starts 21 Nov',
        buttonLabel: 'Assign',
        onAction: vi.fn(),
      },
    ],
    activityItems: [
      { id: 'act1', text: 'Verifier accepted 4 documents on MV Aurora', timeAgo: '1 h ago' },
      { id: 'act2', text: 'Inspector logged 2 findings on MV Borealis', timeAgo: 'Yesterday' },
      { id: 'act3', text: 'Approver approved MV Delta Q3', timeAgo: '2 days ago' },
    ],
    seeAllText: 'See all 3',
    onSeeAll: vi.fn(),
  });

  it('renders role title, subtitle, and 4 KPI tiles with values and labels', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByText('Sets needing people')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Overdue sets')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('Due this week')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    expect(screen.getByText('Open findings')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders action items with titles, subtitles, tags, buttons, and readiness bar', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByText('MV Borealis · Q4 survey')).toBeInTheDocument();
    expect(screen.getByText('No verifier, no inspector · starts 10 Nov')).toBeInTheDocument();
    expect(screen.getByText('Missing role')).toBeInTheDocument();

    const assignButtons = screen.getAllByRole('button', { name: 'Assign' });
    expect(assignButtons).toHaveLength(3);

    const readinessBars = screen.getAllByTestId('readiness-bar');
    expect(readinessBars).toHaveLength(1);

    expect(screen.getByText('Verifier accepted 4 documents on MV Aurora')).toBeInTheDocument();
    expect(screen.getByText('1 h ago')).toBeInTheDocument();
  });

  it('renders the empty state "Nothing needs you today" when action list is empty', () => {
    const config = createSampleConfig();
    config.actionItems = [];
    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByTestId('empty-action-state')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
    expect(screen.queryByTestId('action-item-row')).not.toBeInTheDocument();
  });

  it('limits visible action items to up to 5 rows', () => {
    const config = createSampleConfig();
    config.actionItems = [
      { id: '1', title: 'Row 1', buttonLabel: 'Action 1' },
      { id: '2', title: 'Row 2', buttonLabel: 'Action 2' },
      { id: '3', title: 'Row 3', buttonLabel: 'Action 3' },
      { id: '4', title: 'Row 4', buttonLabel: 'Action 4' },
      { id: '5', title: 'Row 5', buttonLabel: 'Action 5' },
      { id: '6', title: 'Row 6', buttonLabel: 'Action 6' },
      { id: '7', title: 'Row 7', buttonLabel: 'Action 7' },
    ];
    render(<SharedDashboardFrame config={config} />);

    const rows = screen.getAllByTestId('action-item-row');
    expect(rows).toHaveLength(5);
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 5')).toBeInTheDocument();
    expect(screen.queryByText('Row 6')).not.toBeInTheDocument();
  });

  it('triggers onClick when a KPI tile is clicked or pressed with Enter', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    const tile = screen.getByTestId('kpi-tile-t1');
    fireEvent.click(tile);
    expect(config.tiles[0].onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(config.tiles[0].onClick).toHaveBeenCalledTimes(2);
  });

  it('triggers onAction when action button is clicked', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    const firstButton = screen.getAllByRole('button', { name: 'Assign' })[0];
    fireEvent.click(firstButton);
    expect(config.actionItems[0].onAction).toHaveBeenCalledTimes(1);
  });

  it('triggers onSeeAll when See all link is clicked', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    const seeAll = screen.getByTestId('see-all-action-link');
    fireEvent.click(seeAll);
    expect(config.onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('renders correctly at 1280px desktop width and 800px narrow width with action list first in order', () => {
    const config = createSampleConfig();

    // 1280px viewport
    window.innerWidth = 1280;
    window.dispatchEvent(new Event('resize'));
    const { unmount } = render(<SharedDashboardFrame config={config} />);

    const actionSection = screen.getByTestId('needs-your-action-section');
    const activitySection = screen.getByTestId('recent-activity-section');
    expect(actionSection).toBeInTheDocument();
    expect(activitySection).toBeInTheDocument();

    // In DOM order, Needs your action precedes Recent activity
    expect(actionSection.compareDocumentPosition(activitySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    unmount();

    // 800px viewport (below 900px breakpoint)
    window.innerWidth = 800;
    window.dispatchEvent(new Event('resize'));
    render(<SharedDashboardFrame config={config} />);

    const narrowAction = screen.getByTestId('needs-your-action-section');
    const narrowActivity = screen.getByTestId('recent-activity-section');
    expect(narrowAction.compareDocumentPosition(narrowActivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders "No recent activity" when activity list is empty', () => {
    const config = createSampleConfig();
    config.activityItems = [];
    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByTestId('empty-activity-state')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('ensures the frame root has no card background or border', () => {
    const config = createSampleConfig();
    render(<SharedDashboardFrame config={config} />);

    const frame = screen.getByTestId('shared-dashboard-frame');
    expect(frame.className).toContain('map-dashboard-frame');
    expect(frame.className).not.toMatch(/\bbg-(?:slate|white|gray)\b/);
    expect(frame.className).not.toMatch(/\bborder\b/);
    expect(frame.className).not.toMatch(/\brounded\b/);
  });

  it('ensures no rendered element carries a red-, amber-, green-, blue- or slate- palette class', () => {
    const config = createSampleConfig();
    const { container } = render(<SharedDashboardFrame config={config} />);

    const allElements = container.querySelectorAll('*');
    const palettePattern = /(?:red|amber|green|blue|slate)-[0-9]+/i;

    const violatingElements: { tag: string; className: string }[] = [];
    allElements.forEach((el) => {
      const cls = el.getAttribute('class') || '';
      if (palettePattern.test(cls)) {
        violatingElements.push({ tag: el.tagName, className: cls });
      }
    });

    expect(violatingElements).toEqual([]);
  });
});
